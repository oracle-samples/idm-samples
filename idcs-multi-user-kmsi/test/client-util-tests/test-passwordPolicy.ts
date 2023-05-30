import { expect } from "chai";
import { PasswordPolicy } from "../../client/types/idcsTypes";
import { validatePasswordComplexity } from "../../client/util/passwordPolicy";

describe("Password Complexity Validation Utility", ()=>{
  it("Accepts an empty policy", ()=>{
    let policy:PasswordPolicy = {};
    let password = "password";
    let result = validatePasswordComplexity(password, policy);
    let expectedResult = {rules:[]};
    expect(result).to.deep.equal(expectedResult);
  });

  it("Ignores unknown attributes", ()=>{
    let policy:any = {randomattribute:6};
    let password = "password";
    let result = validatePasswordComplexity(password, policy);
    let expectedResult = {rules:[]};
    expect(result).to.deep.equal(expectedResult);
  });

  describe("Policy assessment", ()=>{
    describe("Min Password Length", ()=>{
      it("Reports on violation of min password length", ()=>{
        let policy:PasswordPolicy = {minLength:6};
        let password = "p";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must have at least 6 characters.");
      });
      it("Reports on satisfying min password length", ()=>{
        let policy:any = {minLength:6};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 6 characters.");
      });
      it("Handles Plurals", ()=>{
        let policy:any = {minLength:1};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 1 character.");
      });
    });
    describe("Max Password Length", ()=>{
      it("Reports on violation of max password length", ()=>{
        let policy:PasswordPolicy = {maxLength:6};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password cannot exceed 6 characters.");
      });
      it("Reports on satisfying max password length", ()=>{
        let policy:any = {maxLength:6};
        let password = "pass";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password cannot exceed 6 characters.");
      });
      it("Handles Plurals", ()=>{
        let policy:any = {maxLength:1};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password cannot exceed 1 character.");
      });
    });
    describe("Min Lower Case", ()=>{
      it("Reports on violation of Min Lower Case", ()=>{
        let policy:PasswordPolicy = {minLowerCase:2};
        let password = "PASSWORD";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must have at least 2 lowercase characters.");
      });
      it("Reports on satisfying Min Lower Case", ()=>{
        let policy:PasswordPolicy = {minLowerCase:2};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 2 lowercase characters.");
      });
      it("Handles Plurals", ()=>{
        let policy:PasswordPolicy = {minLowerCase:1};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 1 lowercase character.");
      });
    });
    describe("Min Upper Case", ()=>{
      it("Reports on violation of Min Upper Case", ()=>{
        let policy:PasswordPolicy = {minUpperCase:2};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must have at least 2 uppercase characters.");
      });
      it("Reports on satisfying Min Upper Case", ()=>{
        let policy:PasswordPolicy = {minUpperCase:2};
        let password = "PASSWORD";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 2 uppercase characters.");
      });
      it("Handles Plurals", ()=>{
        let policy:PasswordPolicy = {minUpperCase:1};
        let password = "PASSWORD";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 1 uppercase character.");
      });
    });
    describe("Min Numeric", ()=>{
      it("Reports on violation of Min Numeric", ()=>{
        let policy:PasswordPolicy = {minNumerals:2};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must have at least 2 numeric characters.");
      });
      it("Reports on satisfying Min Numeric", ()=>{
        let policy:PasswordPolicy = {minNumerals:2};
        let password = "PASSWORD12";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 2 numeric characters.");
      });
      it("Handles Plurals", ()=>{
        let policy:PasswordPolicy = {minNumerals:1};
        let password = "PASSWORD1";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 1 numeric character.");
      });
    });
    describe("Min Alpha-Numeric", ()=>{
      it("Reports on violation of Min Alpha-Numeric", ()=>{
        let policy:PasswordPolicy = {minAlphaNumerals:2};
        let password = "************";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must have at least 2 alpha-numeric characters.");
      });
      it("Reports on satisfying Min Alpha-Numeric", ()=>{
        let policy:PasswordPolicy = {minAlphaNumerals:2};
        let password = "PASSWORD12";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 2 alpha-numeric characters.");
      });
      it("Handles Plurals", ()=>{
        let policy:PasswordPolicy = {minAlphaNumerals:1};
        let password = "PASSWORD1";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 1 alpha-numeric character.");
      });
    });
    describe("Min Special Characters", ()=>{
      it("Reports on violation of Min Special Characters", ()=>{
        let policy:PasswordPolicy = {minSpecialChars:2};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must have at least 2 special characters.");
      });
      it("Reports on satisfying Min Special Characters", ()=>{
        let policy:PasswordPolicy = {minSpecialChars:2};
        let password = "$password^";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 2 special characters.");
      });
      it("Handles Plurals", ()=>{
        let policy:PasswordPolicy = {minSpecialChars:1};
        let password = "PASSWORD!";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 1 special character.");
      });
    });
    describe("Min Unique Characters", ()=>{
      it("Reports on violation of Min Unique Characters", ()=>{
        let policy:PasswordPolicy = {minUniqueChars:4};
        let password = "123123123";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must have at least 4 unique characters.");
      });
      it("Reports on satisfying Min Unique Characters", ()=>{
        let policy:PasswordPolicy = {minUniqueChars:4};
        let password = "123456789";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 4 unique characters.");
      });
      it("Handles Plurals", ()=>{
        let policy:PasswordPolicy = {minUniqueChars:1};
        let password = "PASSWORD!";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must have at least 1 unique character.");
      });
    });
    describe("Max Repeated Characters", ()=>{
      it("Reports on violation of Max Repeated Characters", ()=>{
        let policy:PasswordPolicy = {maxRepeatedChars:3};
        let password = "passssword";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must not repeat the same character more than 3 times.");
      });
      it("Reports on satisfying Max Repeated Characters", ()=>{
        let policy:PasswordPolicy = {maxRepeatedChars:3};
        let password = "passsword";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must not repeat the same character more than 3 times.");
      });
      it("Handles Plurals", ()=>{
        let policy:PasswordPolicy = {maxRepeatedChars:1};
        let password = "PASWORD!";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must not repeat the same character more than 1 time.");
      });
    });
    describe("Starts with Alphabet", ()=>{
      it("Reports on violation of Starts with Alphabet", ()=>{
        let policy:PasswordPolicy = {startsWithAlphabet:true};
        let password = "1password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must start with a letter.");
      });
      it("Reports on satisfying Starts with Alphabet", ()=>{
        let policy:PasswordPolicy = {startsWithAlphabet:true};
        let password = "password1";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must start with a letter.");
      });
    });
    describe("Disallow Username", ()=>{
      it("Reports on violation of Disallow Username when Username provided", ()=>{
        let policy:PasswordPolicy = {userNameDisallowed:true};
        let password = "123jsmithpassword123";
        let username = "jsmith"
        let result = validatePasswordComplexity(password, policy, username);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must not contain the username.");
      });
      it("Reports on violation of Disallow Username when Username provided, mixed case", ()=>{
        let policy:PasswordPolicy = {userNameDisallowed:true};
        let password = "123JSMITHpassword123";
        let username = "jSmith"
        let result = validatePasswordComplexity(password, policy, username);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must not contain the username.");
      });
      it("Returns evaluated on submission when username not supplied", ()=>{
        let policy:PasswordPolicy = {userNameDisallowed:true};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].evalOnSubmit).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must not contain the username.");
      });
      it("Reports on satisfying Disallow Username", ()=>{
        let policy:PasswordPolicy = {userNameDisallowed:true};
        let password = "password1";
        let username = "jsmith";
        let result = validatePasswordComplexity(password, policy, username);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must not contain the username.");
      });
    });
    describe("Disallow Name", ()=>{
      it("firstNameDisallowed returns evaluated on submission.", ()=>{
        let policy:PasswordPolicy = {firstNameDisallowed:true};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].evalOnSubmit).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must not contain the user's first name.");
      });
      it("lastNameDisallowed returns evaluated on submission.", ()=>{
        let policy:PasswordPolicy = {lastNameDisallowed:true};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].evalOnSubmit).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must not contain the user's last name.");
      });
    });
    describe("Disallowed Characters", ()=>{
      it("Reports on violation of Disallowed Characters", ()=>{
        let policy:PasswordPolicy = {disallowedChars:"%,s,t"};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must not include the characters [%,s,t].");
        //Test a few combinations
        password = "%paword";
        result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        password = "pawortss";
        result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
      });
      it("Reports on satisfying Disallowed Characters", ()=>{
        let policy:PasswordPolicy = {disallowedChars:"%,s,t"};
        let password = "paword";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must not include the characters [%,s,t,,].");
      });
      it("Reports on satisfying Disallowed Characters - null char in string", ()=>{
        let policy:PasswordPolicy = {disallowedChars:"%,s,t,,"};
        let password = "paword";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must not include the characters [%,s,t,,].");
      });
    });
    describe("Required Characters", ()=>{
      it("Reports on violation of Required Characters", ()=>{
        let policy:PasswordPolicy = {requiredChars:"%,s,t"};
        let password = "password";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        expect(result.rules[0].description).to.equal("The password must include the characters [%,s,t] in any sequence.");
        //Test a few combinations
        password = "%paword";
        result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
        password = "pawortss";
        result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(false);
      });
      it("Reports on satisfying Required Characters", ()=>{
        let policy:PasswordPolicy = {requiredChars:"%,s,t"};
        let password = "passwort%";
        let result = validatePasswordComplexity(password, policy);
        expect(result.rules[0].result).to.equal(true);
        expect(result.rules[0].description).to.equal("The password must include the characters [%,s,t] in any sequence.");
      });
    });
  });
  describe("Passwords in History", ()=>{
    it("firstNameDisallowed returns evaluated on submission.", ()=>{
      let policy:PasswordPolicy = {numPasswordsInHistory:2};
      let password = "password";
      let result = validatePasswordComplexity(password, policy);
      expect(result.rules[0].evalOnSubmit).to.equal(true);
      expect(result.rules[0].description).to.equal("Cannot repeat last 2 passwords.");
    });
    it("Handles Plurals.", ()=>{
      let policy:PasswordPolicy = {numPasswordsInHistory:1};
      let password = "password";
      let result = validatePasswordComplexity(password, policy);
      expect(result.rules[0].evalOnSubmit).to.equal(true);
      expect(result.rules[0].description).to.equal("Cannot repeat last 1 password.");
    });
  });
  it("Evaluates and returns multiple policy statements.", ()=>{
    let policy:PasswordPolicy = {minLength:2, maxLength:8, numPasswordsInHistory:2};
    let password = "longpassword";
    let result = validatePasswordComplexity(password, policy);
    let expectedResult = {rules:[
      {
        description: "The password must have at least 2 characters.",
        result: true,
        evalOnSubmit: false
      },
      {
        description: "The password cannot exceed 8 characters.",
        result: false,
        evalOnSubmit: false
      },
      {
        description: "Cannot repeat last 2 passwords.",
        evalOnSubmit: true
      }
    ]};
    expect(result).to.deep.equal(expectedResult);
  });
})
