import { AuthFactor, EmailCredentials, GenericCredentials, MfaCredential, PasswordRecoveryOption, PushCredentials, RecoveryFactors, RecoveryOption, RequestState, SecurityQuestionCredentials, TimebasedOTPCredentials } from "./idcsTypes";

interface InterfaceCredentials {
  [key: string]: string;
}
interface LoginStateResponse extends RequestState {
  //These are extensions to what comes back from IDCS
  kmsiTokenSet?:boolean;
  errorCode?: string;
  errorMessage?: string;
  postLoginRedirect?: string;
}

interface PasswordRecoveryState {
  notificationType?: RecoveryOption
  options?: Array<PasswordRecoveryOption>;
  notificationEmailAddress? : string;
  recoveryNotificationDisplay?: string;
  //SMS recovery options
  deviceId?:string;
  requestId?:string;
}


interface AuthRequest {
  op: string;
  requestState: string;
}

interface SubmitCredentialsRequest extends AuthRequest{
  op: "credSubmit";
  credentials?: MfaCredential;
  keepMeSignedIn?:boolean;
  kmsiUserRef?:number;
  kmsiDeviceDisplayName?:string;
  authFactor?:string;
}

interface ClearKmsiRequest {
  op:"clearKmsi";
  kmsiDeviceDisplayName:string;
}

interface KMSIConfiguration {
  displayName: string;
  ref: number;
}

interface CreateSessionRequest extends AuthRequest{
  op:"createSession";
  keepMeSignedIn: boolean;
  kmsiUserRef?:number
}

interface InitiateEnrollmentRequest extends AuthRequest {
  op:"enrollment";
  authFactor: AuthFactor;
  credentials?: MfaCredential;
}

interface SwitchEnrollmentRequest extends AuthRequest {
  op:"enrollment";
}

interface BackupFactorRequest extends AuthRequest {
  op:"getBackupFactors";
}

interface CountryCode {
  value:string;
  label:string;
}

interface PasswordPolicyResponse {
  rules: Array<RuleResult>
}

interface RuleResult {
  description: string;
  evalOnSubmit: boolean;
  //True if the rule is satisfied
  result?: boolean;
}

interface SetPasswordRequest {
  op:"resetPassword";
  requestState: string;
  oldPassword: string;
  password: string;
  userName: string;
}

interface LoginMethod {
  factor: AuthFactor;
  displayName: string;
  deviceId?: string;
}

interface ForgotPasswordRequest {
  op:"forgotPassword";
  userName: string;
  notificationType?: RecoveryOption;
  notificationEmailAddress?: string;
}

interface ForgotPasswordResponse {
  options?: Array<PasswordRecoveryOption>;
  notificationType?: RecoveryOption;
  notificationEmailAddress? : string;
  userName?: string;
  //SMS recovery options
  deviceId?:string;
  requestId?:string;
}

interface ValidateRecoveryCodeRequest {
  op: "validateRecovery",
  userName: string;
  notificationType: RecoveryOption,
  otpCode: string;
  deviceId: string;
  requestId: string;
}

interface ValidateRecoveryCodeResponse {
  token?: string;
  errorMessage?: string;
  errorCode?: string;
  passwordResetUri?:string;
}


export { InterfaceCredentials, SubmitCredentialsRequest, KMSIConfiguration, LoginStateResponse, ClearKmsiRequest, CreateSessionRequest, CountryCode, InitiateEnrollmentRequest, AuthRequest, PasswordPolicyResponse, SetPasswordRequest, SwitchEnrollmentRequest, BackupFactorRequest, LoginMethod, ForgotPasswordRequest, ForgotPasswordResponse, PasswordRecoveryState, ValidateRecoveryCodeRequest, ValidateRecoveryCodeResponse };