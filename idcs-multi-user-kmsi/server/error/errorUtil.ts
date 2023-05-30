/*
 * Set of utilities for handling errors that come back from IDCS
 */

import { AuthenticationErrorResponse } from "../types/error";
import errorConstants from "./errorConstants";

function getAuthErrorResponseForCode(errorCode:string):AuthenticationErrorResponse{
  switch(errorCode){
    case errorConstants.WRONG_USER_PASS:
      return {
        errorMessage:"You entered an incorrect user name or password.",
        loginImpossible:false
      };
    case errorConstants.LOGIN_CTX_EXPIRED_CODE:
      return {
        errorMessage:"Login has expired. Please attempt to access the application again.",
        loginImpossible: true
      };
    case errorConstants.SIGN_ON_POLICY_DENY:
      return {
        errorMessage:"Sign On Policy for the application denies access.",
        loginImpossible: true
      };
    case errorConstants.PASSWORD_MUST_CHANGE:
    case errorConstants.PASSWORD_EXPIRED:
      return {
        errorMessage:"You must set a new password.",
        loginImpossible: false
      }
    case errorConstants.APPROVAL_PENDING:
      return {
        errorMessage:"Push Notification approval is pending.",
        loginImpossible: false
      }
    case errorConstants.MAX_MFA_ATTEMPTS:
      return {
        errorMessage:"Max MFA attempts exceeded. Reset your password to unlock your account.",
        loginImpossible: true
      }
    case errorConstants.USER_MISMATCH:
      return {
        errorMessage:"The credentials you entered don't match your existing user session.",
        loginImpossible: false
      }
    default:
      return {
        errorMessage:"Unknown failure.",
        loginImpossible: false
      };
  }
}

// Transform the IDCS Error codes into something more meaningful.
// Could add localisation, etc
function getPasswordResetErrorResponseForCode(errorCode:string):string{
  switch(errorCode){
    case errorConstants.RESET_PASSWD_INVALID_PASSWD:
      return "Invalid current password";
    case errorConstants.RESET_PASSWD_POLICY_VIOLATION:
      return "Password does not satisfy password policy";
    default:
      return "Error when resetting password";
  }
}

export {getAuthErrorResponseForCode, getPasswordResetErrorResponseForCode};