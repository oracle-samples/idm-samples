/*
 * Handler for working with credentials, which includes Session Creation
 * and KMSI Token management, since they uses the same cookies.
 */

import express, { CookieOptions, Router } from "express";
import { ServerConfig } from "../types/config";
import IdcsUtil, { deriveUserIdFromToken } from "../util/idcsUtil";
import winston from "winston";
import errorConstants from "../error/errorConstants";
import { RequestState } from "../types/idcsTypes";
import { createKmsiCookie, generateMachineId, splitKmsiCookie } from "../util/kmsiCookieUtils";
import { SubmitCredentialsRequest, SubmitCredentialsResponse } from "../types/uiTypes";
import { getAuthErrorResponseForCode } from "../error/errorUtil";
import { ErrorResponse } from "../types/error";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  defaultMeta: { service: 'cred-submit-router' },
  transports: [
    // Write all logs with importance level of error or less to error.log
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // Write all logs with importance level of info or less to diagnostic.log
    new winston.transports.File({ filename: 'diagnostic.log' }),
  ],
});

// If we're not in production then log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug';
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

const BASE_CRED_SUBMIT_PATH = "/credsubmit";

const KMSI_MACHINE_ID_COOKIE = "dev_kmsi_id";
const KMSI_COOKIE_PREFIX = "kmsi_";

const ENROLL_SCENARIO = "ENROLLMENT";
const AUTH_SCENARIO = "AUTHENTICATION";

const PASSWORD_CHANGE_OP = "resetPassword";

const MILLISECONDS_IN_A_DAY = 86400000;

interface CredentialResultResponse {
  statusCode: number;
  response: SubmitCredentialsResponse;
  kmsiToken?: string;
  userId?: string;
  errorResponse: ErrorResponse;
}

function getCredentialSubmissionRouter(idcs: IdcsUtil, config: ServerConfig) {
  // The Router we are exporting
  const router = Router();

  // For the cookie expiry, setting to the max token use validity (in days).
  const KMSI_COOKIE_OPTIONS: CookieOptions = {
    signed: true,
    secure: config.ssl?.use_ssl || config.ssl?.is_ssl,
    httpOnly: true,
    maxAge: (config.idcs_config.kmsi_last_used_validity_in_days || 30) * MILLISECONDS_IN_A_DAY,
    sameSite: 'strict'
  };

  // Machine ID needs to persist for a much longer duration, lets use 4 years?
  const MACHINE_ID_COOKIE_OPTIONS: CookieOptions = {
    path: '/credsubmit',
    signed: true,
    secure: config.ssl?.use_ssl || config.ssl?.is_ssl,
    httpOnly: true,
    maxAge: 4 * 365 * MILLISECONDS_IN_A_DAY,
    sameSite: 'strict'
  };

  const KMSI_CLEAR_COOKIE_OPTIONS: CookieOptions = {
    secure: config.ssl?.use_ssl || config.ssl?.is_ssl,
    httpOnly: true,
    expires: new Date(0),
    sameSite: 'strict'
  };

  // Handler for parsing the request state returned from the call to authenticate
  // with IAM. Split out into a handler function since this is used across a
  // couple of calls.
  async function _handleCredentialResult(credResult: RequestState, originalRequestBody: SubmitCredentialsRequest, ip: string): Promise<CredentialResultResponse> {
    logger.debug("Handling the credential result after submitting credential.");
    // Reviewing the credResult is very helpful while developing, but potentially
    // leaks information.
    // logger.debug(JSON.stringify(credResult));
    // Handle all our different next steps...
    if (!credResult || !credResult.status) {
      logger.debug("Credential result was not present.");
      // Error calling to IDCS
      return {
        statusCode: 500,
        response: null,
        errorResponse: {
          code: errorConstants.CRED_SUBMISSION_FAILED,
          message: "Credential submission failed."
        }
      };
    }
    // Handle error responses from IDCS
    if (credResult.status === "failed") {
      let errorCode = "AUTH-1007"; // 'Authentication failed' code as default
      if (credResult.cause && Array.isArray(credResult.cause) && credResult.cause.length > 0) {
        logger.info("Credential submission failed with the following causes:")
        for (const error of credResult.cause) {
          logger.info(`${error.code}:${error.message}`);
        }
        // Technically IDCS could return multiple codes, but it doesn't seem to
        // so we will just assume the first one is correct
        errorCode = credResult.cause[0].code;
      }
      // Shape the error message to be end-user appropriate, also localise, etc.
      const { errorMessage, loginImpossible } = getAuthErrorResponseForCode(errorCode);
      // Pass back the authentication options
      const responseData: SubmitCredentialsResponse = {
        status: credResult.status,
        errorCode,
        errorMessage,
        requestState: credResult.requestState || ""
      }
      if (loginImpossible) {
        responseData.nextOp = [];
      }
      // Special Case for password expiry/must change
      if (errorCode === errorConstants.PASSWORD_MUST_CHANGE || errorCode === errorConstants.PASSWORD_EXPIRED) {
        try {
          const passwordMustChangeResponse: SubmitCredentialsResponse = {
            nextOp: [PASSWORD_CHANGE_OP],
            passwordPolicy: await idcs.getPasswordPolicyForUser(credResult.userId),
            requestState: credResult.requestState || originalRequestBody.requestState || ""
          }
          return {
            statusCode: 200,
            response: passwordMustChangeResponse,
            errorResponse: null
          };
        } catch (error) {
          logger.error("Error obtaining the password policy for a user.");
          logger.error(error);
          return {
            errorResponse: {
              code: errorConstants.CRED_SUBMISSION_FAILED,
              message: "Credential submission failed."
            },
            statusCode: 500,
            response: null
          }
        }
      }
      // Could reassign nextAuthFactors here, but the ones the UI is holding should be fine
      return {
        statusCode: 401,
        response: responseData,
        errorResponse: null
      };
    }
    /* If we have an authnToken, we have some behaviour which is unique to this login flow,
     * since we could swap signed in user between apps, so we don't actually create a session
     * in the client, we instead call the session endpoint server-side, then extract the redirect.
     *
     * Maybe this should be conditional, since in some situations we might want an SSO session?
     * Possibly if there are no stored KMSI settings and if we haven't specified KMSI? But we
     * don't have a handle on the former at this point.
     *
     * The other scenario in which we complete a flow is post MFA enrollment, in which we are able
     * to create a session or enroll an alternative factor. Lets assume we don't want an additional
     * factor, and just create a session. However, sometimes this requires additional followup, so
     * need to split out the handling.
     */
    let authnToken: string = credResult.authnToken || null;
    if (!authnToken && credResult.scenario === ENROLL_SCENARIO && credResult.nextOp.includes("createToken")) {
      try {
        const sessionResult = await idcs.createToken(credResult.requestState, originalRequestBody.keepMeSignedIn, ip);
        if (sessionResult.authnToken) {
          logger.debug("Obtained authnToken from createToken.");
          authnToken = sessionResult.authnToken;
        } else if (sessionResult.requestState) {
          // If there are subsequent login steps required, the seem to be populated here.
          credResult = sessionResult;
        } else {
          // Something went wrong.
          return {
            statusCode: 400,
            errorResponse: {
              code: errorConstants.COULD_NOT_CREATE_TOKEN,
              message: "Could not create a session from login state."
            },
            response: null
          };
        }
      } catch (error) {
        logger.error("Error creating token for a user.");
        logger.error(error);
        return {
          errorResponse: {
            code: errorConstants.CRED_SUBMISSION_FAILED,
            message: "Credential submission failed."
          },
          statusCode: 500,
          response: null
        };
      }

    }
    // Create a session if we have an AuthN Token - unless this is an optional MFA enrollment scenario
    if (authnToken && (!credResult.scenario || credResult.scenario !== ENROLL_SCENARIO) && (!credResult.mfaSettings || credResult.mfaSettings.enrollmentRequired === false)) {
      logger.debug("Login looks to be complete - calling session to determine redirect...");
      try {
        const postLoginRedirect = await idcs.getPostLoginRedirect(authnToken);
        if (!postLoginRedirect) {
          // Creating a session had issues?
          return {
            statusCode: 500,
            errorResponse: {
              code: errorConstants.SESSION_CREATE_FAILED,
              message: "Credential submission failed."
            },
            response: null
          };
        }
        const response: CredentialResultResponse = {
          response: {
            status: credResult.status,
            postLoginRedirect,
            requestState: ""
          },
          errorResponse: null,
          statusCode: 200
        }
        if (credResult.kmsiToken) {
          logger.debug("KMSI Token present in response, storing it in a cookie.");
          // We need to put a reference to the user in the cookie, so we can find it
          // to delete later. The KMSI utility encrypts it for us.
          let userId = deriveUserIdFromToken(authnToken);
          if (!userId) {
            logger.warn("No user id found in the authnToken.");
            userId = "";
          }
          response.userId = userId;
          response.kmsiToken = credResult.kmsiToken;
        }
        return response;
      } catch (error) {
        logger.error("Error obtaining the post-login redirect using an AuthN token.");
        logger.error(error);
        return {
          errorResponse: {
            code: errorConstants.CRED_SUBMISSION_FAILED,
            message: "Credential submission failed."
          },
          statusCode: 500,
          response: null
        };
      }

    }
    // TODO: Other handling stuffs

    // Assemble the next loginState so the UI can display next steps
    const credsResponse: SubmitCredentialsResponse = {
      status: credResult.status,
      nextOp: credResult.nextOp,
      nextAuthFactors: [],
      requestState: credResult.requestState,
      keepMeSignedInEnabled: credResult.keepMeSignedInEnabled,
      EnrolledAccountRecoveryFactorsDetails: credResult.EnrolledAccountRecoveryFactorsDetails || null,
      mfaSettings: credResult.mfaSettings || null,
      displayName: credResult.displayName,
      scenario: credResult.scenario,
      trustedDeviceSettings: credResult.trustedDeviceSettings
    };
    if (credResult.nextAuthFactors) {
      for (const factor of credResult.nextAuthFactors) {
        credsResponse.nextAuthFactors.push(factor);
        // Yey! Typescript. Since otherwise I might be assigning to invalid object shapes.
        switch (factor) {
          case "IDP":
            credsResponse.IDP = credResult.IDP;
            break;
          case "USERNAME_PASSWORD":
            credsResponse.USERNAME_PASSWORD = credResult.USERNAME_PASSWORD;
            break;
          case "EMAIL":
            credsResponse.EMAIL = credResult.EMAIL;
            break;
          case "SMS":
            credsResponse.SMS = credResult.SMS;
            break;
          case "TOU":
            credsResponse.TOU = credResult.TOU;
            break;
          case "KMSI":
            credsResponse.KMSI = credResult.KMSI;
            break;
          case "SECURITY_QUESTIONS":
            credsResponse.SECURITY_QUESTIONS = credResult.SECURITY_QUESTIONS;
            break;
          case "PUSH":
            credsResponse.PUSH = credResult.PUSH;
            break;
          case "BYPASSCODE":
            credsResponse.BYPASSCODE = credResult.BYPASSCODE;
            break;
          case "TOTP":
            credsResponse.TOTP = credResult.TOTP;
            break;
        }
      }
    } else {
      // No next auth factors. Need to capture the scenario in which there is a specific call to
      // initiate an particular Auth Factor, in which case that factor is not returned -
      // since it seems that it should be implied? So we add it explicitly here.
      if (credResult.scenario && credResult.scenario === AUTH_SCENARIO && originalRequestBody.authFactor) {
        credsResponse.nextAuthFactors = [originalRequestBody.authFactor]
      }
    }
    return {
      statusCode: 200,
      response: credsResponse,
      errorResponse: null
    };
  }




  router.post(BASE_CRED_SUBMIT_PATH, express.json(), async (req, res) => {
    logger.debug("Obtained a credential submission");
    if (!req.body.op || req.body.op !== "credSubmit") {
      const errRes: ErrorResponse = {
        code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
        message: "Invalid operation for /credsubmit endpoint"
      }
      return res.status(400).json(errRes);
    }
    if (!req.body.requestState || typeof req.body.requestState !== 'string') {
      const errRes: ErrorResponse = {
        code: errorConstants.SUBMIT_CREDS_MISSING_FIELDS,
        message: "Malformed request."
      }
      return res.status(400).json(errRes);
    }
    try {
      let credResult: RequestState;
      // Bubbling up the machine id so we can set it in a cookie if needed
      let machineId: string = req.signedCookies[KMSI_MACHINE_ID_COOKIE] || "";
      // KMSI requests should be sent to '/credsubmit/kmsi/:id', not here.
      if (req.body.kmsiToken) {
        const errRes: ErrorResponse = {
          code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
          message: "Invalid authentication method for /credsubmit endpoint"
        }
        return res.status(400).json(errRes);
      }
      let deviceName = req.body.kmsiDeviceDisplayName || "";
      if (typeof deviceName !== 'string') {
        const errRes: ErrorResponse = {
          code: errorConstants.SUBMIT_CREDS_MISSING_FIELDS,
          message: "Malformed request."
        }
        return res.status(400).json(errRes);
      }
      if (!req.body.credentials || typeof req.body.credentials !== 'object' || typeof req.body.keepMeSignedIn !== 'boolean') {
        const errRes: ErrorResponse = {
          code: errorConstants.SUBMIT_CREDS_MISSING_FIELDS,
          message: "Malformed request."
        }
        return res.status(400).json(errRes);
      }
      let keepMeSignedInRequested = false;
      if (req.body.keepMeSignedIn) {
        // Add a suffix to the Device Name so we can identify which KMSI token
        // we might need to clean up later. This needs to be based upon the
        // calling device - but we can just set a value and then return it in
        // a cookie later.
        if (!machineId) {
          machineId = generateMachineId();
        }
        deviceName = `${deviceName}_${machineId}`;
        // Check for the presence of a userIndex, which should have been
        // supplied if KMSI was requested. If not present, then we will still
        // handle the credential submit, but not honour the KMSI request.
        if (req.body.kmsiUserRef && typeof req.body.kmsiUserRef === "number") {
          keepMeSignedInRequested = true;
        }
      }
      credResult = await idcs.submitCredential(req.body.credentials, req.body.requestState, req.body.keepMeSignedIn, deviceName, req.ip);
      const handlerResult = await _handleCredentialResult(credResult, req.body, req.ip);
      if (handlerResult.errorResponse) {
        return res.status(handlerResult.statusCode).json(handlerResult.errorResponse);
      }
      if (handlerResult.kmsiToken) {
        // Set the cookies.
        const cookieValue = createKmsiCookie(handlerResult.kmsiToken, handlerResult.userId, config.cookie_signing_key);
        const kmsiCookieOptions = KMSI_COOKIE_OPTIONS;
        kmsiCookieOptions.path = BASE_CRED_SUBMIT_PATH + "/kmsi/" + req.body.kmsiUserRef;
        res.cookie(KMSI_COOKIE_PREFIX + req.body.kmsiUserRef, cookieValue, kmsiCookieOptions);
        // Set the Machine ID cookie if needed.
        if (!req.signedCookies[KMSI_MACHINE_ID_COOKIE] && machineId) {
          res.cookie(KMSI_MACHINE_ID_COOKIE, machineId, MACHINE_ID_COOKIE_OPTIONS);
        }
        // Indicate in the response that there was a token set, so that in the
        // UI the reference can be created in the storage if required
        handlerResult.response.kmsiTokenSet = true;
      }
      return res.status(handlerResult.statusCode).json(handlerResult.response);
    } catch (error) {
      logger.error(error);
      const errRes: ErrorResponse = {
        code: errorConstants.CRED_SUBMISSION_FAILED,
        message: "Credential submission failed."
      }
      return res.status(500).json(errRes);
    }
  })

  /*
   * Endpoint for KMSI token submission, on a userIndex path since that allows
   * for specifying which cookies to send, which is required when keeping the
   * token in a HTTPOnly cookie.
   */
  router.post('/credsubmit/kmsi/:userIndex', express.json(), async (req, res) => {
    logger.debug("Recieved a request to authenticate using KMSI.");
    if (!req.body.op || req.body.op !== "credSubmit") {
      const errRes: ErrorResponse = {
        code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
        message: "Invalid operation for /credsubmit/kmsi endpoint"
      }
      return res.status(400).json(errRes);
    }
    if (!req.body.requestState || typeof req.body.requestState !== 'string') {
      const errRes: ErrorResponse = {
        code: errorConstants.SUBMIT_CREDS_MISSING_FIELDS,
        message: "Malformed request."
      }
      return res.status(400).json(errRes);
    }
    // Check we have a cookie
    if (!req.signedCookies[KMSI_COOKIE_PREFIX + req.params.userIndex]) {
      // Could have expired or similar, so this isn't a malformed request,
      // instead trigger the 'additional authentication required' flow.
      const responseData: SubmitCredentialsResponse = {
        status: "failed",
        errorCode: "AUTH-1007",
        errorMessage: "Additional Authentication required",
        requestState: req.body.requestState
      }
      return res.status(401).json(responseData);
    }
    // Extract the cookie value
    const { kmsiToken } = splitKmsiCookie(req.signedCookies[KMSI_COOKIE_PREFIX + req.params.userIndex], config.cookie_signing_key);
    // Submit the request
    try {
      const credResult = await idcs.submitKmsi(kmsiToken, req.body.requestState, req.ip);
      // Handle cred-result
      const handlerResult = await _handleCredentialResult(credResult, req.body, req.ip);
      if (handlerResult.errorResponse) {
        return res.status(handlerResult.statusCode).json(handlerResult.errorResponse);
      }
      if (handlerResult.kmsiToken) {
        // Set the new KMSI cookie.
        const cookieValue = createKmsiCookie(handlerResult.kmsiToken, handlerResult.userId, config.cookie_signing_key);
        const kmsiCookieOptions = KMSI_COOKIE_OPTIONS;
        kmsiCookieOptions.path = req.path
        res.cookie(KMSI_COOKIE_PREFIX + req.params.userIndex, cookieValue, kmsiCookieOptions);
        // Although the UI doesn't need this (since it is using an existing ref),
        // setting the cookie set flag for consistency.
        handlerResult.response.kmsiTokenSet = true;
      }
      return res.status(handlerResult.statusCode).json(handlerResult.response);
    } catch (error) {
      logger.error(error);
      const errRes: ErrorResponse = {
        code: errorConstants.CRED_SUBMISSION_FAILED,
        message: "Credential submission failed."
      }
      return res.status(500).json(errRes);
    }

  });

  /*
   * Endpoint to create a session - only used if MFA enrollment
   * is optional and skipped.
   */
  router.post('/credsubmit/session', express.json(), async (req, res) => {
    logger.debug("Recieved a request to create session.");
    // Validate the body
    if (!req.body.op || req.body.op !== "createSession") {
      const errRes: ErrorResponse = {
        code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
        message: "Invalid operation for /session endpoint"
      }
      return res.status(400).json(errRes);
    }
    if (!req.body.requestState || typeof req.body.requestState !== 'string' || (req.body.keepMeSignedIn && !req.body.kmsiUserRef)) {
      const errRes: ErrorResponse = {
        code: errorConstants.CREATE_SESSION_MISSING_FIELDS,
        message: "Malformed request."
      }
      return res.status(400).json(errRes);
    }
    try {
      const sessionResult = await idcs.createToken(req.body.requestState, req.body.keepMeSignedIn, req.ip);
      if (!sessionResult.authnToken) {
        const errRes: ErrorResponse = {
          code: errorConstants.COULD_NOT_CREATE_TOKEN,
          message: "Could not create a session from login state."
        }
        return res.status(400).json(errRes);
      }
      const postLoginRedirect = await idcs.getPostLoginRedirect(sessionResult.authnToken);
      if (!postLoginRedirect) {
        // Creating a session had issues?
        const errRes: ErrorResponse = {
          code: errorConstants.SESSION_CREATE_FAILED,
          message: "Session creation failed."
        }
        return res.status(500).json(errRes);
      }
      const responseData: SubmitCredentialsResponse = {
        status: sessionResult.status,
        kmsiToken: "",
        postLoginRedirect,
        requestState: ""
      }
      if (sessionResult.kmsiToken) {
        logger.debug("KMSI Token present in response, splitting between cookie and response.");
        // We need to put a reference to the user in the cookie, so we can find it
        // to delete later. The KMSI utility encrypts it for us.
        let userId = deriveUserIdFromToken(sessionResult.authnToken);
        if (!userId) {
          logger.warn("No user id found in the authnToken.");
          userId = "";
        }
        // Set the cookies.
        const cookieValue = createKmsiCookie(sessionResult.kmsiToken, userId, config.cookie_signing_key);
        const kmsiCookieOptions = KMSI_COOKIE_OPTIONS;
        kmsiCookieOptions.path = BASE_CRED_SUBMIT_PATH + "/kmsi/" + req.body.kmsiUserRef
        res.cookie(KMSI_COOKIE_PREFIX + req.body.kmsiUserRef, cookieValue, kmsiCookieOptions);
      }
      return res.status(200).json(responseData);
    } catch (error) {
      logger.error("Error while creating session.")
      logger.error(error);
      const errRes: ErrorResponse = {
        code: errorConstants.SESSION_CREATE_FAILED,
        message: "Session creation failed."
      }
      return res.status(500).json(errRes);
    }
  })

  /*
   * Endpoint to remove KMSI sessions from IDCS, as well as clear the
   * associated cookies.
   * On /credsubmit/kmsi/:userIndex to allow for those restricted scope cookies to be accessed
   */
  router.post('/credsubmit/kmsi/:userIndex/clearkmsi', express.json(), async (req, res) => {
    logger.debug("Recieved a request to forget a user.");
    // Validate the body
    if (!req.body.op || req.body.op !== "clearKmsi") {
      const errRes: ErrorResponse = {
        code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
        message: "Invalid operation for clearkmsi endpoint"
      }
      return res.status(400).json(errRes);
    }
    // Check for the KMSI cookie
    if (!req.signedCookies[KMSI_COOKIE_PREFIX + req.params.userIndex]) {
      // Cookie expired, cleared? No way to obtain enough information, so
      // nothing to do here, let the client clean up the local storage and
      // consider it done.
      logger.debug("No valid cookie for the supplied token, cleanup can be performed client-side.")
      return res.status(204).end();
    }
    // Derive the correct userId from the cookies
    const kmsiInfo = splitKmsiCookie(req.signedCookies[KMSI_COOKIE_PREFIX + req.params.userIndex], config.cookie_signing_key)
    const clearCookieOptions = KMSI_CLEAR_COOKIE_OPTIONS;
    if (!kmsiInfo.userId) {
      logger.debug("Supplied cookie didn't have a userId, clearing it anyway.");
      clearCookieOptions.path = BASE_CRED_SUBMIT_PATH + "/kmsi/" + req.params.userIndex;
      res.clearCookie(KMSI_COOKIE_PREFIX + req.params.userIndex, clearCookieOptions);
      return res.status(204).end();
    }
    // Clear the KMSI Session from IDCS using the User ID and Machine ID
    const machineId: string = req.signedCookies[KMSI_MACHINE_ID_COOKIE] || "";
    logger.debug("Clearing KMSI session from IDCS...");
    try {
      await idcs.clearKmsiSession(kmsiInfo.userId, machineId, req.body.kmsiDeviceDisplayName);
    } catch (error) {
      logger.error("Error while trying to clear KMSI session from IAM.");
      logger.error(error);
      // Not bailing out, since we can still clear the client cookie
    }
    // Clear that user's cookies in the response
    logger.debug("Clearing KMSI cookie...");
    clearCookieOptions.path = BASE_CRED_SUBMIT_PATH + "/kmsi/" + req.params.userIndex;
    res.clearCookie(KMSI_COOKIE_PREFIX + req.params.userIndex, clearCookieOptions);
    return res.status(204).end();
  })

  return router;
}

export { getCredentialSubmissionRouter };