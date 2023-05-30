/*
 * Handler for getting additional dynamic information from IDCS to facilitate
 * enrollment, validation, etc.
 */

import express, { Router } from "express";
import winston from "winston";
import errorConstants from "../error/errorConstants";
import { SubmitCredentialsResponse } from "../types/uiTypes";
import IdcsUtil from "../util/idcsUtil";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  defaultMeta: { service: 'mfa-router' },
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

// Cache for a week - used for Country Codes or other common values.
const CACHE_DURATION = 604800

const VALID_FACTORS = ["SMS","EMAIL","PUSH","SECURITY_QUESTIONS","TOTP","BYPASSCODE"];


function getMfaRouter(idcs: IdcsUtil) {
  // The Router we are exporting
  const router = Router();

  // Enrollment handler
  router.post('/enroll', express.json(), async (req, res) => {
    logger.debug("Obtained an enrollment request");
    // Validate the body
    if(!req.body.op || req.body.op !== "enrollment"){
      const errRes = {
        code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
        message: "Invalid operation for /enroll endpoint"
      }
      return res.status(400).json(errRes);
    }
    if(!req.body.requestState || typeof req.body.requestState !== 'string' ||
       (req.body.authFactor && (typeof req.body.authFactor !== 'string' || !VALID_FACTORS.includes(req.body.authFactor)))||
       (req.body.credentials && typeof req.body.credentials !== 'object') ){
      const errRes = {
        code: errorConstants.ENROLLMENT_MISSING_FIELDS,
        message: "Malformed request."
      }
      return res.status(400).json(errRes);
    }
    // Forward to IDCS
    const enrollmentResponse = await idcs.beginEnrollment(req.body.authFactor || null, req.body.credentials || {}, req.body.requestState, req.ip);
    if(!enrollmentResponse || !enrollmentResponse.status){
      logger.debug("No enrollment response.")
      // Error calling to IDCS
      const errRes = {
        code: errorConstants.ENROLLMENT_SUBMISSION_FAILED,
        message: "Enrollment submission failed."
      }
      return res.status(500).json(errRes);
    }
    if(enrollmentResponse.status === "failed"){
      let errorCode = "AUTH-1007"; // 'Authentication failed' code as default
      let errorMessage = "Error during enrollment";
      if(enrollmentResponse.cause && Array.isArray(enrollmentResponse.cause) && enrollmentResponse.cause.length > 0){
        logger.info("Enrollment initiation failed with the following causes:")
        for(const error of enrollmentResponse.cause){
          logger.info(`${error.code}:${error.message}`);
        }
        // Technically IDCS could return multiple codes, but it doesn't seem to
        // so we will just assume the first one is correct
        errorCode = enrollmentResponse.cause[0].code;
        errorMessage = enrollmentResponse.cause[0].message;
      }
      // TODO: Shape the error message to be end-user appropriate, also localise, etc.
      // const {errorMessage, loginImpossible } = getErrorResponseForCode(errorCode);
      // Pass back the authentication options
      const responseData:SubmitCredentialsResponse = {
        status: enrollmentResponse.status,
        errorCode,
        errorMessage,
        requestState: enrollmentResponse.requestState || ""
      }
      // Could reassign nextAuthFactors here, but the ones the UI is holding should be fine
      return res.status(401).json(responseData);
    }
    // Success!
    // Assemble the next loginState so the UI can display next steps
    const enrollResponse:SubmitCredentialsResponse = {
      status: enrollmentResponse.status,
      nextOp: enrollmentResponse.nextOp,
      displayName: enrollmentResponse.displayName || null,
      requestState: enrollmentResponse.requestState,
      EnrolledAccountRecoveryFactorsDetails: enrollmentResponse.EnrolledAccountRecoveryFactorsDetails || null,
      mfaSettings: enrollmentResponse.mfaSettings || null
    };
    // Do we need followup credentials - for instance SMS numbers, but also if we are resetting
    // which factor we are using.
    switch (req.body.authFactor) {
      case "EMAIL":
        enrollResponse.EMAIL = enrollmentResponse.EMAIL;
        break;
      case "SMS":
        enrollResponse.SMS = enrollmentResponse.SMS;
        break;
      case "SECURITY_QUESTIONS":
        enrollResponse.SECURITY_QUESTIONS = enrollmentResponse.SECURITY_QUESTIONS;
        break;
      case "PUSH":
        enrollResponse.PUSH = enrollmentResponse.PUSH;
        break;
      case "BYPASSCODE":
        enrollResponse.BYPASSCODE = enrollmentResponse.BYPASSCODE;
        break;
      case "TOTP":
        enrollResponse.TOTP = enrollmentResponse.TOTP;
        break;
      default:
        // No factor specified?
        if(enrollmentResponse.nextAuthFactors){
          enrollResponse.nextAuthFactors = [];
          // This is a 'change enrollment factor' response
          for (const factor of enrollmentResponse.nextAuthFactors) {
            enrollResponse.nextAuthFactors.push(factor);
            // Yey! Typescript. Since otherwise I might be assigning to invalid object shapes.
            switch (factor) {
              case "IDP":
                enrollResponse.IDP = enrollmentResponse.IDP;
                break;
              case "USERNAME_PASSWORD":
                enrollResponse.USERNAME_PASSWORD = enrollmentResponse.USERNAME_PASSWORD;
                break;
              case "EMAIL":
                enrollResponse.EMAIL = enrollmentResponse.EMAIL;
                break;
              case "SMS":
                enrollResponse.SMS = enrollmentResponse.SMS;
                break;
              case "TOU":
                enrollResponse.TOU = enrollmentResponse.TOU;
                break;
              case "KMSI":
                enrollResponse.KMSI = enrollmentResponse.KMSI;
                break;
              case "SECURITY_QUESTIONS":
                enrollResponse.SECURITY_QUESTIONS = enrollmentResponse.SECURITY_QUESTIONS;
                break;
              case "PUSH":
                enrollResponse.PUSH = enrollmentResponse.PUSH;
                break;
              case "BYPASSCODE":
                enrollResponse.BYPASSCODE = enrollmentResponse.BYPASSCODE;
                break;
              case "TOTP":
                enrollResponse.TOTP = enrollmentResponse.TOTP;
                break;
            }
          }
        }
    }
    return res.status(200).json(enrollResponse);
  });

  router.post('/resendcode', express.json(), async (req, res)=>{
    logger.debug("Obtained a request to resend the code");
    // Validate the body
    if(!req.body.op || req.body.op !== "resendCode"){
      const errRes = {
        code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
        message: "Invalid operation for /resendcode endpoint"
      }
      return res.status(400).json(errRes);
    }
    if(!req.body.requestState || typeof req.body.requestState !== 'string'){
      const errRes = {
        code: errorConstants.RESEND_MISSING_FIELDS,
        message: "Malformed request."
      }
      return res.status(400).json(errRes);
    }
    // Forward to IDCS
    const resendResponse = await idcs.requestCodeResend(req.body.requestState, req.ip);
    if(!resendResponse || !resendResponse.status){
      // Error calling to IDCS
      const errRes = {
        code: errorConstants.RESEND_CODE_FAILED,
        message: "Resend Code failed."
      }
      return res.status(500).json(errRes);
    }
    if(resendResponse.status === "failed"){
      let errorCode = "AUTH-1007"; // 'Authentication failed' code as default
      let errorMessage = "Error when resending code";
      if(resendResponse.cause && Array.isArray(resendResponse.cause) && resendResponse.cause.length > 0){
        logger.info("Resend Code failed with the following causes:")
        for(const error of resendResponse.cause){
          logger.info(`${error.code}:${error.message}`);
        }
        // Technically IDCS could return multiple codes, but it doesn't seem to
        // so we will just assume the first one is correct
        errorCode = resendResponse.cause[0].code;
        errorMessage = resendResponse.cause[0].message;
      }
      // TODO: Shape the error message to be end-user appropriate, also localise, etc.
      // Pass back the authentication options
      const responseData:SubmitCredentialsResponse = {
        status: resendResponse.status,
        errorCode,
        errorMessage,
        requestState: resendResponse.requestState || ""
      }
      // Could reassign nextAuthFactors here, but the ones the UI is holding should be fine
      return res.status(401).json(responseData);
    }
    // Success!
    // Assemble the next loginState so the UI can display next steps,
    // Only request state needs updating.
    const resendCodeResponse:SubmitCredentialsResponse = {
      status: resendResponse.status,
      nextOp: resendResponse.nextOp,
      displayName: resendResponse.displayName || null,
      requestState: resendResponse.requestState,
    };
    return res.status(200).json(resendCodeResponse);
  });

  // Data method for SMS country codes
  router.get('/res/countrycodes', async (req, res) => {
    logger.debug("Getting country codes...");
    const countryCodes = await idcs.getCountryCodes();
    // Pretty sure this always returns a result, since we load defaults, but
    // since that implementation may change...
    if(!countryCodes){
      logger.error("No country codes returned from IDCS.")
      const errRes = {
        code: errorConstants.NO_COUNTRY_CODES,
        message: "Could not obtain country codes."
      }
      return res.status(500).json(errRes);
    }
    // Set cache headers on this one, since it is very cachable
    res.setHeader('Cache-Control', `max-age=${CACHE_DURATION}`);
    return res.json(countryCodes);
  });



  return router;
}

export {getMfaRouter};