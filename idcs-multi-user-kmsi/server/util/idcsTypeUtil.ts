/*
 * Set of Type Checking utility functions for IDCS, since we return unknown from
 * the callIamEndpoint helper function.
 */

import { stringify } from "querystring";
import { CountryCodesAllowedValues, IdcsResourceList, PasswordPolicy, RequestState, TokenResponse, TrustedUserAgent, User } from "../types/idcsTypes";

const PASSWORD_POLICY_ATTRIBUTES = ["name", "id", "minLength", "maxLength", "minLowerCase", "minUpperCase", "minAlphas", "minNumerals", "minAlphaNumerals", "minSpecialChars", "minUniqueChars", "maxRepeatedChars", "startsWithAlphabet", "userNameDisallowed", "firstNameDisallowed", "lastNameDisallowed", "disallowedChars", "requiredChars", "numPasswordsInHistory"];
const PASSWORD_STATE_SCHEMA = "urn:ietf:params:scim:schemas:oracle:idcs:extension:passwordState:User";

function isTokenResponse(obj: any): obj is TokenResponse {
  return obj.access_token && typeof obj.access_token === 'string' && obj.token_type && typeof obj.token_type === 'string' && obj.expires_in && typeof obj.expires_in === 'number';
}

function isResourceList(obj: any): obj is IdcsResourceList {
  return obj.Resources && Array.isArray(obj.Resources) && obj.totalResults && typeof obj.totalResults === 'number';
}

function isCountryCodesAllowedValues(obj: any): obj is CountryCodesAllowedValues {
  return obj.attrValues && Array.isArray(obj.attrValues);
}

function isTrustedUserAgent(obj: any): obj is TrustedUserAgent {
  return obj.id && typeof obj.id === "string" && obj.name && typeof obj.name === "string" && obj.trustToken && typeof obj.trustToken === "string";
}

function isPasswordPolicy(obj: any): obj is PasswordPolicy {
  for (const key of Object.keys(obj)) {
    if (!PASSWORD_POLICY_ATTRIBUTES.includes(key)) {
      return false;
    }
  }
  return true;
}

function isUserWithApplicablePasswordPolicy(obj: any): obj is Partial<User> {
  return obj[PASSWORD_STATE_SCHEMA]?.applicablePasswordPolicy?.value && typeof obj[PASSWORD_STATE_SCHEMA]?.applicablePasswordPolicy?.value === "string";
}

export { isResourceList, isCountryCodesAllowedValues, isTrustedUserAgent, isPasswordPolicy, isTokenResponse, isUserWithApplicablePasswordPolicy }