/* tslint:disable:no-console */
/*
 * Abstraction of the API interations with the server component.
 */
import 'whatwg-fetch'

import { AuthFactor, MfaCredential, PasswordRecoveryOption, RecoveryOption, RequestState } from "../types/idcsTypes";
import { ClearKmsiRequest, SetPasswordRequest, SubmitCredentialsRequest, LoginStateResponse, SwitchEnrollmentRequest, BackupFactorRequest, InitiateEnrollmentRequest, CreateSessionRequest, AuthRequest, PasswordRecoveryState, ForgotPasswordResponse, ForgotPasswordRequest, ValidateRecoveryCodeRequest, ValidateRecoveryCodeResponse } from "../types/uiTypes";
import { deriveDeviceDisplayName } from "./deviceUtil";


const LOGIN_OPERATION = "credSubmit";
const PASSWORD_CHANGE_OPERATION = "resetPassword";
const CLEAR_KMSI_OPERATION = "clearKmsi";
const BACKUP_FACTORS_OPERATION = "getBackupFactors";
const ENROLL_OPERATION = "enrollment";
const CREATE_SESSION_OPERATION = "createSession";
const RESEND_CODE_OPERATION = "resendCode";
const FORGOT_PASSWORD_OPERATION = "forgotPassword";
const VALIDATE_CODE_OPERATION = "validateRecovery";

const KMSI_CREDENTIALS = "kmsiUserRef";

function mapResponseToNewRequestState(currentState: RequestState, credsResponse: LoginStateResponse): RequestState {
  // Initial clone of the state
  const newLoginState: RequestState = JSON.parse(JSON.stringify(currentState));
  newLoginState.status = credsResponse.status || newLoginState.status;
  newLoginState.requestState = credsResponse.requestState || newLoginState.requestState;
  newLoginState.nextOp = credsResponse.nextOp || newLoginState.nextOp;
  newLoginState.EnrolledAccountRecoveryFactorsDetails = credsResponse.EnrolledAccountRecoveryFactorsDetails || newLoginState.EnrolledAccountRecoveryFactorsDetails;
  newLoginState.mfaSettings = credsResponse.mfaSettings || newLoginState.mfaSettings;
  newLoginState.passwordPolicy = credsResponse.passwordPolicy || null;
  newLoginState.displayName = credsResponse.displayName || newLoginState.displayName || null;
  newLoginState.scenario = credsResponse.scenario || newLoginState.scenario || null;
  newLoginState.trustedDeviceSettings = credsResponse.trustedDeviceSettings || newLoginState.trustedDeviceSettings;
  if (credsResponse.nextAuthFactors) {
    newLoginState.nextAuthFactors = [];
    for (const factor of credsResponse.nextAuthFactors) {
      newLoginState.nextAuthFactors.push(factor);
      // Yey! Typescript. Since otherwise I might be assigning to invalid object shapes.
      switch (factor) {
        case "IDP":
          newLoginState.IDP = credsResponse.IDP;
          break;
        case "USERNAME_PASSWORD":
          newLoginState.USERNAME_PASSWORD = credsResponse.USERNAME_PASSWORD;
          break;
        case "EMAIL":
          newLoginState.EMAIL = credsResponse.EMAIL;
          break;
        case "SMS":
          newLoginState.SMS = credsResponse.SMS;
          break;
        case "TOU":
          newLoginState.TOU = credsResponse.TOU;
          break;
        case "KMSI":
          newLoginState.KMSI = credsResponse.KMSI;
          break;
        case "SECURITY_QUESTIONS":
          newLoginState.SECURITY_QUESTIONS = credsResponse.SECURITY_QUESTIONS;
          break;
        case "PUSH":
          newLoginState.PUSH = credsResponse.PUSH;
          break;
        case "BYPASSCODE":
          newLoginState.BYPASSCODE = credsResponse.BYPASSCODE;
          break;
        case "TOTP":
          newLoginState.TOTP = credsResponse.TOTP;
          break;
      }
    }
  }
  return newLoginState;
}

function mapResponseToNewPasswordRecoveryState(currentState: PasswordRecoveryState, recoveryResponse: ForgotPasswordResponse): PasswordRecoveryState {
  const newRecoveryState: PasswordRecoveryState = JSON.parse(JSON.stringify(currentState));
  newRecoveryState.notificationType = recoveryResponse.notificationType;
  newRecoveryState.notificationEmailAddress = recoveryResponse.notificationEmailAddress;
  newRecoveryState.options = recoveryResponse.options || [];
  newRecoveryState.deviceId = recoveryResponse.deviceId;
  newRecoveryState.requestId = recoveryResponse.requestId;
  return newRecoveryState
}

async function submitCredential(credentials: MfaCredential, authFactor: AuthFactor, keepMeSignedIn: boolean, kmsiUserRef:number, requestState: string): Promise<LoginStateResponse> {
  // Assemble the request body
  const data: SubmitCredentialsRequest = {
    op: LOGIN_OPERATION,
    credentials: {},
    authFactor,
    requestState,
    keepMeSignedIn,
    kmsiUserRef
  };
  for (const field of Object.keys(credentials)) {
    if (field === KMSI_CREDENTIALS) {
      // Use the alternative submission mechanism
      return await _submitKmsi(credentials[field] as number, requestState);
    }
    data.credentials[field] = credentials[field];
  }
  // Add the device description if we are requesting KMSI
  if (keepMeSignedIn) {
    data.kmsiDeviceDisplayName = deriveDeviceDisplayName();
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  // Submit via fetch
  try {
    const credsResponse = await fetch('/credsubmit', {
      method: "POST",
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    return await credsResponse.json() as LoginStateResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Handler for KMSI submission
async function _submitKmsi(kmsiUserRef:number, requestState:string){
  // Assemble the request body
  const data: SubmitCredentialsRequest = {
    op: LOGIN_OPERATION,
    requestState
  };
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  // Submit via fetch
  try {
    const credsResponse = await fetch(`/credsubmit/kmsi/${kmsiUserRef}`, {
      method: "POST",
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    return await credsResponse.json() as LoginStateResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function setNewPassword(userName: string, oldPassword: string, newPassword: string, requestState: string): Promise<LoginStateResponse> {
  const data: SetPasswordRequest = {
    op: PASSWORD_CHANGE_OPERATION,
    oldPassword,
    password: newPassword,
    requestState,
    userName
  };
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  try {
    const setPasswordResponse = await fetch('/setnewpassword', {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    return await setPasswordResponse.json() as LoginStateResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function clearKmsi(kmsiUserRef: number): Promise<boolean> {
  // Assemble the request body
  const data: ClearKmsiRequest = {
    op: CLEAR_KMSI_OPERATION,
    kmsiDeviceDisplayName: deriveDeviceDisplayName()
  };
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  const clearKmsiResponse = await fetch(`/credsubmit/kmsi/${kmsiUserRef}/clearkmsi`, {
    method: "POST",
    headers,
    credentials: 'same-origin',
    body: JSON.stringify(data)
  });
  if (!clearKmsiResponse.ok) {
    console.error("Error while clearing Kmsi session.");
    console.error(await clearKmsiResponse.text());
  }
  return clearKmsiResponse.ok;
}

async function switchEnrollment(requestState: string): Promise<LoginStateResponse> {
  // Assemble the request body
  const data: SwitchEnrollmentRequest = {
    op: "enrollment",
    requestState: this.state.loginState.requestState
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  try {
    const enrollmentResponse = await fetch('/enroll', {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    return await enrollmentResponse.json() as LoginStateResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function getBackupFactors(requestState: string): Promise<LoginStateResponse> {
  // Assemble the request body
  const data: BackupFactorRequest = {
    op: BACKUP_FACTORS_OPERATION,
    requestState
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  try {
    const backupFactorResponse = await fetch('/switchFactor', {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    return await backupFactorResponse.json() as LoginStateResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function initiateEnrollment(requestState: string, factorName: AuthFactor, credentials?: MfaCredential) {
  // Assemble the request body
  const data: InitiateEnrollmentRequest = {
    op: ENROLL_OPERATION,
    authFactor: factorName,
    credentials,
    requestState
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  try {
    const enrollmentResponse = await fetch('/enroll', {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    return await enrollmentResponse.json() as LoginStateResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function createSession(requestState: string, keepMeSignedIn: boolean, kmsiUserRef:number): Promise<LoginStateResponse> {
  // Assemble the request body
  const data: CreateSessionRequest = {
    op: CREATE_SESSION_OPERATION,
    requestState,
    keepMeSignedIn,
    kmsiUserRef
  };
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  try {
    const createSessionResponse = await fetch('/credsubmit/session', {
      method: "POST",
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    return await createSessionResponse.json() as LoginStateResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function requestNewCode(requestState: string): Promise<LoginStateResponse> {
  // Assemble the request body
  const data: AuthRequest = {
    op: RESEND_CODE_OPERATION,
    requestState
  };
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  try {
    const resendCodeResponse = await fetch('/resendcode', {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    return await resendCodeResponse.json() as LoginStateResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function initiateForgotPassword(userName:string, recoveryType?: PasswordRecoveryOption): Promise<ForgotPasswordResponse>{
  // Assemble the request body
  const data: ForgotPasswordRequest = {
    op: FORGOT_PASSWORD_OPERATION,
    userName
  };
  if (recoveryType) {
    data.notificationType = recoveryType.type;
    if (recoveryType.type === 'email') {
      data.notificationEmailAddress = recoveryType.value
    }
  }
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  try {
    const forgotPasswordResponse = await fetch('/forgotpassword', {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    return forgotPasswordResponse.json() as ForgotPasswordResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function validateRecoveryCode(userName: string, otpCode: string, recoveryType: RecoveryOption, deviceId:string, requestId:string):Promise<ValidateRecoveryCodeResponse> {
  // Assemble the request body
  const data: ValidateRecoveryCodeRequest = {
    op: VALIDATE_CODE_OPERATION,
    userName,
    notificationType: recoveryType,
    otpCode,
    deviceId,
    requestId
  };
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  try {
    const validatePasscodeResponse = await fetch('/forgotpassword/validate', {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    return validatePasscodeResponse.json() as ValidateRecoveryCodeResponse;
  } catch (error) {
    console.error(error);
    return null;
  }
}


export { mapResponseToNewRequestState, mapResponseToNewPasswordRecoveryState, submitCredential, setNewPassword, clearKmsi, switchEnrollment, getBackupFactors, initiateEnrollment, createSession, requestNewCode, initiateForgotPassword, validateRecoveryCode }