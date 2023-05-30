/*
 * Handler for managing expired/must-change passwords.
 */

import express, { Router } from "express";
import winston from "winston";
import errorConstants from "../error/errorConstants";
import { getAuthErrorResponseForCode, getPasswordResetErrorResponseForCode } from "../error/errorUtil";
import { SubmitCredentialsResponse } from "../types/uiTypes";
import IdcsUtil from "../util/idcsUtil";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  defaultMeta: { service: 'reset-password-router' },
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

const PASSWORD_CHANGE_OP = "resetPassword";

function getResetPasswordRouter(idcs: IdcsUtil) {
  // The Router we are exporting
  const router = Router();

  router.post('/setnewpassword', express.json(), async (req, res)=>{
    logger.debug("Obtained request to set new password");
    if(!req.body.op || req.body.op !== PASSWORD_CHANGE_OP){
      const errRes = {
        code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
        message: "Invalid operation for /setnewpassword endpoint"
      }
      return res.status(400).json(errRes);
    }
    if(!req.body.requestState || typeof req.body.requestState !== 'string' ||
       !req.body.oldPassword || typeof req.body.oldPassword !== 'string' ||
       !req.body.password || typeof req.body.password !== 'string' ||
       !req.body.userName || typeof req.body.userName !== 'string'){
      const errRes = {
        code: errorConstants.SET_PASSWORD_MISSING_FIELDS,
        message: "Malformed request."
      }
      return res.status(400).json(errRes);
    }
    // Attempt to change the password
    const passwordChangeError = await idcs.changePasswordMustChange(req.body.userName, req.body.oldPassword, req.body.password, req.ip);
    if(passwordChangeError){
      logger.debug(`Error while changing password: ${passwordChangeError}`);
      const responseData:SubmitCredentialsResponse = {
        status: "failed",
        errorMessage: getPasswordResetErrorResponseForCode(passwordChangeError),
        requestState: req.body.requestState || ""
      };
      return res.status(400).json(responseData);
    }
    logger.debug("Password set successfully.");
    // We have the login context, so can use this to immediately complete cred submit
    const credentials = {
      username: req.body.userName as string,
      password: req.body.password as string
    };
    const credResult = await idcs.submitCredential(credentials, req.body.requestState, false, "", req.ip);
    // logger.debug(JSON.stringify(credResult));
    // Handle the post submission requirements
    // Handle all our different next steps...
    if(!credResult || !credResult.status){
      // Error calling to IDCS
      const errRes = {
        code: errorConstants.CRED_SUBMISSION_FAILED,
        message: "Credential submission failed."
      }
      return res.status(500).json(errRes);
    }
    // Handle error responses from IDCS
    if(credResult.status === "failed"){
      let errorCode = "AUTH-1007"; // 'Authentication failed' code as default
      if(credResult.cause && Array.isArray(credResult.cause) && credResult.cause.length > 0){
        logger.info("Credential submission failed with the following causes:")
        for(const error of credResult.cause){
          logger.info(`${error.code}:${error.message}`);
        }
        // Technically IDCS could return multiple codes, but it doesn't seem to
        // so we will just assume the first one is correct
        errorCode = credResult.cause[0].code;
      }
      logger.debug(errorCode);
      // Shape the error message to be end-user appropriate, also localise, etc.
      const {errorMessage, loginImpossible } = getAuthErrorResponseForCode(errorCode);
      // Pass back the authentication options
      const responseData:SubmitCredentialsResponse = {
        status: credResult.status,
        errorCode,
        errorMessage,
        requestState: credResult.requestState || req.body.requestState
      }
      if(loginImpossible){
        responseData.nextOp = [];
      }
      return res.status(401).json(responseData);
    }
    if(credResult.authnToken){
      const authnToken = credResult.authnToken;
      logger.debug("Login looks to be complete - calling session to determine redirect...");
      const postLoginRedirect = await idcs.getPostLoginRedirect(authnToken);
      if(!postLoginRedirect){
        // Creating a session had issues?
        const errRes = {
          code: errorConstants.SESSION_CREATE_FAILED,
          message: "Credential submission failed."
        }
        return res.status(500).json(errRes);
      }
      const responseData:SubmitCredentialsResponse = {
        status: credResult.status,
        kmsiToken: "",
        postLoginRedirect,
        requestState: ""
      }
      res.status(200).json(responseData);
      return;
    }
    // TODO: Handle AccountRecoveryRequired... (accRecEnrollmentRequired:true)
    // Next Ops
    // Assemble the next loginState so the UI can display next steps
    const credsResponse:SubmitCredentialsResponse = {
      status: credResult.status,
      nextOp: credResult.nextOp,
      nextAuthFactors: [],
      requestState: credResult.requestState,
      keepMeSignedInEnabled: credResult.keepMeSignedInEnabled,
      EnrolledAccountRecoveryFactorsDetails: credResult.EnrolledAccountRecoveryFactorsDetails || null,
      mfaSettings: credResult.mfaSettings || null
    };
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
    return res.status(200).json(credsResponse);
  })

  return router;
}

export {getResetPasswordRouter};
