function IdcsAuthnSDK(app) {

  this.app = app;

  this.sdkErrors = {
    // 9000 series: Errors coming from server-side initialization
    error9000 : {code: 'SDK-AUTH-9000', msg : 'Stored Access Token not found.'},
    error9001 : {code: 'SDK-AUTH-9001', msg : 'Initial state not found.'},
    // 9010 series: Unknown Errors during authentication
    error9010 : {code: 'SDK-AUTH-9010', msg : 'Unknown error occurred.'},
    error9011 : {code: 'SDK-AUTH-9011', msg : 'Unrecognized status returned by authenticate.'},
    // 9020 series: Password reset errors
    error9020 : {code: 'SDK-AUTH-9020', msg : 'Validation failed. Your reset password link might have expired.'},
    error9021 : {code: 'SDK-AUTH-9021', msg : 'Chosen password violates one or more policies.'},
    // Invalid payload
    error9999 : {code: 'SDK-AUTH-9999', msg : 'System error: invalid data. Please contact the administrator.'}
  };

  this.initAuthentication = function() {

    this.app.logMsg('[IdcsAuthnSDK] Init authentication...');

    var error = this.app.getBackendErrorMsg();

    if ( !this.app.getAccessToken() ) {
        this.app.logMsg(this.sdkErrors.error9000.msg);
        this.app.setLoginErrorMessage(this.sdkErrors.error9000);
    }
    //ResetPassword does not need initial state
    else if (this.app.getOperation() === 'resetpwd') {
        this.app.logMsg("Password Reset Flow..")
        this.validateUserToken(this.app.getToken());
     }
    //user successfully authenticated in external IDP and is already provisioned in IDCS
    else if (this.app.getIDPAuthnToken()){
        this.app.logMsg('[IdcsAuthnSDK] inside handover from IDP');
        this.app.logMsg('[IdcsAuthnSDK] idpauthntoken: '+this.app.getIDPAuthnToken());
        var payload = {'authnToken': this.app.getIDPAuthnToken()};
        this.createSession(payload);
    }
    //user successfully authenticated in external IDP and is NOT provisioned in IDCS
    else if (this.app.isSocialRegistrationRequired()){
        var socialData = this.app.getSocialData();
        this.app.setRequestState(socialData.requestState);
        this.app.displaySocialRegistrationForm(socialData);
    }
    else if (!this.app.getInitialState()) {
        this.app.logMsg('[IdcsAuthnSDK] Error: ' + this.sdkErrors.error9001.msg);
        if (error != null) {
          this.app.logMsg('[IdcsAuthnSDK] Error: ' + error);
          this.app.setLoginErrorMessage(JSON.parse(error));
        }
        else {
          this.app.setLoginErrorMessage(this.sdkErrors.error9001);
        }
    }
    else {
        this.app.logMsg('[IdcsAuthnSDK] Initializing authentication with existing initial state from IDCS.');
        var initialData = JSON.parse( this.app.getInitialState() );
        this.app.logMsg('[IdcsAuthnSDK] InitialData: ' + this.app.getInitialState());

        if (initialData.status === 'success') {
            this.app.setRequestState(initialData.requestState);
            this.app.logMsg('[IdcsAuthnSDK] status==success');
            this.app.logMsg(initialData.requestState);
            this.app.logMsg(initialData.nextOp);
            this.app.logMsg(initialData.nextAuthFactors);
            if ((initialData.requestState) &&
                (initialData.nextOp.indexOf('credSubmit') >= 0) &&
                (initialData.nextAuthFactors.indexOf('USERNAME_PASSWORD') >= 0)) {
                this.app.logMsg('[IdcsAuthnSDK] Displaying signin form');
                this.app.displayForm("USERNAME_PASSWORD","submitCreds",initialData.IDP);
                //inject error coming back from social/callback endpoint if IDCS is not able to match
                //external user to locally deactivated user.... plus other errors like eg if user cancels
                //external idp authentication... etc... this error is relayed to this page via /v1/error endpoint
                //which injects it into sessionStorage...
                if (error != null){
                  this.app.setLoginErrorMessage(JSON.parse(error));
                }
            }
            // we can also come back here for a social login with MFA enrollment up next
            else
            if (initialData.nextOp.indexOf('enrollment') >= 0) {
              this.app.displayEnrollmentOptionsForm(initialData);
            }
            else {
              this.app.logMsg('[IdcsAuthnSDK] NOT showing signin form');
              this.app.nextOperation(initialData);
            }
        } else if (initialData.status === 'pending') {
            // pending means one of two things:
            if ( initialData.cause ) {
                if ( initialData.cause[0].code ) {
                    var code = initialData.cause[0].code;

                    // then we're waiting for the user to say "Allow"
                    // so call back to the app to let them know it's OK to proceed
                    if ( code == "AUTH-1108" ) {
                        this.app.nextOperation(initialData);
                    }
                }
            }
        } else if (initialData.status === 'failed') {
            if (initialData.cause) {
                this.app.setLoginErrorMessage({code:initialData.cause[0].code, msg:initialData.cause[0].message});
            }
            else {
                this.app.setLoginErrorMessage(this.sdkErrors.error9010);
            }

            if (initialData.nextOp && initialData.nextOp.indexOf("submitCreds") >= 0) {
                // do nothing
                this.app.logMsg('[IdcsAuthnSDK] Nothing to do here.');
            }
        }
        else {
            this.app.logMsg('[IdcsAuthnSDK] Oops, something went wrong when initiating authentication.');
            this.app.logMsg('[IdcsAuthnSDK] Response status: '  + initialData.status);
        }
    }
  }; // this.initAuthentication

  this.authenticate = function(data) {

    this.app.logMsg('[IdcsAuthnSDK] Authenticating with: ' + this.app.mask(data));
    const self = this;

    try {
      let jsonData = JSON.parse(data); //Verifying input data
      if (typeof jsonData.op === 'undefined' || typeof jsonData.requestState === 'undefined') {
        throw "System Error";
      }

      var xhr = new XMLHttpRequest();

      xhr.addEventListener("readystatechange", function () {
        if (this.readyState === 4) {
          self.app.logMsg ('Authenticate response: ' + self.app.mask(this.responseText));
          const jsonResponse = JSON.parse(this.responseText);

          if (jsonResponse.status === 'success') {
            if (jsonResponse.authnToken) { // User is successfully authenticated!
              self.app.logMsg('[IdcsAuthnSDK] Credentials successfully validated.');
              self.createSession(jsonResponse);
            }
            else {
              self.app.nextOperation(jsonResponse);
            }
          }
          else
          if (jsonResponse.status === 'failed') {
            if (jsonResponse.cause) {
              self.app.setLoginErrorMessage({code:jsonResponse.cause[0].code, msg:jsonResponse.cause[0].message});
            }
            else {
              self.app.setLoginErrorMessage(self.sdkErrors.error9010);
            }

            if (jsonResponse.nextOp && jsonResponse.nextOp.indexOf("submitCreds") >= 0) {
              // do nothing
              self.app.logMsg("Nothing to do here.");
            }
          }
          else
          if (jsonResponse.status === 'pending') {
            // pending means one of two things:
            if ( jsonResponse.cause ) {
              if ( jsonResponse.cause[0].code ) {
                let code = jsonResponse.cause[0].code;

                // then we're waiting for the user to say "Allow"
                // so call back to the app to let them know it's OK to proceed
                if ( code == "AUTH-1108" ) {
                  self.app.nextOperation(jsonResponse);
                }
              }
            }
          }
          else {
            self.app.setLoginErrorMessage(self.sdkErrors.error9011);
          }
        }
      });

      xhr.open("POST", app.baseUri + "/sso/v1/sdk/authenticate");
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());

      xhr.send(data);
    }
    catch(e) { //this should never happen
      self.app.logMsg(e);
      self.app.setLoginErrorMessage(self.sdkErrors.error9999);
    }

  } //this.authenticate

  this.postCreds = function(credentials) {

    this.app.logMsg('[IdcsAuthnSDK] Posting credentials (u/p)...');

    var data = JSON.stringify({
      "op": "credSubmit",
      "authFactor": "USERNAME_PASSWORD",
      "credentials": credentials,
      "requestState": this.app.getRequestState()
    });

    this.authenticate(data);

  }; // this.postCreds

  this.postOtp = function(credentials) {

    this.app.logMsg('[IdcsAuthnSDK] Posting OTP...');

    var data = JSON.stringify({
      "op": "credSubmit",
      "credentials": credentials,
      "trustedDevice": JSON.parse(this.app.getTrustedDeviceOption()), // Value here MUST be Boolean!!
      "trustedDeviceDisplayName": this.clientFingerprint.browser + ' on ' + this.clientFingerprint.OS + ' ' + this.clientFingerprint.OSVersion,
      "requestState": this.app.getRequestState()
    });

    this.authenticate(data);
  }; // this.postOtp

  this.enrollSecurityQuestions = function(credentials) {

    this.app.logMsg('[IdcsAuthnSDK] Enrolling Security Questions and Answers...');

    var data = JSON.stringify({
      "op": "credSubmit",
      "credentials": credentials,
      "requestState": this.app.getRequestState()
    });
    this.authenticate(data);
 }

  this.postSecQuestions = function(credentials) {

    this.app.logMsg('[IdcsAuthnSDK] Posting Security Questions...');

    var questions = [];
    const inputElements = document.getElementsByTagName("INPUT");
    for (i=0; i < inputElements.length; i++) {
      if (inputElements[i].type === "password") {
        questions[i] = {'questionId':inputElements[i].name, 'answer':inputElements[i].value};
      }
    }

    var data = JSON.stringify({
      "op": "credSubmit",
      "authFactor": "SECURITY_QUESTIONS",
      "credentials": credentials,
      "trustedDevice": JSON.parse(this.app.getTrustedDeviceOption()), // Value here MUST be Boolean!!
      "trustedDeviceDisplayName": this.clientFingerprint.browser + ' on ' + this.clientFingerprint.OS + ' ' + this.clientFingerprint.OSVersion,
      "requestState": this.app.getRequestState()
    });

    this.authenticate(data);

  }; // this.postSecQuestions

  this.initEnrollOtpEmail = function() {

    this.app.logMsg('[IdcsAuthnSDK] Initiating OTP over email enrollment...');

    var data = JSON.stringify({
      "op": "enrollment",
      "authFactor": "EMAIL",
      "requestState": this.app.getRequestState()
    });

    this.authenticate(data);

  }; // this.initEnrollOtpEmail

  this.enrollOtpEmail = function(credentials) {

    this.app.logMsg('[IdcsAuthnSDK] Enrolling OTP over email...');

    var data = JSON.stringify({
      "op": "credSubmit",
      "credentials": credentials,
      "requestState": this.app.getRequestState()
    });

    this.authenticate(data);
  }; // this.enrollOtpEmail

  this.initAuthnOtpEmail = function(credentials) {

    this.app.logMsg('[IdcsAuthnSDK] Initiating OTP over email authentication...');

    var data = JSON.stringify({
      "op": "credSubmit",
      "authFactor": "EMAIL",
      "credentials": credentials,
      "requestState": this.app.getRequestState()
    });

    this.authenticate(data);

  }; // this.initAuthnOtpEmail

  this.initEnrollMobileNumber = function(credentials) {
    this.app.logMsg('Initiating OTP over SMS: Mobile enrollment...');

    var data = JSON.stringify({
      "op": "enrollment",
      "authFactor": "SMS",
      "credentials": credentials,
      "requestState": this.app.getRequestState()
    });
    this.authenticate(data);
  }; // this.initEnrollMobileNumber


  this.initAuthnMobileNumber = function(credentials) {
    this.app.logMsg('Initiating OTP over SMS: Authenticating...');

    var data = JSON.stringify({
      "op": "credSubmit",
      "authFactor": "SMS",
      "credentials": credentials,
      "requestState": this.app.getRequestState()
    });
    this.authenticate(data);

  }; // this.initAuthnMobileNumber

  this.resendOtp = function() {
    this.app.logMsg('Resending OTP ...');
    var data = JSON.stringify({
      "op": "resendCode",
      "requestState": this.app.getRequestState()
    });
    this.authenticate(data);
  }; // this.initEnrollMobileNumber

  this.enrollMobileNumber = function() {
    this.app.logMsg('[IdcsAuthnSDK] Send OTP over SMS...');
    var data = JSON.stringify({
      "op": "credSubmit",
      "credentials": {
        "otpCode": document.getElementById("otpCode").value
      },
      "requestState": this.app.getRequestState()
    });
    this.authenticate(data);
  }; // this.enrollMobileNumber

  this.initEnrollSecurityQuestions = function() {
    this.app.logMsg('[IdcsAuthnSDK] Enrolling Security Questions...');
    var data = JSON.stringify({
      "op": "enrollment",
      "authFactor": "SECURITY_QUESTIONS",
      "requestState": this.app.getRequestState()
    });

    this.authenticate(data);
  }; // this.initEnrollSecurityQuestions

  this.createToken = function() {
    this.app.logMsg('[IdcsAuthnSDK] Creating token...');

    var data = JSON.stringify({
      "op": "createToken",
      "requestState": this.app.getRequestState()
    });

    this.authenticate(data);
  }; // this.initEnrollSecurityQuestions

  this.initEnrollOtpTotp = function() {
      var data = JSON.stringify({
        "op":"enrollment",
        "authFactor":"TOTP",
        "credentials":{
            "offlineTotp":true
        },
        "requestState":this.app.getRequestState()
    });
    this.authenticate(data);
  } // this.initEnrollOtpTotp

  this.submitTOTP = function(credentials) {
      var data = JSON.stringify({
        "op":"credSubmit",
        "authFactor":"TOTP",
        "credentials": credentials,
        "trustedDevice": JSON.parse(this.app.getTrustedDeviceOption()), // Value here MUST be Boolean!!
        "trustedDeviceDisplayName": this.clientFingerprint.browser + ' on ' + this.clientFingerprint.OS + ' ' + this.clientFingerprint.OSVersion,
        "requestState":this.app.getRequestState()
        });
      this.authenticate(data);
  }

  this.submitBypasscode = function(credentials) {
    var data = JSON.stringify({
       "op":"credSubmit",
       "authFactor":"BYPASSCODE",
       "credentials":credentials,
       "requestState":this.app.getRequestState()
    });
    this.authenticate(data);
  }

  this.forgotPassword = function(username) {
    const self = this;
    this.app.logMsg("[IdcsAuthnSDK] Username is :" + this.app.mask(username));
    var data = JSON.stringify({
      "userName": username,
      "notificationType": "email",
      "schemas": [
      "urn:ietf:params:scim:schemas:oracle:idcs:MePasswordResetRequestor"
                ]
                });

    var xhr = new XMLHttpRequest();
    xhr.addEventListener("readystatechange", function () {
          if (this.readyState === 4) {
            self.app.logMsg("[IdcsAuthnSDK] PasswordResetRequestor Response: "+self.app.mask(this.responseText));
            const jsonResponse = JSON.parse(this.responseText);

            if (jsonResponse.hasOwnProperty('userName')&& jsonResponse.notificationType === 'email') {
              self.app.displayForgotPassWordSuccess(jsonResponse);
            }
          }
        });

    xhr.open("POST", app.baseUri + "/admin/v1/MePasswordResetRequestor");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());
    xhr.send(data);
  }; //this.forgotPassword

  this.initEnrollPush = function() {
    var data = JSON.stringify({
      "op":"enrollment",
      "authFactor":"PUSH",
      "requestState":this.app.getRequestState()
    });
    this.authenticate(data);
  }

  this.initAuthnPush = function(credentials) {
    this.app.logMsg('[IdcsAuthnSDK] Initiating Push...');

    var data = JSON.stringify({
      "op": "credSubmit",
      "authFactor": "PUSH",
      "credentials": credentials,
      "requestState": this.app.getRequestState()
    });
    this.authenticate(data);
  }; // this.initAuthnPush

  this.submitPushPoll = function() {
    var data = JSON.stringify({
      "op":"credSubmit",
      "trustedDevice": JSON.parse(this.app.getTrustedDeviceOption()), // Value here MUST be Boolean!!
      "trustedDeviceDisplayName": this.clientFingerprint.browser + ' on ' + this.clientFingerprint.OS + ' ' + this.clientFingerprint.OSVersion,
      "requestState":this.app.getRequestState()
    });
    this.authenticate(data);
  }

  this.submitBackupFactors = function() {
    var data = JSON.stringify({
      "op":"getBackupFactors",
      "requestState":this.app.getRequestState()
    });
    this.authenticate(data);
  }

  this.getEnrollmentFactors = function() {
    var data = JSON.stringify({
      "op":"enrollment",
      "requestState":this.app.getRequestState()
    });
    this.authenticate(data);
  }

  this.validateToken = function(token, callback) {
     this.app.logMsg('[IdcsAuthnSDK] In Validate Token');

     var data = JSON.stringify({
       "token": token,
       "schemas": [
         "urn:ietf:params:scim:schemas:oracle:idcs:UserTokenValidator"
       ]
     });

     var xhr = new XMLHttpRequest();
     const self = this;

     xhr.addEventListener("readystatechange", function () {
       if (this.readyState === 4) {
         self.app.logMsg('[IdcsAuthnSDK] Validate User Token:' + self.app.mask(this.responseText));
         const jsonResponse = JSON.parse(this.responseText);
         callback(jsonResponse);
       }
     });

     xhr.open("POST", app.baseUri + "/admin/v1/UserTokenValidator");
     xhr.setRequestHeader("Content-Type", "application/json");
     xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());
     xhr.send(data);
   }; // this.validateToken

  this.validateUserToken = function(token) {
    this.app.logMsg('[IdcsAuthnSDK] In ValidateUserToken...');
    this.app.logMsg('[IdcsAuthnSDK] Token: ' + this.app.mask(token));
    const self = this;

    this.validateToken(token , function(returnVal1) {
      var id = returnVal1.userId;

      if (returnVal1.hasOwnProperty('userId')) {
         self.app.logMsg('[IdcsAuthnSDK] UserTokenValidator Repsonse , Success for Id -->' + self.app.mask(returnVal1.userId));
         self.app.displayResetPassWordForm(token);
      }
      else {
         self.app.setLoginErrorMessage(self.sdkErrors.error9020);
      }
    });

  }; // this.validateUserToken

  this.evaluatePasswordPolicies = function(resetpaswddata ,callback) {
    const self = this;
    var data = JSON.stringify({
      "userName": "dummydata@example.com",
      "givenName": "dummyFirst",
      "familyName": "dummyLast",
      "password": resetpaswddata,
      "schemas": [
        "urn:ietf:params:scim:schemas:oracle:idcs:UserPasswordValidator"
      ]
    });

    var xhr = new XMLHttpRequest();

    xhr.addEventListener("readystatechange", function () {
      if (this.readyState === 4) {
        self.app.logMsg('[IdcsAuthnSDK] Password Policy Eval Response: ' + self.app.mask(this.responseText));
        const jsonResponse = JSON.parse(this.responseText);
        callback(jsonResponse);
      }
    });

    xhr.open("POST", app.baseUri + "/admin/v1/UserPasswordValidator");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());
    xhr.send(data);

  }; //this.evaluatePasswordPolicies

  this.resetUserPassword = function(token,resetpaswddata,callback){
    const self = this;
    var data = JSON.stringify({
      "schemas": [
        "urn:ietf:params:scim:schemas:oracle:idcs:MePasswordResetter"
      ],
      "token": decodeURIComponent(token),
      "password": resetpaswddata
    });

    var xhr = new XMLHttpRequest();


    xhr.addEventListener("readystatechange", function () {
      if (this.readyState === 4) {
        const jsonResponse = JSON.parse(this.responseText);
          self.app.logMsg('[IdcsAuthnSDK] Reset user Password Response: ' + self.app.mask(this.responseText));
        callback(jsonResponse);
      }
    });

    xhr.open("POST", app.baseUri + "/admin/v1/MePasswordResetter");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());
    xhr.send(data);
  }; //this.resetUserPassword

  this.resetPassword = function(credentials){

    const self = this;
    self.app.logMsg('[IdcsAuthnSDK] Resetting password...');
    this.evaluatePasswordPolicies(credentials.password ,function(returnValue1) {
      if (returnValue1.hasOwnProperty('failedPasswordPolicyRules')) {

        self.sdkErrors.error9021.details = [];
        var failedPolicies = '';
        self.app.logMsg('[IdcsAuthnSDK] Number of failed policies: ' + returnValue1.failedPasswordPolicyRules.length);

        for (var i = 0; i < returnValue1.failedPasswordPolicyRules.length; i++) {
          self.sdkErrors.error9021.details.push(returnValue1.failedPasswordPolicyRules[i].value);
          failedPolicies += '\n' + returnValue1.failedPasswordPolicyRules[i].value;
        }
        self.app.logMsg('[IdcsAuthnSDK] Failed policies :' + failedPolicies);
        self.app.setLoginErrorMessage(self.sdkErrors.error9021);
      }
      else {
        self.app.logMsg('[IdcsAuthnSDK] Password policies came back fine. Proceeding with reset password...');

        self.resetUserPassword(credentials.token, credentials.password,function(returnValue2) {
          if(returnValue2.hasOwnProperty('id')) {
            self.app.logMsg('[IdcsAuthnSDK] ResetPassword was successful.');
            self.app.displayResetPassWordSuccess();
          }
          else {
            self.app.logMsg(JSON.stringify(returnValue2));
            self.app.logMsg('[IdcsAuthnSDK] ResetPassword failed: ' + returnValue2.detail);
            self.app.setLoginErrorMessage({code:'', msg:returnValue2.detail});
          }
        });
      }
    });
  }; // this.resetPassword

  this.createSession = function(payload) {

    var addParam = function(myform, paramName, paramValue) {
        param = document.createElement("input");
        param.value = paramValue;
        param.name = paramName;
        param.hidden=true;
        myform.appendChild(param);
    };

    this.app.logMsg('[IdcsAuthnSDK] Creating session with authnToken:' + this.app.mask(payload));

    var myform = document.createElement("form");
    myform.method = "POST";
    myform.action = app.baseUri + "/sso/v1/sdk/session";
    myform.target = "_top";
    addParam(myform, "authnToken", payload.authnToken);
    if (payload.trustToken) {
      this.app.logMsg('[IdcsAuthnSDK] trustToken added.');
      addParam(myform, "trustToken", payload.trustToken);
    }
    document.body.appendChild(myform);
    //adding this to flush session after successful login...
    sessionStorage.clear();
    myform.submit();

  } // this.createSession

  this.chooseIDP = function (payload) {
    var addInput = function (myForm, paramName, paramValue) {
      var param = document.createElement("input");
      param.value = paramValue;
      param.name = paramName;
      param.hidden = true;
      myForm.appendChild(param);
    };

    var myForm = document.createElement("form");
    myForm.method = "POST";
    //this is a public endpoint!
    myForm.action = app.baseUri + "/sso/v1/sdk/idp";
    addInput(myForm, 'requestState', payload.requestState);
    addInput(myForm, 'idpName', payload.idpName);
    addInput(myForm, 'idpId', payload.idpId);
    addInput(myForm, 'idpType', payload.idpType);
    addInput(myForm, 'clientId', payload.clientId);
    document.body.appendChild(myForm);
    myForm.submit();
  }

  this.clientFingerprint = {

    clients: [
      {searchIn:navigator.userAgent,   forString:"Edge",     identity:"Microsoft Edge"},
      {searchIn:navigator.userAgent,   forString:"OPR",      identity:"Opera"},
      {searchIn:navigator.userAgent,   forString:"Chrome",   identity:"Chrome"},
      {searchIn:navigator.vendor,      forString:"Apple",    identity:"Safari"},
      {searchIn:navigator.userAgent,   forString:"Firefox",  identity:"Firefox"},
      {searchIn:navigator.userAgent,   forString:"Netscape", identity:"Netscape"},
      {searchIn:navigator.userAgent,   forString:".NET",     identity:"Internet Explorer"},
      {searchIn:navigator.userAgent,   forString:"Gecko",    identity:"Mozilla"},
      {searchIn:navigator.userAgent,   forString:"Mozilla",  identity:"Netscape"}
    ],

    operatingSystems: [
      {searchIn:navigator.platform,   forString:"Win",     identity: "Windows"},
      {searchIn:navigator.userAgent,  forString:"iPhone",  identity: "iPhone OS"},
      {searchIn:navigator.platform,   forString:"Mac",     identity: "Mac OS"},
      {searchIn:navigator.userAgent,  forString:"Android", identity: "Android"},
      {searchIn:navigator.platform,   forString:"Linux",   identity: "Linux"}
    ],

    operatingSystemsVersions: [
      {searchString: "Windows NT",delimiter: "."},
      {searchString: "iPhone OS"},
      {searchString: "Android"},
      {searchString: "Mac OS",delimiter: " "},
      {searchString: "Linux"}
    ],

    init: function() {
      this.browser = this.searchString(this.clients) || "Unknown browser";
      this.OS = this.searchString(this.operatingSystems) || "Unknown OS";
      this.OSVersion = this.searchOSVersion(navigator.userAgent) || "";
    },

    searchString: function(data) {
      for (var i = 0; i < data.length; i++) {
        var dataString = data[i].searchIn;
        if (dataString) {
          if (dataString.indexOf(data[i].forString) != -1) {
            return data[i].identity;
          }
        }
      }
    },

    searchOSVersion: function(dataString) {
      var stringIndex, delimIndex, osVersionString;
      for (var i=0; i < this.operatingSystemsVersions.length; i++) {
        stringIndex = dataString.indexOf(this.operatingSystemsVersions[i].searchString);
        if (stringIndex != -1) {
          if (typeof this.operatingSystemsVersions[i].delimiter !== 'undefined') { // Returns no version if there's no delimiter. Linux/Android case.
            osVersionString = dataString.substring(stringIndex + this.operatingSystemsVersions[i].searchString.length + 1);
            return osVersionString.substring(0,osVersionString.indexOf(this.operatingSystemsVersions[i].delimiter));
          }
          else {
            return;
          }
        }
      }
    }

  }; // this.clientFingerprint

  this.clientFingerprint.init();
}
