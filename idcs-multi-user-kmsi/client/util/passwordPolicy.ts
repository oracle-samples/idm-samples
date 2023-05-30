/*
 * Helper Utility for validating a supplied password against a password policy
 */

import { PasswordPolicy } from "../types/idcsTypes"
import { PasswordPolicyResponse } from "../types/uiTypes"



// minLength?: number;
// maxLength?: number;
// minLowerCase?: number;
// minUpperCase?: number;
// minAlphas?: number
// minNumerals?: number;
// minAlphaNumerals?: number;
// minSpecialChars?: number;
// minUniqueChars?: number;
// maxRepeatedChars
// startsWithAlphabet?: boolean;
// userNameDisallowed?: boolean;
// firstNameDisallowed?: boolean;
// lastNameDisallowed?: boolean;
// disallowedChars?: string;
// requiredChars
// numPasswordsInHistory?: number;

const ruleDescriptions = {
  minLength: (value:number) => {return `The password must have at least ${value} character${isPlural(value)}.`},
  maxLength: (value:number) => {return `The password cannot exceed ${value} character${isPlural(value)}.`},
  minLowerCase: (value:number) => {return `The password must have at least ${value} lowercase character${isPlural(value)}.`},
  minUpperCase: (value:number) => {return `The password must have at least ${value} uppercase character${isPlural(value)}.`},
  minNumerals: (value:number) => {return `The password must have at least ${value} numeric character${isPlural(value)}.`},
  minAlphaNumerals: (value:number) => {return `The password must have at least ${value} alpha-numeric character${isPlural(value)}.`},
  minSpecialChars: (value:number) => {return `The password must have at least ${value} special character${isPlural(value)}.`},
  minUniqueChars: (value:number) => {return `The password must have at least ${value} unique character${isPlural(value)}.`},
  maxRepeatedChars: (value:number) => {return `The password must not repeat the same character more than ${value} time${isPlural(value)}.`},
  startsWithAlphabet: () => {return `The password must start with a letter.`},
  userNameDisallowed: () => {return `The password must not contain the username.`},
  firstNameDisallowed: () => {return `The password must not contain the user's first name.`},
  lastNameDisallowed: () => {return `The password must not contain the user's last name.`},
  disallowedChars: (value:string) => {return `The password must not include the characters [${value}].`},
  requiredChars: (value:string) => {return `The password must include the characters [${value}] in any sequence.`},
  numPasswordsInHistory: (value:number) => {return `Cannot repeat last ${value} password${isPlural(value)}.`}
}


const specialCharacters = /[!@#$%^&*()_\-=+ ,\"'.,\/:;<>?\[\\\]`{|}~]/

// This probably needs externalising, and improved localisation, etc.
function isPlural(value:number){
  return value === 1?"":"s";
}

function validatePasswordComplexity(password:string, policy:PasswordPolicy, username?:string):PasswordPolicyResponse {
  const result:PasswordPolicyResponse = {rules:[]};
  if(!policy){
    return result;
  }
  // Check the password contents
  let countLower = 0;
  let countUpper = 0;
  let countNumber = 0;
  let countSpecial = 0;
  let countRepeated = 1;
  let maxRepeated = 1;
  const chars:{[key: string]: boolean} = {};
  for(let i=0; i<password.length; i++){
    if(i !== 0 && password[i-1] === password[i]){
      countRepeated++;
    }else{
      if(countRepeated > maxRepeated){
        maxRepeated = countRepeated;
      }
      countRepeated = 1;
    }
    chars[password[i]] = true;
    if(/[a-z]/.test(password[i])){
      countLower++;
      continue;
    }
    if(/[A-Z]/.test(password[i])){
      countUpper++;
      continue;
    }
    if(/[0-9]/.test(password[i])){
      countNumber++;
      continue;
    }
    if(specialCharacters.test(password[i])){
      countSpecial++;
    }
  }
  // Go through each of the rules in the policy object
  // (consistent ordering, so it doesn't affect the UI)
  if(policy.minLength){
    result.rules.push({
      description: ruleDescriptions.minLength(policy.minLength),
      evalOnSubmit: false,
      result: password.length >= policy.minLength
    });
  }
  if(policy.maxLength){
    result.rules.push({
      description: ruleDescriptions.maxLength(policy.maxLength),
      evalOnSubmit: false,
      result: password.length <= policy.maxLength
    });
  }
  if(policy.minLowerCase){
    result.rules.push({
      description: ruleDescriptions.minLowerCase(policy.minLowerCase),
      evalOnSubmit: false,
      result: countLower >= policy.minLowerCase
    });
  }
  if(policy.minUpperCase){
    result.rules.push({
      description: ruleDescriptions.minUpperCase(policy.minUpperCase),
      evalOnSubmit: false,
      result: countUpper >= policy.minUpperCase
    });
  }
  if(policy.minNumerals){
    result.rules.push({
      description: ruleDescriptions.minNumerals(policy.minNumerals),
      evalOnSubmit: false,
      result: countNumber >= policy.minNumerals
    });
  }
  if(policy.minAlphaNumerals){
    result.rules.push({
      description: ruleDescriptions.minAlphaNumerals(policy.minAlphaNumerals),
      evalOnSubmit: false,
      result: countLower+countUpper+countNumber >= policy.minAlphaNumerals
    });
  }
  if(policy.minSpecialChars){
    result.rules.push({
      description: ruleDescriptions.minSpecialChars(policy.minSpecialChars),
      evalOnSubmit: false,
      result: countSpecial >= policy.minSpecialChars
    });
  }
  if(policy.minUniqueChars){
    result.rules.push({
      description: ruleDescriptions.minUniqueChars(policy.minUniqueChars),
      evalOnSubmit: false,
      result: Object.keys(chars).length >= policy.minUniqueChars
    });
  }
  if(policy.maxRepeatedChars){
    result.rules.push({
      description: ruleDescriptions.maxRepeatedChars(policy.maxRepeatedChars),
      evalOnSubmit: false,
      result: maxRepeated <= policy.maxRepeatedChars
    });
  }
  if(policy.startsWithAlphabet){
    result.rules.push({
      description: ruleDescriptions.startsWithAlphabet(),
      evalOnSubmit: false,
      result: /[a-zA-Z]/.test(password[0])
    });
  }
  if(policy.userNameDisallowed){
    if(username){
      result.rules.push({
        description: ruleDescriptions.userNameDisallowed(),
        evalOnSubmit: false,
        result: !password.toLowerCase().includes(username.toLowerCase())
      });
    }else{
      result.rules.push({
        description: ruleDescriptions.userNameDisallowed(),
        evalOnSubmit: true
      });
    }
  }
  if(policy.firstNameDisallowed){
    result.rules.push({
      description: ruleDescriptions.firstNameDisallowed(),
      evalOnSubmit: true
    });
  }
  if(policy.lastNameDisallowed){
    result.rules.push({
      description: ruleDescriptions.lastNameDisallowed(),
      evalOnSubmit: true
    });
  }
  if(policy.disallowedChars){
    let noDisallowed = true;
    const disallowedCharsArr = policy.disallowedChars.split(",");
    for(const c of disallowedCharsArr){
      // Catch ',,' in the disallowed string
      if(c && password.indexOf(c) !== -1){
        noDisallowed = false;
        break;
      }
    }
    result.rules.push({
      description: ruleDescriptions.disallowedChars(policy.disallowedChars),
      evalOnSubmit: false,
      result: noDisallowed
    });
  }
  if(policy.requiredChars){
    let missingRequired = false;
    const requiredCharsArr = policy.requiredChars.split(",");
    for(const c of requiredCharsArr){
      if(password.indexOf(c) === -1){
        missingRequired = true;
        break;
      }
    }
    result.rules.push({
      description: ruleDescriptions.requiredChars(policy.requiredChars),
      evalOnSubmit: false,
      result: !missingRequired
    });
  }
  if(policy.numPasswordsInHistory){
    result.rules.push({
      description: ruleDescriptions.numPasswordsInHistory(policy.numPasswordsInHistory),
      evalOnSubmit: true
    });
  }
  return result;
}

export {validatePasswordComplexity}