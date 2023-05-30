import { AuthFactor, MfaCredential, PasswordRecoveryOption, RecoveryOption, RequestState } from "./idcsTypes";

interface SubmitCredentialsRequest {
  op: "credSubmit";
  requestState: string;
  credentials?: MfaCredential;
  keepMeSignedIn?:boolean;
  kmsiUserIndex?:string;
  kmsiDeviceDisplayName?:string;
  authFactor?:AuthFactor;
}

interface SubmitCredentialsResponse extends RequestState {
  //These are extensions to what comes back from IDCS
  errorCode?: string;
  errorMessage?: string;
  postLoginRedirect?: string;
  kmsiTokenSet?:boolean;
}

//Merged RecoveryOptions and ResetRequestor response object
interface ForgotPasswordResponse {
  options?: Array<PasswordRecoveryOption>;
  notificationType?: RecoveryOption;
  notificationEmailAddress? : string;
  userName?: string;
  //SMS recovery options
  deviceId?:string;
  requestId?:string;
}

interface ValidatePasscodeResponse {
  token?: string;
  errorMessage?: string;
  errorCode?: string;
  passwordResetUri?:string;
}

export { SubmitCredentialsRequest, SubmitCredentialsResponse, ForgotPasswordResponse, ValidatePasscodeResponse };