/*
 * Handler for managing expired/must-change passwords.
 */

import express, { Router } from "express";
import winston from "winston";
import errorConstants from "../error/errorConstants";
import { ForgotPasswordResponse, ValidatePasscodeResponse } from "../types/uiTypes";
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

const PASSWORD_RECOVERY_OP = "forgotPassword";
const PASSWORD_RECOVERY_VALIDATE_OP = "validateRecovery";

function getForgetPasswordRouter(idcs: IdcsUtil) {
  // The Router we are exporting
  const router = Router();

  router.post('/forgotpassword', express.json(), async (req, res)=>{
    logger.debug("Obtained forgot password request...");
    if(!req.body.op || req.body.op !== PASSWORD_RECOVERY_OP){
      const errRes = {
        code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
        message: "Invalid operation for /forgotpassword endpoint"
      }
      return res.status(400).json(errRes);
    }
    if(!req.body.userName || typeof req.body.userName !== 'string'
      || (req.body.notificationType && typeof req.body.notificationType !== 'string')){
      const errRes = {
        code: errorConstants.FORGOT_PASSWORD_MISSING_FIELDS,
        message: "Malformed request."
      }
      return res.status(400).json(errRes);
    }
    const response:ForgotPasswordResponse = {
      userName: req.body.userName,
      options: []
    }
    // If we are just initiating a flow, i.e. we haven't selected a factor
    if(!req.body.notificationType){
      // Get the Password recovery options for the user
      const passwordOptions = await idcs.getPasswordRecoveryOptionsForUser(req.body.userName, req.ip);
      if(!passwordOptions){
        const errRes = {
          code: errorConstants.RECOVERY_DETAILS_FAILED,
          message: "Error while initiating password recovery."
        }
        return res.status(500).json(errRes);
      }
      if(passwordOptions){
        response.options = passwordOptions.options
      }
    }
    // Initate a flow if a factor was provided or if there was only one option available from the recovery options.
    if(req.body.notificationType || response.options.length === 1){
      const recoveryResponse = await idcs.initiatePasswordRecoveryForUser(req.body.userName, req.body.notificationType || response.options[0].type, req.ip, req.body.notificationEmailAddress || response.options[0].value||null);
      if(!recoveryResponse){
        const errRes = {
          code: errorConstants.RECOVERY_INITATION_FAILED,
          message: "Error while initiating password recovery."
        }
        return res.status(500).json(errRes);
      }
      response.notificationType = recoveryResponse.notificationType;
      response.deviceId = recoveryResponse.deviceId || null;
      response.requestId = recoveryResponse.requestId || null;
      delete response.options;
      return res.status(200).json(response);
    }
    return res.status(200).json(response);
  })

  router.post('/forgotpassword/validate', express.json(), async (req, res)=>{
    logger.debug("Obtained forgot password code validation request...");
    if(!req.body.op || req.body.op !== PASSWORD_RECOVERY_VALIDATE_OP){
      const errRes = {
        code: errorConstants.INVALID_OPERATION_FOR_ENDPOINT,
        message: "Invalid operation for /forgotpassword endpoint"
      }
      return res.status(400).json(errRes);
    }
    if(!req.body.userName || typeof req.body.userName !== 'string'
      || !req.body.notificationType || typeof req.body.notificationType !== 'string'
      || !req.body.otpCode || typeof req.body.otpCode !== 'string'
      || !req.body.deviceId || typeof req.body.deviceId !== 'string'
      || !req.body.requestId || typeof req.body.requestId !== 'string'){
      const errRes = {
        code: errorConstants.FORGOT_PASSWORD_MISSING_FIELDS,
        message: "Malformed request."
      }
      return res.status(400).json(errRes);
    }
    const validationResponse = await idcs.validatePasswordRecoveryFactor(req.body.userName, req.body.notificationType, req.body.requestId, req.body.deviceId, req.body.otpCode, req.ip);
    if(!validationResponse){
      const errRes = {
        code: errorConstants.RECOVERY_VALIDATION_FAILED,
        message: "Error while initiating password recovery."
      }
      return res.status(500).json(errRes);
    }
    const response: ValidatePasscodeResponse = {
      token: validationResponse.token || null,
      errorMessage: validationResponse.errorDetail || null,
      errorCode: validationResponse.errorCode || null,
      passwordResetUri: validationResponse.passwordResetUri || null
    }
    return res.status(200).json(response)
  })

  return router;
}

export {getForgetPasswordRouter};
