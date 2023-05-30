
interface IdcsConfig {
  base_url: string;
  client_id: string;
  client_secret: string;
  required_scopes: Array<string>;
  kmsi_last_used_validity_in_days?: number;
  reset_password_endpoint?: string;
}

interface RequestState {
  status?: "success" | "failed" | "pending";
  authnToken?: string;
  requestState: string;
  nextOp?: Array<string>;
  nextAuthFactors?: Array<AuthFactor>;
  //Various Authentication Factor types
  IDP?: IdentityProviderList;
  USERNAME_PASSWORD?: GenericCredentials;
  SMS?: GenericCredentials;
  TOU?: TermsOfUse;
  EMAIL?: EmailCredentials;
  KMSI?: GenericCredentials;
  SECURITY_QUESTIONS?: SecurityQuestionCredentials;
  PUSH?: PushCredentials;
  BYPASSCODE?: GenericCredentials;
  TOTP?: TimebasedOTPCredentials;
  //Used for MFA trust
  trustedDeviceSettings?: TrustedDeviceSettings;
  //KMSI Enabled
  keepMeSignedInEnabled?: boolean;
  //Error message if status is "failed" or "pending"
  cause?: Array<IdcsError>;
  //For when we need to do Reset Passwords or MFA
  EnrolledAccountRecoveryFactorsDetails?: RecoveryFactors;
  //MFA settings define whether we need to enroll
  mfaSettings?:MfaSettings;
  //Display name is used to show MFA factor details
  displayName?:string;
  scenario?:string;
  //UserId is returned for password must change
  userId?:string;
  passwordPolicy?: PasswordPolicy;
}

interface IdcsError {
  message: string;
  code: string;
}

interface IdcsResourceList {
  Resources: Array<unknown>;
  totalResults: number;
  startIndex?:number;
  itemsPerPage?:number;
}

interface GenericCredentials {
  credentials: Array<string>;
  enrolledDevices?: Array<Device>
}

interface IdentityProviderList extends GenericCredentials {
  configuredIDPs: Array<IdentityProvider>;
}

interface IdentityProvider {
  iconUrl: string;
  idpName: string;
  idpType: "Saml" | "Social"
}

interface TermsOfUse extends GenericCredentials {
  statement: string;
  locale: string;
}

interface EmailCredentials extends GenericCredentials {
  userAllowedToSetRecoveryEmail: string;
  primaryEmailVerified: string;
  primaryEmail: string;
}

interface SecurityQuestionCredentials extends GenericCredentials {
  secQuesSettings: SecurityQuestionSettings;
  securityQuestions: Array<SecurityQuestions>;
}

interface SecurityQuestionSettings {
  minAnswerLength: number;
  maxFieldLength: number;
  numQuestionsToAns: number;
  numQuestionsToSetup: number;
}

interface SecurityQuestions {
  questionId: string;
  text: string;
}

interface PushCredentials {
  qrCode?: QRCode;
  enrolledDevices?: Array<Device>;
}

interface TimebasedOTPCredentials extends GenericCredentials {
  qrCode?: QRCode;
}

interface QRCode {
  imageData: string;
  imageType: string;
  content: string;
}

interface TrustedDeviceSettings {
  trustDurationInDays: number;
}

type AuthFactor = "IDP" | "USERNAME_PASSWORD" | "SMS" | "TOU" | "EMAIL" | "KMSI" | "BYPASSCODE" | "TOTP" | "PUSH" | "SECURITY_QUESTIONS";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

interface JWKSet {
  keys: Array<Key>
}

interface Key {
  kty: string;
  x5t?: string;
  "x5t#S256"?: string;
  kid?: string;
  x5c: Array<string>;
  key_ops?: Array<KeyOptions>;
  alg: string;
  e?: string;
  n?: string;
}

type KeyOptions = "sign" | "verify" | "encrypt" | "decrypt" | "wrapKey" | "unwrapKey" | "deriveKey" | "deriveBits";

//There are plenty of other attributes on this, but we don't need them yet
interface TrustedUserAgent {
  id:string;
  trustToken:string;
  user?:UserReference;
  name?:string;
  expiryTime?:string;
  tokenType?:"KMSI"|"TRUSTED";
}

interface UserReference {
  value?:string;
  ocid?:string;
  "$ref"?:string;
}

interface RecoveryFactors {
  EMAIL?: RecoveryFactor;
  SMS?: RecoveryFactor;
  enrolledAccRecFactorsList?: Array<"EMAIL"|"SMS">;
}

interface RecoveryFactor {
  credentials: GenericCredentials;
  enrolledDevices: Array<Device>;
}

interface Device {
  deviceId?:string;
  displayName:string;
}

interface MfaSettings {
  enrollmentRequired:boolean;
}

interface MfaCredential {
  [key:string]: string|boolean|number;
}

interface CountryCodesAllowedValues {
  attrValues: Array<CountryCode>;
}

interface CountryCode {
  label: string;
  value: string;
}

interface PasswordPolicy {
  minLength?: number;
  maxLength?: number;
  minLowerCase?: number;
  minUpperCase?: number;
  minAlphas?: number
  minNumerals?: number;
  minAlphaNumerals?: number;
  minSpecialChars?: number;
  minUniqueChars?: number;
  maxRepeatedChars?: number;
  startsWithAlphabet?: boolean;
  userNameDisallowed?: boolean;
  firstNameDisallowed?: boolean;
  lastNameDisallowed?: boolean; 
  disallowedChars?: string;
  requiredChars?:string;
  numPasswordsInHistory?: number;
}

interface SubmitCredential {
  [key:string]: string|boolean;
}

interface PasswordRecoveryOptions {
  options: Array<PasswordRecoveryOption>;
}

interface PasswordRecoveryOption {
  type: RecoveryOption;
  value?: string;
}

interface PasswordRecoveryRequestResponse {
  userName: string;
  notificationType: RecoveryOption;
  notificationEmailAddress?: string;
  requestId?:string;
  deviceId?:string;
}

interface RecoveryFactorValidationResponse {
  token?: string;
  errorDetail?: string;
  errorCode?: string;
  passwordResetUri?:string;
}

type RecoveryOption = "email"|"sms"|"secquestions";



export { IdcsConfig, TokenResponse, JWKSet, RequestState, IdcsResourceList, GenericCredentials, IdentityProviderList, TermsOfUse, EmailCredentials, SecurityQuestionCredentials, PushCredentials, TimebasedOTPCredentials, TrustedUserAgent, MfaCredential, AuthFactor, CountryCode, PasswordPolicy, RecoveryFactors, SubmitCredential, PasswordRecoveryOptions, PasswordRecoveryOption, RecoveryOption, PasswordRecoveryRequestResponse, RecoveryFactorValidationResponse, CountryCodesAllowedValues };