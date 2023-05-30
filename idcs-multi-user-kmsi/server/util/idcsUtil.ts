/*
 * Set of utility functions for IDCS.
 */
import { createDecipheriv, createVerify, createHash, publicEncrypt } from 'crypto';
import fetch, { Response } from 'node-fetch';
import winston from "winston";

import type { CountryCode, GenericCredentials, IdcsConfig, JWKSet, MfaCredential, PasswordPolicy, PasswordRecoveryOptions, PasswordRecoveryRequestResponse, RecoveryFactorValidationResponse, RecoveryOption, RequestState, SubmitCredential, TokenResponse, TrustedUserAgent } from '../types/idcsTypes.js';
import type { RequestOptions } from '../types/fetchRequest.js'
import {DEFAULT_COUNTRY_CODES} from '../res/defaultCountryCodes';
import { isCountryCodesAllowedValues, isPasswordPolicy, isResourceList, isTokenResponse, isTrustedUserAgent, isUserWithApplicablePasswordPolicy } from './idcsTypeUtil';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  defaultMeta: { service: 'idcs-utilities' },
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

// const defaultScopes = ["urn:opc:idm:t.security.client", "urn:opc:idm:t.user.signin"];

const IDCS_DEFAULT_SIGN_KID = "SIGNING_KEY";
const PEMCERTPRE = "-----BEGIN CERTIFICATE-----\n";
const PEMCERTPOST = "\n-----END CERTIFICATE-----";

const IDCS_AUTHN_FAIL_CONTENT_TYPE = "text/html";
const JSON_DATA_TYPE = "application/json";
const FORM_DATA_TYPE = "application/x-www-form-urlencoded"

const IDCS_API_ERROR_ATTR = "urn:ietf:params:scim:api:oracle:idcs:extension:messages:Error";
const PASSWORD_STATE_SCHEMA = "urn:ietf:params:scim:schemas:oracle:idcs:extension:passwordState:User";

const DEFAULT_PASSWORD_POLICY = "PasswordPolicy";

const USER_ID_ATTRIBUTE = "user_id";

const DEFAULT_PASSWORD_RESET_URI = "/ui/v1/resetpwd";

class IdcsUtil {
  config: IdcsConfig;
  clientToken: string;
  obfuscationKey: Buffer;
  signingCert: string;
  countryCodes: CountryCode[];
  passwordPolicies: {[key: string]: PasswordPolicy};

  constructor(config: IdcsConfig) {
    // validate the config
    if (!config || !config.base_url || !config.client_id || !config.client_secret) {
      const e = new Error("Invalid IDCS Config!");
      throw e;
    }
    this.config = config;
    this.clientToken = null;
    this.obfuscationKey = null;
    this.signingCert = null;
    this.countryCodes = null;
    this.passwordPolicies = null;
  }

  // Initialisation function to get a token and set up encryption keys
  async initialise() {
    try {
      const token = await this._getAccessToken();
      await this._deriveEncKeyFromToken(token);
      await this._getSigningCert();
    } catch (err) {
      logger.error(err);
      throw new Error("IDCS Utility failed to initialise!")
    }
  }


  // Helper function to wrap up the fetch call and manage tokens
  // Could be used to provide alternative Auth approaches in future
  async callIamEndpoint(options: RequestOptions, returnJSON?: boolean, returnResponse?: boolean): Promise<unknown> {
    // Assume we want JSON responses, so set it if not specified
    if (returnJSON === undefined) {
      returnJSON = true;
    }
    // Assume we don't normally want the raw response
    if (returnResponse === undefined) {
      returnResponse = false;
    }
    // Potentially handle non-token approaches (OCI Signing, whatever)
    if (!options.headers) {
      options.headers = {};
    }
    const token = await this._getAccessToken();
    // Put the token into the body if it is x-www-form-urlencoded (typically secure/session)
    if (options.headers['Content-Type'] === FORM_DATA_TYPE && options.body) {
      options.body += `&authorization=${token}`;
    } else {
      options.headers.Authorization = `Bearer ${token}`;
    }
    // Add the client IP so that sign-on policies work.
    if(options.clientIp){
      options.headers['X-Forwarded-For'] = options.clientIp;
    }
    // Turn off auto-redirect if we are manually handling the response
    if (returnResponse) {
      options.redirect = "manual";
    }
    try {
      let response = await fetch(this.config.base_url + options.url, options);
      // Retry if the token looks to have expired.
      // Can't rely on the status code, since invalid credential submission also returns 401,
      // can use the content type though - since it returns html for an invalid token
      if (response.status === 401 && response.headers.get("Content-Type") === IDCS_AUTHN_FAIL_CONTENT_TYPE) {
        logger.info("IDCS token expired - updating the token...");
        const newToken = await this._requestAccessToken();
        this.clientToken = newToken;
        logger.info("Obtained a new IDCS Token - repeating the failed invocation.");
        const newOptions = options;
        options.headers.Authorization = `Bearer ${newToken}`;
        const retryResponse = await fetch(this.config.base_url + newOptions.url, newOptions);
        if (retryResponse.status !== 401 || retryResponse.headers.get("Content-Type") !== IDCS_AUTHN_FAIL_CONTENT_TYPE) {
          response = retryResponse;
        }else{
          logger.error("Retry of request with new token also failed. Potential IDCS token issue!");
          return null;
        }
      }
      if (returnResponse) {
        return response;
      }
      if (response.ok) {
        if (returnJSON) {
          return await response.json();
        }
        // Assume the caller will handle parsing the response
        return await response.text();
      }
      if (response.status === 401) {
        // 401s are pretty common for failed credential submission, but also
        // could be an AuthZ error, startsWith incase encoding present
        if(response.headers.get("Content-Type").startsWith(JSON_DATA_TYPE)){
          const responseJson = await response.json();
          // If it isn't an API error, we can pass it back.
          if(!responseJson[IDCS_API_ERROR_ATTR]){
            if (returnJSON) {
              return responseJson;
            }
            return await response.text();
          }
          // This is an API error, which is bad.
          logger.error("API Error response from IDCS!");
          if(responseJson.details){
            logger.error(`Details: ${responseJson.details}`);
          }
          if(responseJson[IDCS_API_ERROR_ATTR].messageId){
            logger.error(`MessageId: ${responseJson[IDCS_API_ERROR_ATTR].messageId}`);
          }
          return null;
        }
      }
      // Something went wrong...
      logger.error(`Unexpected response from IDCS, status code: ${response.status}`);
      logger.error(await response.text());
      return null;
    } catch (err) {
      logger.error(err);
      return null;
    }
  }

  async beginEnrollment(authFactor:string, credentials: MfaCredential, requestState: string, clientIp:string): Promise<RequestState> {
    logger.debug("Submitting a Credential...");
    const options: RequestOptions = {
      url: '/sso/v1/sdk/authenticate',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        op: "enrollment",
        authFactor,
        credentials,
        requestState
      })
    };
    return await this.callIamEndpoint(options) as RequestState;
  }

  async submitCredential(credentials: SubmitCredential, requestState: string, keepMeSignedIn: boolean, keepMeSignedInDeviceName: string, clientIp:string): Promise<RequestState> {
    logger.debug("Submitting a Credential...");
    const options: RequestOptions = {
      url: '/sso/v1/sdk/authenticate',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        op: "credSubmit",
        credentials,
        requestState,
        keepMeSignedIn,
        kmsiDeviceDisplayName: keepMeSignedInDeviceName || "",
        ipAddress: clientIp
      })
    };
    return await this.callIamEndpoint(options) as RequestState;
  }

  async submitKmsi(kmsiToken: string, requestState: string, clientIp: string): Promise<RequestState> {
    logger.debug("Submitting a KMSI Token...");
    const options: RequestOptions = {
      url: '/sso/v1/sdk/authenticate',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        op: "credSubmit",
        requestState,
        kmsiToken
      })
    };
    return await this.callIamEndpoint(options) as RequestState;
  }

  async createToken(requestState: string, keepMeSignedIn: boolean, clientIp: string): Promise<RequestState> {
    logger.debug("Creating AuthN Token...");
    const options: RequestOptions = {
      url: '/sso/v1/sdk/authenticate',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        op: "createToken",
        requestState,
        keepMeSignedIn
      })
    };
    return await this.callIamEndpoint(options) as RequestState;
  }

  async getPostLoginRedirect(authnToken: string): Promise<string> {
    logger.debug("Creating a session to obtain the redirect information...");
    const options:RequestOptions = {
      url: "/sso/v1/sdk/secure/session",
      method: "POST",
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `authnToken=${authnToken}`
    };
    const sessionResponse = await this.callIamEndpoint(options, false, true) as Response;
    logger.debug(`Session call returned, redirect value was ${(sessionResponse.status !== 303 ||
      !sessionResponse.headers.get("Location"))?"not present!":"present."}`);
    if(sessionResponse.status !== 303 || !sessionResponse.headers.get("Location")){
      logger.error("Issue creating SSO session in IAM Response:");
      logger.error(await sessionResponse.text());
      return null;
    }
    return sessionResponse.headers.get("Location");
  }

  async requestCodeResend(requestState:string, clientIp:string):Promise<RequestState>{
    logger.debug("Requesting the OTP be resent...");
    const options: RequestOptions = {
      url: '/sso/v1/sdk/authenticate',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        op: "resendCode",
        requestState,
      })
    };
    return await this.callIamEndpoint(options) as RequestState;
  }

  async requestBackupFactors(requestState:string, clientIp:string): Promise<RequestState> {
    logger.debug("Requesting backup factors for user...");
    const options: RequestOptions = {
      url: '/sso/v1/sdk/authenticate',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        op: "getBackupFactors",
        requestState,
      })
    };
    return await this.callIamEndpoint(options) as RequestState;
  }

  async getCountryCodes():Promise<CountryCode[]>{
    logger.debug("Getting country codes...");
    // Check if we have this already loaded
    if(this.countryCodes){
      logger.debug("Country Codes were cached, returning.");
      return this.countryCodes;
    }
    const options:RequestOptions = {
      url: "/admin/v1/AllowedValues/countrycodes?attributes=attrValues.value,attrValues.label",
      method: "GET"
    }
    const countryCodes = await this.callIamEndpoint(options);
    if(isCountryCodesAllowedValues(countryCodes)){
      logger.debug("Country Codes retrieved from IDCS, returning.");
      this.countryCodes = countryCodes.attrValues;
      return this.countryCodes;
    }
    // Error, so I guess we load some defaults?
    logger.debug("Country Codes not present in IDCS, loading defaults.");
    this.countryCodes = DEFAULT_COUNTRY_CODES;
    return this.countryCodes;
  }

  // Attempt to identify and clear the KMSI session associated with a user, using
  // whichever identifiers we have available. Assuming well behaved users,
  // the userId and machineId should be available and sufficient.
  async clearKmsiSession(userId: string, machineId?: string, deviceName?: string): Promise<void> {
    logger.debug("Getting list of KMSI sessions for user...")
    // Clean up the userId just to ensure there are no injections
    userId = userId.replace(/\"/g, "").replace(/%22/g, "");
    const filter = `tokenType eq "KMSI" and user.value eq "${userId}"`
    const options: RequestOptions = {
      url: `/admin/v1/TrustedUserAgents?filter=${filter}&attributes=name`,
      method: "GET",
    };
    const kmsiSessionResponse = await this.callIamEndpoint(options);
    if (!kmsiSessionResponse) {
      logger.error("Could not retrieve KMSI sessions from IDCS.");
      return;
    }
    if(!isResourceList(kmsiSessionResponse)){
      logger.error("Response from TrustedUserAgents had no Resources. Malformed?");
      logger.error(JSON.stringify(kmsiSessionResponse));
      return;
    }
    if (kmsiSessionResponse.Resources.length === 0) {
      // No sessions to remove
      return;
    }
    const sessions = kmsiSessionResponse.Resources.filter(session => isTrustedUserAgent(session)) as TrustedUserAgent[];
    let idToDelete: string = null;
    // Happy path - do we have a session which ends with our machine id?
    if (machineId) {
      for (const session of sessions) {
        if (session.name.endsWith(`_${machineId}`)) {
          logger.debug("Found session for user with matching machineId.");
          idToDelete = session.id;
          break;
        }
      }
    }
    // If we didn't have a match, or didn't have a machineId, can we guess based upon browser string?
    if (!idToDelete && deviceName) {
      let countMatchingDevices = 0;
      for (const session of sessions) {
        if (session.name && session.name.startsWith(deviceName)) {
          countMatchingDevices++;
          idToDelete = session.id;
        }
      }
      if (countMatchingDevices !== 1) {
        idToDelete = null;
      }
    }
    if (!idToDelete) {
      logger.warn("No matching sessions found to delete from IDCS.");
      return;
    }
    const deleteOptions: RequestOptions = {
      url: `/admin/v1/TrustedUserAgents/${idToDelete}`,
      method: "DELETE",
    };
    logger.debug("Deleting KMSI session...");
    // Call IAM, simply requesting the raw response object, as it should be a 204,
    // with no response body, so need to try to parse it.
    await this.callIamEndpoint(deleteOptions, false, true);
    return;
  }

  async getPasswordPolicyForUser(userId?:string): Promise<PasswordPolicy> {
    logger.debug("Getting password policy for user...");
    // Fun quirk of the API design - user must change password returns a userId,
    // but retrieving an applicable password policy takes a userName, so we need
    // to get the policy from the user object, then grab the policy out of a
    // local policy cache.
    const policies = await this._getPasswordPolicies();
    if(userId){
      const options: RequestOptions = {
        url: `/admin/v1/Users/${userId}?attributes=${PASSWORD_STATE_SCHEMA}:applicablePasswordPolicy.value`,
        method: "GET",
      };
      const user = await this.callIamEndpoint(options);
      // Match the policy ids
      if(isUserWithApplicablePasswordPolicy(user) && policies[user[PASSWORD_STATE_SCHEMA].applicablePasswordPolicy.value]){
        logger.debug("Got password policy for user!");
        return policies[user[PASSWORD_STATE_SCHEMA].applicablePasswordPolicy.value];
      }
    }
    // Default policy
    if(policies[DEFAULT_PASSWORD_POLICY]){
      logger.debug("Returning default password policy.");
      return policies[DEFAULT_PASSWORD_POLICY];
    }
    logger.warn("No password policies available from IDCS. Returning a simple default policy.");
    return {
      minLength: 8,
      maxLength: 50
    };
  }

  async getPasswordRecoveryOptionsForUser(username:string, clientIp:string): Promise<PasswordRecoveryOptions> {
    logger.debug("Getting password recovery options for user...");
    const options: RequestOptions = {
      url: '/admin/v1/MePasswordRecoveryOptionRetriever',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        "schemas":["urn:ietf:params:scim:schemas:oracle:idcs:MePasswordRecoveryOptionRetriever"],
        "userName":username
      })
    };
    return await this.callIamEndpoint(options) as PasswordRecoveryOptions;
  }

  async initiatePasswordRecoveryForUser(username:string, method:RecoveryOption, clientIp:string, email?:string): Promise<PasswordRecoveryRequestResponse> {
    logger.debug("Initiating password recovery for user...");
    const options: RequestOptions = {
      url: '/admin/v1/MePasswordResetRequestor',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        "schemas":["urn:ietf:params:scim:schemas:oracle:idcs:MePasswordResetRequestor"],
        "userName":username,
        "notificationType": method,
        "notificationEmailAddress": email||null
      })
    };
    return await this.callIamEndpoint(options) as PasswordRecoveryRequestResponse;
  }

  async validatePasswordRecoveryFactor(username: string, method:string, requestId: string, deviceId: string, otpCode:string, clientIp: string): Promise<RecoveryFactorValidationResponse>{
    logger.debug("Validating password recovery factor for user...");
    const options: RequestOptions = {
      url: '/admin/v1/MePasswordRecoveryFactorValidator',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        "schemas":["urn:ietf:params:scim:schemas:oracle:idcs:MePasswordRecoveryFactorValidator"],
        "userName":username,
        "type": method,
        deviceId,
        requestId,
        otpCode
      })
    };
    // Actually need to parse the response here, since an invalid code uses 400 instead of 401
    const validatorResponse = await this.callIamEndpoint(options, false, true) as Response;
    if(validatorResponse.headers.get("Content-Type").startsWith(JSON_DATA_TYPE)){
      const response:RecoveryFactorValidationResponse = {}
      try{
        const validatorResponseJSON = await validatorResponse.json();
        if(validatorResponse.ok){
          response.token = validatorResponseJSON.token;
          response.passwordResetUri = this.config.reset_password_endpoint || this.config.base_url + DEFAULT_PASSWORD_RESET_URI;
          return response;
        }
        response.errorCode = validatorResponseJSON["urn:ietf:params:scim:api:oracle:idcs:extension:messages:Error"]?.messageId || null;
        response.errorDetail = validatorResponseJSON.detail || "Error validating code.";
        return response;
      }catch(err){
        logger.error("Could not parse response from MePasswordRecoveryFactorValidator!");
        logger.error("Response as text: " +await validatorResponse.text());
        return null;
      }
    }
    logger.error("Response from MePasswordRecoveryFactorValidator was not JSON!");
    logger.error("Response as text: " +await validatorResponse.text());
    return null;
  }


  // Set the users password after expiry. Returns an error code, or null if no error.
  async changePasswordMustChange(username:string, oldPassword:string, newPassword:string, clientIp:string): Promise<string>{
    const options:RequestOptions = {
      url: "/admin/v1/MePasswordMustChanger",
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      clientIp,
      body: JSON.stringify({
        schemas:["urn:ietf:params:scim:schemas:oracle:idcs:MePasswordMustChanger"],
        oldPassword,
        password: newPassword,
        mappingAttribute: "userName",
        mappingAttributeValue: username
      })
    }
    // Handle the response here, since some of the error codes are likely meaningful
    const changeResult = await this.callIamEndpoint(options, false, true) as Response;
    if(changeResult.ok){
      // Password changed successfully!
      return null;
    }
    // 400 is used as the error code here, for both policy issues
    // as well as invalid supplied passwords.
    if(changeResult.status === 400){
      const resultJSON = await changeResult.json();
      // The default behaviour is to simply display the detail, but that reveals
      // more information than I would like, so we will return the error code and
      // handle how that gets rendered in the higher level component.
      if(resultJSON[IDCS_API_ERROR_ATTR]?.messageId){
        return resultJSON[IDCS_API_ERROR_ATTR].messageId;
      }
      logger.warn("No error code returned on Password Must change");
      logger.warn(JSON.stringify(resultJSON));
      return "unknownError";
    }
    logger.warn(`Password Must Change returned an unexpected status: ${changeResult.status}`);
    logger.warn(await changeResult.text());
    return "unknownError";
  }

  async _getPasswordPolicies(): Promise<{[key: string]: PasswordPolicy}> {
    logger.debug("Getting password policies...");
    if(this.passwordPolicies){
      logger.debug("Polices already locally cached, returning.");
      return this.passwordPolicies;
    }
    this.passwordPolicies = {};
    const attributeString = "id,minLength,maxLength,minLowerCase,minUpperCase,minAlphas,minNumerals,"
    +"minAlphaNumerals,minSpecialChars,minUniqueChars,maxRepeatedChars,startsWithAlphabet,userNameDisallowed,"+
    "firstNameDisallowed,lastNameDisallowed,disallowedChars,requiredChars,numPasswordsInHistory";
    const options: RequestOptions = {
      url: `/admin/v1/PasswordPolicies?attributes=${attributeString}`,
      method: "GET",
    };
    const policyResources = await this.callIamEndpoint(options);
    if(isResourceList(policyResources)){
      logger.debug("Adding policies to local cache.");
      for(const policy of policyResources.Resources){
        if(isPasswordPolicy(policy)){
          const policyId = policy.id;
          if(policy.name){
            delete policy.name;
          }
          if(policy.id){
            delete policy.id;
          }
          this.passwordPolicies[policyId] = policy;
        }
      }
    }
    return this.passwordPolicies;
  }

  // Wrapper around the token handler
  async _getAccessToken(): Promise<string> {
    if (this.clientToken != null) {
      logger.debug("Client token was not null, returning it.")
      return this.clientToken;
    }
    this.clientToken = await this._requestAccessToken();
    return this.clientToken;
  }

  async _requestAccessToken(): Promise<string> {
    logger.debug("Getting new Client Token...");
    const form = {
      'grant_type': 'client_credentials',
      'scope': 'urn:opc:idm:__myscopes__'
    };
    const options = {
      url: this.config.base_url + '/oauth2/v1/token',
      method: "POST",
      headers: {
        'Authorization': 'Basic ' + Buffer.from(this.config.client_id + ':' + this.config.client_secret, 'utf8').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: Object.entries(form).map(v => v.join('=')).join('&')
    };
    try {
      const tokenRes = await fetch(options.url, options);
      const tokenJSON = await tokenRes.json();
      if(isTokenResponse(tokenJSON)){
        logger.debug("Got access token.");
        return tokenJSON.access_token;
      }
      logger.error("Response from IDCS doesn't seem to be an access token.")
      logger.error(JSON.stringify(tokenJSON));
      return null;
    } catch (err) {
      logger.error(err);
      return null;
    }
  }

  _deriveEncKeyFromToken(token: string) {
    logger.debug("Establishing encryption keys from client token...")
    // grab the tenant name out of the payload
    let tenantName;
    try {
      const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      tenantName = claims['user.tenant.name'];
    } catch (err) {
      logger.error(err);
      throw new Error("Error extracting the tenant information from the access token - will be unable to perform cryptographic operations.")
    }
    const hash = createHash('sha256')
      .update(tenantName)
      .digest();
    this.obfuscationKey = hash.subarray(0, 16);
    logger.debug("Key derived - length is " + this.obfuscationKey.byteLength);
  }

  decrypt(encrypted: string): string {
    if (this.obfuscationKey == null) {
      throw new Error("Call was made to decrypt before the encryption keys were set up!")
    }
    const iv = Buffer.alloc(16);
    iv.fill(0);
    const decipher = createDecipheriv('aes-128-cbc', this.obfuscationKey, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    logger.debug("Decrypted Login Context.");
    return decrypted;
  }

  validateSignature(prefix: string, data: string, sig?: string): void {
    const verifier = createVerify('sha256');
    if (!sig) {
      sig = data;
      data = "";
    }
    verifier.update(prefix, 'utf8');
    if (data) {
      verifier.update(data, 'utf8');
    }
    logger.debug("Verifying signature...");
    if (verifier.verify(this.signingCert, sig, 'base64')) {
      logger.debug("Signature successfully verified.");
      return;
    }
    else {
      logger.error("Signature did NOT verify!");
      throw new Error(("Invalid request. Please see server-side logs."));
    }
  }

  async _getSigningCert() {
    const options: RequestOptions = {
      url: '/admin/v1/SigningCert/jwk',
      method: "GET"
    };
    logger.debug("Invoking IDCS to obtain JWK.")
    const jwk = await this.callIamEndpoint(options) as JWKSet;
    if (!jwk) {
      throw new Error("Failed to obtain JWK!");
    }
    if (!jwk.keys || !Array.isArray(jwk.keys) || jwk.keys.length === 0) {
      throw new Error("Signing Certs Response from IDCS doesn't include signing keys!")
    }
    for (const key of jwk.keys) {
      if (key.kid === IDCS_DEFAULT_SIGN_KID) {
        // Should probably validate the cert-chain... but...
        // Instead simply validate thet the cert works
        const cert = PEMCERTPRE + key.x5c[0] + PEMCERTPOST;
        try {
          publicEncrypt(cert, Buffer.from("test"));
        } catch (ex) {
          logger.error("Error validating signing cert obtained from the IDCS JWK endpoint");
          logger.error(ex);
          throw new Error("Signing Cert received from IDCS seems to be malformed.");
        }
        logger.debug("Obtained signing cert and tested ok.")
        this.signingCert = cert;
        return;
      }
    }
    throw new Error("Signing Certs Response from IDCS doesn't signing keys with kid of '" + IDCS_DEFAULT_SIGN_KID + "'");
  }

}

function deriveUserIdFromToken(token: string): string {
  // Assume we have a JWT
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    logger.warn("Attempted to derive a user id from an invalid JWT. Wrong format.")
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString('utf8'));
    return payload[USER_ID_ATTRIBUTE] || null;
  } catch {
    logger.warn("Attempted to derive a user id from an invalid JWT. Not a JSON object.")
    return null;
  }

}

export default IdcsUtil;

export { deriveUserIdFromToken };