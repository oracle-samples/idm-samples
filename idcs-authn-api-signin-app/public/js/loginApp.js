function LoginApp() {

  /* ----------------------------------------------------------------------------------------------------------------
     -------------------------------------------- OBJECT PROPERTIES -------------------------------------------------
     ---------------------------------------------------------------------------------------------------------------- */

  this.baseUri = sessionStorage.getItem("baseUri");
  this.debugEnabled = sessionStorage.getItem("debugEnabled") && (sessionStorage.getItem("debugEnabled").toLowerCase() == "true");
  this.pushPollInterval;
  this.serverSideBaseUri = sessionStorage.getItem("serverSideBaseUri");

  /* ----------------------------------------------------------------------------------------------------------------
     -------------------------------------------- HELPER METHODS ----------------------------------------------------
     ---------------------------------------------------------------------------------------------------------------- */

  // Removes the spinner from DOM tree.
  // Used, for instance, when an error comes and we have to stop spinning.
  this.removeSpinner = function () {
    let spinner = document.querySelector("div.loader");
    if (spinner != null) {
      spinner.parentNode.removeChild(spinner);
    }
  }

  // Removes button and show spinner.
  // Mainly used on form submission, where submit button is swapped by spinner.
  this.removeBtnAndShowSpinner = function (btn) {
    btn.style.display = 'none';
    var spinnerDiv = document.createElement('div');
    spinnerDiv.classList.add('loader');
    spinnerDiv.data_res = 'loading-msg';
    spinnerDiv.innerHTML = 'Loading...';
    // Showing the spinner after btn
    btn.parentNode.insertBefore(spinnerDiv, btn.nextSibling);
  }

  // Keeps polling for push notifications at the specified interval.
  this.submitPushPoll = function (timeInMillis) {
    const self = this;
    this.logMsg('submitPushPoll');
    this.pushPollInterval = setInterval(function () {
      self.logMsg('timer');
      let signinDiv = document.getElementById("signin-div");
      if ((signinDiv) &&
        (signinDiv.whichFactorForm === "PUSH")) {
        self.logMsg(signinDiv.whichFactorForm + " is active");

        // Issue #1 fix. Change introduced to channel the call to submitPushPoll through buildPayload for adding credentials
        const payload = self.buildPayload("submitPushPoll", signinDiv);
        self.logMsg("Invoking submitPushPoll with payload " + self.mask(payload));
        self.sdk.submitPushPoll(payload);
        // End of fix.
      }
    }, timeInMillis);
  }

  // Stops polling for push notifications
  this.stopPushPoll = function () {
    if (this.pushPollInterval != null) {
      this.removeSpinner();
      this.logMsg('Stopping push poll...');
      clearInterval(this.pushPollInterval);
    }
  }

  // Displays an HTML snippet allowing users to request a new OTP code.
  // Used in EMAIL and SMS.
  this.showResendCodeOption = function (formDiv, obj, timeInMilis) {

    if (formDiv && (formDiv.whichFactorForm === "EMAIL" || formDiv.whichFactorForm === "SMS" || formDiv.whichFactorForm === "PHONE_CALL") && formDiv.noResend == null) {

      let didNotGetMsg = this.localizeMsg(formDiv.whichFactorForm.toLowerCase() + '-did-not-get-msg', 'Did not get the message?');
      let resendMsg = this.localizeMsg(formDiv.whichFactorForm.toLowerCase() + '-resend-btn', 'Resend message');

      setTimeout(function () {
        self.logMsg(formDiv.whichFactorForm + " factor detected for showing Resend Message option.");

        var resendDivElem = document.createElement('div');
        resendDivElem.classList.add('sameline');
        resendDivElem.innerHTML = '<span class="info">' + didNotGetMsg + '</span>&nbsp;' +
          '<a href="#" class="info" id="resend-btn">' + resendMsg + '</a>';

        // Adding the Resend Option preferably right after the submit button.
        let submitBtnElem = formDiv.querySelector("#submit-btn");
        if (submitBtnElem) {
          submitBtnElem.parentNode.insertBefore(resendDivElem, submitBtnElem.nextSibling);
        }
        else {
          formDiv.appendChild(resendDivElem);
        }

        formDiv.querySelector("#resend-btn").onclick = function () {
          obj.sdk.resendOtp();
        };
      }, timeInMilis);
    }
  }

  // Displays an HTML snippet allowing users to request a new email.
  // Mainly used by Forgot Password flow.
  this.showResendEmail = function (formDiv, obj, timeInMilis) {
    if (formDiv && formDiv.whichForm != null && formDiv.whichForm === "FORGOT_PASSWORD_FORM") {
      var usernameLocal = formDiv.querySelector("#forgotUserName").value;

      let didNotGetMsg = this.localizeMsg('forgot-pw-did-not-get-msg', 'Did not get the email?');
      let resendMsg = this.localizeMsg('forgot-pw-resend-btn', 'Resend email');

      setTimeout(function () {
        var resendDivElem = document.createElement('div');
        resendDivElem.classList.add('sameline');
        resendDivElem.innerHTML = '<span class="info">' + didNotGetMsg + '</span>&nbsp;' +
          '<a href="#" id="resend-btn">' + resendMsg + '</a>';

        // Adding the Resend Option preferably right after the submit button.
        let submitBtnElem = formDiv.querySelector("#submit-btn");
        if (submitBtnElem) {
          submitBtnElem.parentNode.insertBefore(resendDivElem, submitBtnElem.nextSibling);
        }
        else {
          formDiv.appendChild(resendDivElem);
        }

        formDiv.querySelector("#resend-btn").onclick = function () {
          obj.sdk.forgotPassword(usernameLocal);

        };
      }, timeInMilis);
    }
  }

  this.showReinputUserName = function (formDiv, obj, timeInMilis) {
    if (formDiv && formDiv.whichForm != null && formDiv.whichForm === "FORGOT_PASSWORD_FORM") {
      var usernameLocal = formDiv.querySelector("#forgotUserName").value;

      let didNotGetMsg = this.localizeMsg('forgot-pw-incorrect-username-msg', 'Incorrect UserName?');
      let resendMsg = this.localizeMsg('forgot-pw-incorrect-username-btn', 'Fix UserName');

      setTimeout(function () {
        formDiv.appendChild(document.createElement('hr'));

        var resendDivElem = document.createElement('div');
        resendDivElem.classList.add('sameline');
        resendDivElem.innerHTML = '<span class="info">' + didNotGetMsg + '</span>&nbsp;' +
          '<a href="#" id="resend-username-btn">' + resendMsg + '</a>';

        // Adding the Resend Option preferably right after the submit button.
        let submitBtnElem = formDiv.querySelector("#submit-btn");
        if (submitBtnElem) {
          submitBtnElem.parentNode.insertBefore(resendDivElem, submitBtnElem.nextSibling);
        }
        else {
          formDiv.appendChild(resendDivElem);
        }

        formDiv.querySelector("#resend-username-btn").onclick = function () {
          obj.displayForgotPassWordForm();

        };
      }, timeInMilis);
    }
  }

  // Localizes all labels inside formDiv
  this.localize = function (formDiv) {
    if (resources) {
      var resElms = formDiv.querySelectorAll('[data-res]');
      for (var n = 0; n < resElms.length; n++) {
        var elem = resElms[n];
        var resKey = elem.getAttribute('data-res');
        if (resKey) {
          if (resources[resKey]) {
            elem.innerHTML = resources[resKey];
          }
          else {
            this.logWarning("Translation missing for resource key '" + resKey + "'");
          }
        }
      }
    }
  } // this.localize

  // Returns the message associated with a given key. If the key isn't found, the message (msg) as passed is returned.
  this.localizeMsg = function (resKey, msg) {
    if (resources && resources[resKey]) {
      return resources[resKey];
    }
    else {
      this.logWarning("Translation missing for resource key '" + resKey + "'");
      return msg;
    }
  }

  this.mask = function (msg) {
    let propsToMask = ['username', 'password', 'bypasscode', 'otpcode', 'questions', 'deviceid', 'requeststate', 'phonenumber', 'token', 'authntoken', 'trusttoken', 'userid'];

    var stars = '***';
    var temp;
    try {
      if (msg !== Object(msg)) {
        temp = JSON.parse(msg); // Object deep copy, except methods, that we don't need here.
      }
      else {
        temp = JSON.parse(JSON.stringify(msg)); // Object deep copy, except methods, that we don't need here.
      }
      for (key in temp) {
        if (temp.hasOwnProperty(key)) {
          if (temp[key] !== Object(temp[key]) && propsToMask.indexOf(key.toLowerCase()) != -1) { // key is not a object
            temp[key] = stars;
          }

          else if (Array.isArray(temp[key]) && propsToMask.indexOf(key.toLowerCase()) != -1) { // key is an object array
            temp[key] = stars; // we're simply masking the whole array, don't care about the contents.
          }

          else { // key is simple object
            for (subkey in temp[key]) {
              if (temp[key].hasOwnProperty(subkey) && propsToMask.indexOf(subkey.toLowerCase()) != -1) {
                temp[key][subkey] = stars;
              }
            }
          }
        }
      }
      return JSON.stringify(temp);
    }
    catch (e) {
      return stars;
    }
  } //this.mask

  this.logMsg = function (msg) {
    if (window.console && this.debugEnabled) {
      console.log('LoginApp: ' + msg);
    }
  } // this.logMsg

  this.logWarning = function (msg) {
    console.log('LoginApp (WARNING): ' + msg);
  }

  this.removeSignupFunction = function () {
    Array.prototype.slice.call(document.querySelectorAll('.hidelater')).forEach(function (e) { // Making MS family (IE and Edge) happy
      e.style.visibility = "hidden";
    });
  }

  this.replaceDiv = function (divid, replacement, dofocus) {
    // divname is the ID of the div to replace
    // replacement is the Element to replace it with
    // dofocus says "set the focus to the first text input"

    // Note: for the signin-div the replacement div SHOULD havr a .id prop
    // matching the one that's being replacing
    if (replacement.id != divid) {
      this.logMsg("WARNING: replacement div id=" + replacement.id + " does not match expected value of " + divid);
    }

    // Localizing while replacement div still not visible.
    this.localize(replacement);

    var oldForm = document.getElementById(divid);
    if (oldForm) {
      oldForm.parentNode.replaceChild(replacement, oldForm);
    }

    this.showResendCodeOption(replacement, this, 10000);
    this.showResendEmail(replacement, this, 10000);
    this.showReinputUserName(replacement, this, 2000);
    this.showSwitchEnrollFactorOption(replacement, this);

    // find the first text input field and put the focus there
    if (dofocus) {
      div = document.getElementById(divid);
      if (div) {
        let firstInput = div.querySelector('input[type="text"]');
        if (firstInput) firstInput.focus();
      }
    }
  }

  // Performs form data validation and style form elements accordingly
  this.validateForm = function (formDiv) {
    formDiv.querySelector("#submit-btn").disabled = true;
    // Looking for input fields marked as required and empty.
    const inputFields = formDiv.getElementsByTagName("INPUT");
    var isError = false;
    for (i = 0; i < inputFields.length; i++) {
      this.logMsg('Validating field ' + inputFields[i].id);
      if (inputFields[i].required && inputFields[i].value.trim() === '') {
        isError = true;
        // Toggling the element class for styling on error.
        inputFields[i].classList.add('on__error');
      }
    }
    if (isError) {
      let errorMessage = this.localizeMsg('error-required-fld', 'Required field empty');
      this.setLoginErrorMessage({ code: '', msg: errorMessage });
      formDiv.querySelector("#submit-btn").disabled = false;
      return false;
    }
    this.logMsg('Validation OK.');
    this.removeBtnAndShowSpinner(formDiv.querySelector("#submit-btn"));
    return true;
  }

  // Handles focusout event on input fields for styling the field
  this.handleFocusOutEvent = function (elem) {
    elem.addEventListener('focusout', function () {
      if (elem.value.trim().length == 0) {
        elem.classList.add('on__error');
      }
      else {
        elem.classList.remove('on__error');
      }
    });
  }

  // Handles onClick event for submiting form data.
  this.handleClickToSubmitEvent = function (formDiv, obj, methodName, includeAuthnFactor) {
    const self = this;
    formDiv.querySelector("#submit-btn").onclick = function () {
      if (obj.validateForm(formDiv)) {
        const payload = obj.buildPayload(methodName, formDiv);
        if (payload) { // Giving a chance for buildPayload to fail.
          self.logMsg("Invoking " + methodName + " with credentials " + self.mask(payload));
          obj.sdk[methodName](payload, includeAuthnFactor);
        }
        else {
          this.log("handleClickToSubmitEvent: [BUG] payload must not be null");
        }
      }
    }
  }

  // Handles onKeyPress event for submiting form data.
  this.handleKeyPressToSubmitEvent = function (formDiv, elem, obj, methodName, includeAuthnFactor) {
    const self = this;
    elem.onkeypress = function (event) {
      if (event.keyCode == 13) {
        if (obj.validateForm(formDiv)) {
          const payload = obj.buildPayload(methodName, formDiv);
          if (payload) { // Giving a chance for buildPayload to fail.
            self.logMsg("Invoking " + methodName + " with credentials " + self.mask(payload));
            obj.sdk[methodName](payload, includeAuthnFactor);
          }
          else {
            this.log("handleKeyPressToSubmitEvent: [BUG] payload must not be null");
          }
        }
      }
    }
  }

  // Handles onClick event for handling forgotPassword.
  this.handleClickEvent = function (formDiv, obj) {
    formDiv.querySelector("#signin-forgot-pass").onclick = function () {
      obj.displayForgotPassWordForm(formDiv);
    }
  }

  // Builds the expected credentials payload to the respective API in the SDK, here identified by methodName.
  this.buildPayload = function (methodName, formDiv) {

    let preferredFactorElem = document.getElementById("preferredFactorOption");

    switch (methodName) {
      case 'postCreds':
        // ER #1. Saving the request origin. This is read later for determining the user preferred factor.
        this.setUnPwOrigin("true");
        var data = {
          "username": document.getElementById("userid").value,
          "password": document.getElementById("password").value,
          "origin": window.location.origin
        }
        if (document.getElementById("kmsi") != null) {
          data["keepMeSignedIn"] = document.getElementById("kmsi").checked;
          return data;
        }
        return data;

      case 'postUserName':
        this.setUnPwOrigin("true");
        var dataUserNameFirst = {
          "username": document.getElementById("userid").value
        };
        if (document.getElementById("kmsi") != null) {
          dataUserNameFirst["keepMeSignedIn"] = document.getElementById("kmsi").checked;
          return dataUserNameFirst;
        }
        return dataUserNameFirst;

      case 'enrollSecurityQuestions':

        var secQuestions = [];
        var qID = [];

        numOfQuestions = formDiv.getElementsByTagName("SELECT");

        for (qi = 0; qi < numOfQuestions.length; qi++) {
          var qesObj = new Object();
          var sel = document.getElementById("sel-" + qi);
          var opt = sel.options[sel.selectedIndex];
          qesObj.questionId = opt.id;
          var ansTxt = document.getElementById("ans-" + qi).value;
          if (qID.indexOf(opt.id) === -1) {
            qID.push(opt.id);
            qesObj.answer = ansTxt;
            qesObj.hint = document.getElementById("hint-" + qi).value;
            secQuestions[qi] = qesObj;
          }
          else {
            var errorMsg = this.localizeMsg('enroll-qa-error-sameq-twice-msg', 'Same security question is chosen twice. Please, select another question');
            this.setLoginErrorMessage({ code: '', msg: errorMsg });
            return;
          }
        }
        return { "questions": secQuestions };

      case 'postSecQuestions':
        var questions = [];
        const inputElements = formDiv.getElementsByTagName("INPUT");
        for (i = 0; i < inputElements.length; i++) {
          if (inputElements[i].type === "password") {
            questions[i] = { 'questionId': inputElements[i].id, 'answer': inputElements[i].value };
          }
        }
        var payload = {};
        payload["questions"] = questions;

        if (preferredFactorElem && preferredFactorElem.checked) {
          // DeviceId is not need for setting Security Questions as preferred factor.
          payload["preferred"] = true;
        }

        return payload;

      case 'enrollOtpEmail':
        return { "otpCode": document.getElementById("otpCode").value };

      case 'postEmailOtp':
        var payload = {};
        payload["otpCode"] = document.getElementById("otpCode").value;

        if (preferredFactorElem && preferredFactorElem.checked) {
          payload["preferred"] = true;
          if (this.getSelectedDevice()) {
            payload["deviceId"] = this.getSelectedDevice().deviceId;
          }
        }
        return payload;

      case 'postSmsOtp':
        var payload = {};
        payload["otpCode"] = document.getElementById("otpCode").value;

        if (preferredFactorElem && preferredFactorElem.checked) {
          payload["preferred"] = true;
          if (this.getSelectedDevice()) {
            payload["deviceId"] = this.getSelectedDevice().deviceId;
          }
        }
        return payload;

      case 'postPhoneCallOtp':
        var payload = {};
        payload["otpCode"] = document.getElementById("otpCode").value;

        if (preferredFactorElem && preferredFactorElem.checked) {
          payload["preferred"] = true;
          if (this.getSelectedDevice()) {
            payload["deviceId"] = this.getSelectedDevice().deviceId;
          }
        }
        return payload;

      case 'initEnrollMobileNumber':
        return { "phoneNumber": document.getElementById("mobileNumber").value };

      case 'initEnrollPhoneNumber':
        var payload = {};
        payload["phoneNumber"] = document.getElementById("mobileNumber").value;
        let landLineFlag = document.getElementById("landlineFlag");
        if (landLineFlag && landLineFlag.checked) {
          payload["landLine"] = true;
        }
        return payload;

      case 'submitTOTP':
        var payload = {};
        payload["otpCode"] = document.getElementById("otpCode").value;
        if (this.getSelectedDevice()) {
          payload["deviceId"] = this.getSelectedDevice().deviceId;
        }

        if (preferredFactorElem && preferredFactorElem.checked) {
          payload["preferred"] = true;
        }

        return payload;

      case 'submitBypasscode':
        return { "bypassCode": document.getElementById("bypassCode").value };

      case 'forgotPassword':
        if (document.querySelector('input[name="pwmethod"]:checked').value === 'email') {
          return { "username": document.getElementById("forgotUserName").value, "email": document.getElementById("userEmail").value, "method": document.querySelector('input[name="pwmethod"]:checked').value }
        }
        else { // Not E-mail - Just send username and method
          return { "username": document.getElementById("forgotUserName").value, "method": document.querySelector('input[name="pwmethod"]:checked').value }
        }

      case 'getPasswordMethod':
        return document.getElementById("forgotUserName").value;

      case 'processPasswordMethod':
        if (!!document.getElementById("smsCode")) {
          return {
            "username": document.getElementById("forgotUserName").value, "method": "sms",
            "smsCode": document.getElementById("smsCode").value,
            "deviceId": document.getElementById("deviceId").value,
            "requestId": document.getElementById("requestId").value
          };
        }
        else if (!!document.getElementById("secAnswer")) {
          return {
            "username": document.getElementById("forgotUserName").value, "method": "secquestions",
            "secAnswer": document.getElementById("secAnswer").value,
            "questionId": document.getElementById("questionId").value
          };
        }
        else if (!!document.getElementById("emailToken")) {
          return {
            "username": document.getElementById("forgotUserName").value, "method": "email",
            "emailToken": document.getElementById("emailToken").value
          };
        }

      case 'resetPassword':
        if (document.getElementById("confresetPassword").value === document.getElementById("resetPassword").value) {
          return { "token": this.shortlived_token, "password": document.getElementById("confresetPassword").value };
        }
        else {
          var errorMsg = this.localizeMsg('reset-pw-nomatch-msg', 'Password and Confirm Password did not match! Please, retry.');
          this.setLoginErrorMessage({ code: '', msg: errorMsg });
          return;
        };
      case 'initAuthnOtpEmail':
        return { "deviceId": '' };

      case 'submitAcceptTerms':
        if (!document.getElementById("termsconsent").checked) {
          var errorMsg = this.localizeMsg('must-accept-terms', 'You must accept the terms of use to proceed');
          this.setLoginErrorMessage({ code: '', msg: errorMsg });
          return;
        }
        // otherwise it's checked. So build the payload

        return true;

      case 'submitPushPoll':
        this.logMsg('submitPushPoll...');
        var payload = {};
        if (preferredFactorElem && preferredFactorElem.checked) {
          payload["preferred"] = true;
          if (this.getSelectedDevice()) {
            payload["deviceId"] = this.getSelectedDevice().deviceId;
          }

        }
        return payload;

      default:
        alert("Sorry, buggy code.")
    }
  }

  // Handles the display of an option the user can click to skip MFA enrollment, if enrollment is optional in IDCS.
  this.handleOptionalMFAEnrollment = function (payload, formDiv, obj) {
    this.logMsg('Handling optional MFA enrollment... ');
    if (payload.mfaSettings) {
      this.logMsg('Is Enrollment required? ' + payload.mfaSettings.enrollmentRequired);
      if (!payload.mfaSettings.enrollmentRequired) {
        var skipEnrollMsg = this.localizeMsg('enroll-skip-msg', 'Skip Enrollment');
        var skipEnrollDivElem = document.createElement('div');
        skipEnrollDivElem.classList.add('sameline');
        skipEnrollDivElem.innerHTML = '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right"></div>';
        var options = {
          whiteList: {
            a: ["href", "id"],
          },
        };
        skipEnrollDivElem.innerHTML += filterXSS('<a href="#" id="skip-enroll-btn">' + skipEnrollMsg + '</a>', options);

        formDiv.appendChild(skipEnrollDivElem);

        formDiv.querySelector("#skip-enroll-btn").onclick = function () {
          obj.sdk.createToken();
        };

      }
      else {
        this.logMsg('Enrollment is required. Not showing skip option.');
      }
    }
    else {
      this.logMsg("No mfaSettings property in payload");
    }
  }

  this.showSwitchEnrollFactorOption = function (formDiv, obj) {

    if (formDiv && (formDiv.step === "enrollment")) {
      this.logMsg('Adding switch enroll factor option...');

      let enrollSwitchMsg = this.localizeMsg('enroll-switch-msg', 'Switch Factor to Enroll');
      let orMsg = this.localizeMsg('or-msg', 'OR');

      var switchEnrollDivElem = document.createElement('div');
      switchEnrollDivElem.classList.add('newline');
      switchEnrollDivElem.innerHTML = '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">' + orMsg + '</span><hr class="right"></div>';
      switchEnrollDivElem.innerHTML += '<a href="#" id="switch-enroll-btn" data-res="enroll-switch-msg">' + enrollSwitchMsg + '</a>';

      formDiv.appendChild(switchEnrollDivElem);

      formDiv.querySelector("#switch-enroll-btn").onclick = function () {
        obj.sdk.getEnrollmentFactors();
      };
    }

  }

  /* ----------------------------------------------------------------------------------------------------------------
     -------------------------------------------- MAIN METHODS ------------------------------------------------------
     ---------------------------------------------------------------------------------------------------------------- */

  // Generic method for displaying a form, identified by which (the factor) and step (which build method to call)
  this.displayForm = function (which, step, payload, username) {
    const self = this;

    this.logMsg("Which: " + which);
    this.logMsg("Step: " + step);
    this.logMsg("Payload: " + this.mask(payload));

    // "which" will be the key to this.AuthenticationFactorInfo
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    // our own tag so we can suppress this option if the user clicks alternative
    formDiv.whichFactorForm = which;
    formDiv.step = step;

    // Authn API not always set the displayName in the response.
    // For instance, this is the case when a backup factor is being initiated for the 2nd time in the same session.
    if (payload && payload.displayName) {
      formDiv.whichDisplayName = payload.displayName;
    }
    else {
      if (this.getSelectedDevice()) {
        formDiv.whichDisplayName = this.getSelectedDevice().displayName;
      }
      else {
        formDiv.whichDisplayName = '';
      }
    }

    // There is ONE special case - email
    if ((which == undefined) && (payload["EMAIL"])) {
      which = "EMAIL";
    }

    if (which === "spinner") {
      formDiv.innerHTML = '<div class="loader" data-res="loading-msg">Loading...</div>';
      this.replaceDiv("signin-div", formDiv, true);
    }
    else
      if (this.AuthenticationFactorInfo[which]) {
        if (step === "submitCreds") {
          (this.AuthenticationFactorInfo[which]["loginFormFunction"])(formDiv, payload);

          // hide stuff that is not needed except on the initial screen
          if ((which !== "USERNAME_PASSWORD") && (which !== "USERNAME") && (which !== "PASSWORD")) {
            Array.prototype.slice.call(document.querySelectorAll('.hidelater')).forEach(function (e) { // Making MS (IE and Edge) family happy
              e.style.visibility = "hidden";
            });

            // Issue #1. Checking whether or not displaying the option for setting preferred factor.
            if (which !== 'BYPASSCODE' &&
              (this.getPreferredFactor() &&
                (this.getPreferredFactor().factor !== which ||
                  (this.getPreferredFactor().displayName && this.getPreferredFactor().displayName !== formDiv.whichDisplayName)
                )
              )
            ) {
              var preferredFactorDiv = document.createElement('div');
              preferredFactorDiv.innerHTML =
                '<label><span>' +
                '<input type="checkbox" id="preferredFactorOption">' +
                '<span data-res="preferredFactor-msg">Set this factor as preferred</span>' +
                '</span></label>';

              formDiv.insertBefore(preferredFactorDiv, formDiv.querySelector("#submit-btn"));
            }
            // End of Issue #1

            if (payload.trustedDeviceSettings) {
              var trustedDeviceDiv = document.createElement('div');
              trustedDeviceDiv.innerHTML =
                '<label><span>' +
                '<input type="checkbox" id="trustedDevice">' +
                '<span data-res="td-msg">Trust this device for </span><span>' + payload.trustedDeviceSettings.trustDurationInDays + '</span> <span data-res="td-days-msg">days</span><span>.</span>' +
                '</span></label>';

              // if we're rendering the checkbox it should be unchecked
              // and the session data should be set to false
              this.setTrustedDeviceOption(false);
              // then add a listener when the value changes
              trustedDeviceDiv.querySelector("#trustedDevice").addEventListener('change', function () {
                self.setTrustedDeviceOption(this.checked);
              });

              formDiv.insertBefore(trustedDeviceDiv, formDiv.querySelector("#submit-btn"));
            }

            if (payload.nextOp.indexOf("getBackupFactors") > 0) {
              // add the alternative button

              var divHr = document.createElement('div');
              divHr.classList.add('hr');
              divHr.innerHTML = '<hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right">';
              formDiv.appendChild(divHr);

              let altFactorsMsg = this.localizeMsg('backup-btn', 'Use an Alternative Factor');

              var altFactorsDivElem = document.createElement('div');
              altFactorsDivElem.classList.add('sameline');
              altFactorsDivElem.innerHTML = '<a href="#" class="info" id="backupfactors-btn">' + altFactorsMsg + '</a>';
              formDiv.appendChild(altFactorsDivElem);

              var div = document.createElement("div");
              div.id = "backupFactorChooser";
              div.class = "backupFactorChooser";
              div.className = "backupFactorChooser hidden";
              formDiv.appendChild(div);

              formDiv.querySelector("#backupfactors-btn").addEventListener('click', function () {
                this.style.display = "none";
                var backupchooser = document.getElementById("backupFactorChooser");
                backupchooser.style.display = "block";
                backupchooser.innerHTML = '<div class="loader" data-res="loading-msg">Loading...</div>';
                if (username) {
                  self.sdk.getEnrollmentFactorsuserNameFirst({
                    "credentials": {
                      "username": username
                    }
                  });
                } else {
                  self.sdk.submitBackupFactors();
                }
              });
            }
          }

          this.replaceDiv("signin-div", formDiv, true);
        }
        else
          if (step === "enrollment") {
            // SMS special case where we need to 'submitCreds' during enrollment
            if (which === 'SMS' && payload.SMS && payload.SMS.credentials[0] === "otpCode") {
              (this.AuthenticationFactorInfo[which]["loginFormFunction"])(formDiv, payload);
            }
            else if (which === 'PHONE_CALL' && payload.PHONE_CALL && payload.PHONE_CALL.credentials[0] === "otpCode") {
              (this.AuthenticationFactorInfo[which]["loginFormFunction"])(formDiv, payload);
            }
            else {
              (this.AuthenticationFactorInfo[which]["enrollFormFunction"])(formDiv, payload);
            }
            this.replaceDiv("signin-div", formDiv, true);
          }
      }

  }

  // Builds the main form, allowing username/password posting + IDP selection
  // Logic has been moved into buildForm
  this.buildUidPwForm = function (formDiv, IDPdata) {
    this.buildForm(formDiv, "showUidPw", IDPdata, true);
  }

  // Builds the main form, allowing IDP selection
  this.buildIdpChooserForm = function (formDiv, IDPdata, isFirstForm) {
    this.buildForm(formDiv, "showIdp", IDPdata, isFirstForm);
  }

  //  builds the user name first form
  this.buildUidForm = function (formDiv, IDPdata) {
    this.buildForm(formDiv, "showUid", IDPdata, true);
  }

  // this function builds both the UID + PW and/or the IDP chooser form
  // this is all in one function to avoid duplicating code or comments
  // the boolean showUidPw determines whether to show the uid+pw portion
  this.buildForm = function (formDiv, showField, IDPdata, isFirstForm) {
    const self = this;
    var showUidOrUidPwFields = true;

    // always show the header message
    if (isFirstForm) {
      formDiv.innerHTML =
        '<h3 data-res="signin-hdr">Welcome</h3>';
    }

    let keepMeSignedIn = JSON.parse(this.getLoginCtx())["keepMeSignedInEnabled"];
    let checkbox = "";
    if (keepMeSignedIn) {
      checkbox = '<label><span><input type="checkbox" class="kmsi_checked" id="kmsi"><span>Keep me signed in</span></label>';
    }

    // then show the UID + PW form if needed
    switch (showField) {

      case "showUidPw":

        formDiv.innerHTML +=
          '<label><span data-res="signin-username-fld">Username</span><input type="text" id="userid" value="" required></label>' +
          '<label><span data-res="signin-password-fld">Password</span><input type="password" id="password" value="" required></label>';
        break;

      case "showUid":
        formDiv.innerHTML +=
          '<label><span data-res="signin-username-fld">Username</span><input type="text" id="userid" value="" required></label>';
        break;

      default:
        showUidOrUidPwFields = false;
    }

    if (showUidOrUidPwFields) {
      formDiv.innerHTML +=
        '<label class="error-msg" id="login-error-msg"></label>' + checkbox +
        '<button type="button" class="submit" id="submit-btn" data-res="signin-submit-btn">Sign In</button>' +
        '<div class="sameline"><a href="#" class="info" id="signin-forgot-pass" data-res="forgot-pw-btn">Forgot password?</a></div>';
    }

    // if both UID+PW and an IDP list are being shown then add the "OR" bit
    if (showUidOrUidPwFields && IDPdata) {
      formDiv.innerHTML += '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">OR sign in with</span><hr class="right"></div>';
    }

    // and finally build the IDP list
    if (IDPdata && IDPdata.configuredIDPs) {
      formDiv.innerHTML += '<label class="error-msg" id="social-login-error-msg"></label>';
      var idpDiv = document.createElement('div');
      idpDiv.align = 'center';
      IDPdata.configuredIDPs.forEach(function (idp) {

        // Bug #28769680
        if (idp.iconUrl === "null") {
          idp.iconUrl = undefined;
        }

        this.logMsg("Adding IDP to login page:");
        this.logMsg(JSON.stringify(idp))

        var btn = document.createElement('img');
        btn.title = idp.idpName;
        btn.src = idp.iconUrl;
        btn.className = 'external-idp-btn';
        var txt = document.createElement('span');
        txt.className = 'external-idp-btn';
        if (!idp.iconUrl) {
          var xhttp = new XMLHttpRequest();
          xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
              btn.src = '../images/custom-external-idp-icons/' + idp.idpName.toLowerCase() + '.png';
            }
            else {
              xhr_ = new XMLHttpRequest();
              xhr_.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                  btn.src = '../images/default-external-idp-icons/idcs-' + idp.idpName.toLowerCase() + '-icon.png';
                }
                else {
                  txt.innerText = idp.idpName;
                  if (idp.idpType === "Saml") {
                    btn.src = '../images/default-external-idp-icons/idcs-saml-icon.png';
                  }
                  else if (idp.idpType === "Social") {
                    btn.src = '../images/default-external-idp-icons/idcs-oidc-icon.png';
                  }
                  else {
                    btn.src = '../images/default-external-idp-icons/external-identity-provider-large-gray-82.png';
                  }
                }
              }
              xhr_.open('HEAD', '../images/default-external-idp-icons/idcs-' + idp.idpName.toLowerCase() + '-icon.png');
              xhr_.send();
            }
          };
          xhttp.open("HEAD", '../images/custom-external-idp-icons/' + idp.idpName.toLowerCase() + '.png', true);
          xhttp.send();
        }

        btn.addEventListener('click', function (event) {
          var name = idp.idpName;
          self.logMsg('IDP clicked: ' + name);

          var payload = {
            'requestState': self.getRequestState(),
            'idpName': idp.idpName,
            'idpId': idp.idpId,
            'clientId': self.getClientId(),
            'idpType': idp.idpType
          };
          self.sdk.chooseIDP(payload);
        });
        var displaybox = document.createElement("div");
        displaybox.className = "externalIdpBtn";
        displaybox.appendChild(btn);
        displaybox.appendChild(txt);
        idpDiv.appendChild(displaybox);
      });
      formDiv.appendChild(idpDiv);
    }

    // and now that we're done updating the HTML of that div we can
    // attach the event handlers for clicking or hitting enter
    if (showUidOrUidPwFields) {
      if (showField == "showUid") {
        this.handleClickToSubmitEvent(formDiv, this, 'postUserName');
        this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#userid"), this, 'postUserName');
      }
      else {
        this.handleClickToSubmitEvent(formDiv, this, 'postCreds');
        this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#password"), this, 'postCreds');
      }
      this.handleClickEvent(formDiv, this);
    }

    return formDiv;
  }; // this.buildForm

  // Builds the Email OTP form
  this.buildEmailOtpForm = function (formDiv, payload) {

    formDiv.innerHTML +=
      '<h3 data-res="otp-hdr">Verifying OTP</h3>' +
      '<div class="sameline"><span class="info" data-res="otp-info-msg">Please enter OTP code sent to </span><span class="device-name">' + formDiv.whichDisplayName + '</span></div>' +
      '<label><span data-res="otp-fld">OTP Code</span><input type="text" id="otpCode" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="otp-submit-btn">Verify</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'postEmailOtp');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#otpCode"), this, 'postEmailOtp');

  } // this.buildEmailOtpForm

  // Builds the Email OTP form
  this.buildSmsOtpForm = function (formDiv, payload) {

    formDiv.innerHTML +=
      '<h3 data-res="otp-hdr">Verifying OTP</h3>' +
      '<div class="sameline"><span class="info" data-res="otp-info-msg">Please enter OTP code sent to </span><span class="device-name">' + formDiv.whichDisplayName + '</span></div>' +
      '<label><span data-res="otp-fld">OTP Code</span><input type="text" id="otpCode" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="otp-submit-btn">Verify</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'postSmsOtp');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#otpCode"), this, 'postSmsOtp');

  } // this.buildSmsOtpForm

  this.buildPhoneCallOtpForm = function (formDiv, payload) {

    formDiv.innerHTML +=
      '<h3 data-res="otp-hdr">Verifying OTP</h3>' +
      '<div class="sameline"><span class="info" data-res="otp-info-msg">Please enter OTP code sent to </span><span class="device-name">' + formDiv.whichDisplayName + '</span></div>' +
      '<label><span data-res="otp-fld">OTP Code</span><input type="text" id="otpCode" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="otp-submit-btn">Verify</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'postPhoneCallOtp');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#otpCode"), this, 'postPhoneCallOtp');

  } // this.buildPhoneCallOtpForm

  // Builds the Security Questions form.
  this.buildSecQuestionsForm = function (formDiv, payload) {
    var secQuestionsInput = '';
    var elemIds = [];
    for (i = 0; i < payload.SECURITY_QUESTIONS.questions.length; i++) {
      secQuestionsInput += '<label><span>' + payload.SECURITY_QUESTIONS.questions[i].text + '</span><input type="password" id="' + payload.SECURITY_QUESTIONS.questions[i].questionId + '" required></label>';
      elemIds[i] = payload.SECURITY_QUESTIONS.questions[i].questionId;
    }

    formDiv.innerHTML +=
      '<h3 data-res="qa-hdr">Verifying Security Questions</h3>' +
      '<div class="sameline"><span class="info" data-res="qa-info-msg">Please provide the answers</span></div>' +
      secQuestionsInput +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="qa-submit-btn">Verify</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'postSecQuestions');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector('#' + elemIds[elemIds.length - 1]), this, 'postSecQuestions');
  } // this.buildSecQuestionsForm


  // Displays the form where the user can choose which factor in enroll in.
  this.displayEnrollmentOptionsForm = function (payload) {

    this.removeSignupFunction();
    const self = this;
    var enrollmentOptions = '';
    var buttonLabel;

    for (i = 0; i < payload.nextAuthFactors.length; i++) {
      let factor = payload.nextAuthFactors[i];
      if (this.AuthenticationFactorInfo[factor]) {
        enrollmentOptions +=
          '<div class="tooltip">' +
          '<button type="button" class="submit" id="' + factor + '" data-res="factor-' + factor.toLowerCase() + '-btn">' + this.AuthenticationFactorInfo[factor].label + '</button>' +
          '<span class="tooltiptext" data-res="factor-' + factor.toLowerCase() + '-desc">' + this.AuthenticationFactorInfo[factor].description + '</span>' +
          '</div><BR/>';
      }
    };

    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML =
      '<h3 data-res="enroll-hdr">Enabling 2-Step Verification</h3>' +
      '<div class="sameline"><span class="info" data-res="enroll-subhdr">Select a Method</span></div>' +
      enrollmentOptions;

    // this code iterates through the buttons and attaches the right function from AuthenticationFactorInfo to it
    var buttons = formDiv.getElementsByClassName("submit");
    for (i = 0; i < buttons.length; i++) {
      let button = buttons[i];
      let name = button.id;

      button.onclick = function (sender) {
        if (self.AuthenticationFactorInfo[sender.currentTarget.id]["initEnrollFormFunction"]) {
          (self.AuthenticationFactorInfo[sender.currentTarget.id]["initEnrollFormFunction"])();
        }
        else
          if (self.AuthenticationFactorInfo[sender.currentTarget.id]["enrollFormFunction"]) {
            self.displayForm(sender.currentTarget.id, "enrollment", {});
          }
      };
    }

    this.handleOptionalMFAEnrollment(payload, formDiv, this);

    this.replaceDiv("signin-div", formDiv, true);

  } // this.displayEnrollmentOptionsForm

  this.displayuserNameFirstNextAuth = function (payload) {
    const self = this;
    let email = payload.email;
    payload = payload.res;
    var passwordInput = '';

    let subdiv = document.createElement('div');
    subdiv.style.position = "relative";
    subdiv.style.right = "140px"
    subdiv.classList.add("alt-factor-pane");
    subdiv.id = "signin-div";

    if (payload.nextAuthFactors.includes("USERNAME_PASSWORD")) {
      passwordInput += '<h3 data-res="pw-hdr">Enter your Password</h3> ' +
        '<label><span data-res="signin-password-fld">Password</span><input type="password" id="password" value="" required></label>' +
        '<label class="error-msg" id="login-error-msg"></label>' +
        '<button type="button" class="submit" id="submitbtn" data-res="signin-submit-btn">Sign In</button>' +
        '<div class="sameline"><a href="#" class="info" id="signin-forgot-pass" data-res="forgot-pw-btn">Forgot password?</a></div>';

      subdiv.innerHTML =
        passwordInput;
      subdiv.querySelector("#submitbtn").onclick = () => {
        let data = JSON.stringify({
          "op": "credSubmit",
          "authFactor": "USERNAME_PASSWORD",
          "credentials": {
            "username": email,
            "password": document.getElementById("password").value
          },
          "requestState": this.getRequestState(),
        });
        this.sdk.authenticate(data)
      }

      if (payload.nextOp.indexOf("getBackupFactors") > 0) {
        // add the alternative button

        var divHr = document.createElement('div');
        divHr.classList.add('hr');
        divHr.innerHTML = '<hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right">';
        subdiv.appendChild(divHr);

        let altFactorsMsg = this.localizeMsg('backup-btn', 'Use an Alternative Factor');

        var altFactorsDivElem = document.createElement('div');
        altFactorsDivElem.classList.add('sameline');
        altFactorsDivElem.innerHTML = '<a href="#" class="info" id="backupfactors-btn">' + altFactorsMsg + '</a>';
        subdiv.appendChild(altFactorsDivElem);

        var div = document.createElement("div");
        div.id = "backupFactorChooser";
        div.class = "backupFactorChooser";
        div.className = "backupFactorChooser hidden";
        subdiv.appendChild(div);

        subdiv.querySelector("#backupfactors-btn").addEventListener('click', function () {
          this.style.display = "none";
          var backupchooser = document.getElementById("backupFactorChooser");
          backupchooser.style.display = "block";
          backupchooser.innerHTML = '<div class="loader" data-res="loading-msg">Loading...</div>';

          self.sdk.getEnrollmentFactorsuserNameFirst({
            "credentials": {
              "username": email
            }
          });
        });
      }

      this.replaceDiv("signin-div", subdiv, true);
    } else if (payload.nextAuthFactors.length > 1 && payload.nextAuthFactors.includes("USERNAME") && payload.nextOp.includes("credSubmit")) {
      let nextAuthFactors = payload.nextAuthFactors;
      nextAuthFactors.splice(nextAuthFactors.indexOf("USERNAME"), 1);
      nextAuthFactors.splice(nextAuthFactors.indexOf("IDP"), 1);
      this.displayForm(nextAuthFactors[0], "submitCreds", payload, email);
    }

    var signinDivParent = document.getElementById("signin-div");

    if ((payload.IDP) && (payload.IDP.configuredIDPs.length > 0)) {
      var formIDPDiv = document.createElement('div');
      formIDPDiv.id = 'idp-div';
      formIDPDiv.classList.add("pwdless-width");
      formIDPDiv.innerHTML =
        '<div class="hr"> <hr class="left"><span class="hr-text" data-res="or-msg">Or sign in with</span><hr class="right"></div>';
      this.buildIdpChooserForm(formIDPDiv, payload.IDP, false);
      signinDivParent.appendChild(formIDPDiv);
    }

    var backToLoginDiv = document.getElementById("back-to-login-btn");

    if (!backToLoginDiv) {
      var backToLoginDivElem = document.createElement('div');
      backToLoginDivElem.classList.add('newline');
      backToLoginDivElem.classList.add("pwdless-width");
      backToLoginDivElem.innerHTML = '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">Or</span><hr class="right"></div>';
      backToLoginDivElem.innerHTML += '<a href="#" id="back-to-login-btn" data-res="back-to-login-msg">Back to Login</a>';
      signinDivParent.appendChild(backToLoginDivElem);

      document.getElementById("back-to-login-btn").onclick = function () {
        self.sdk.initAuthentication();
      };
    }
  } // this.displayuserNameFirstNextAuth

  // Builds the OTP enrollment form, where OTPs are sent to the user's email.
  this.buildOtpEmailEnrollmentForm = function (formDiv, payload) {
    this.logMsg("Building OTP Email Enrollment Form");

    formDiv.innerHTML +=
      '<h3 data-res="enroll-otp-hdr">Enrolling in OTP over E-Mail</h3>' +
      '<div class="sameline"><span class="info" data-res="enroll-otp-info-msg">Please, enter OTP sent to </span><span class="device-name">' + payload.displayName + '</span></div>' +
      '<label><span data-res="enroll-otp-fld">OTP Code</span><input type="text" id="otpCode" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="enroll-otp-submit-btn">Enroll</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'enrollOtpEmail');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#otpCode"), this, 'enrollOtpEmail');

  } // this.buildOtpEmailEnrollmentForm

  this.buildFidoEnrollmentForm = function (formDiv, payload) {
    this.setRequestState(payload.requestState);
    this.logMsg("Building FIDO Enrollment Form");
    register(payload).then(function (credential) {
      self.fidoCallback(credential);
    });
  } // this.buildFidoEnrollmentForm

  this.buildFidoAuthenticationForm = function (formDiv, payload) {
    '<h3 data-res="fido-hdr">Verifying Fido Authentication</h3>';
    formDiv.innerHTML +=
      '<div class="newline">' +
      '<span class="info" data-res="fido-info-msg">Complete the Fido authentication </span>' +
      '</div>';

    this.setRequestState(payload.requestState);
    this.logMsg("Building FIDO Enrollment Form");
    authenticate(payload).then(function (credential) {
      self.fidoCallback(credential);
    });
  } // this.buildFidoAuthenticationForm


  this.fidoCallback = function (fidoAssertionResponse) {
    var details = {};
    var credentials = {};
    details.op = "credSubmit";
    details.origin = window.location.origin;
    credentials.fidoAssertion = encodeJson(fidoAssertionResponse);
    details.credentials = credentials;
    details.requestState = this.getRequestState();
    self.sdk.authenticate(JSON.stringify(details));
  }

  // Displays the form for SMS enrollment, where the user provides his mobile phone number and receives an OTP in it.
  this.buildSMSMobileEnrollmentForm = function (formDiv, payload) {
    this.logMsg("Building the SMS Mobile Enrollment Form ");
    formDiv.noResend = true;
    formDiv.innerHTML =
      '<h3 data-res="enroll-sms-hdr">Enrolling in OTP over SMS</h3>' +
      '<div class="sameline"><span class="info" data-res="enroll-sms-info-msg">Please, enter mobile number to send SMS</span></div>' +
      '<label><span data-res="enroll-sms-fld">Mobile Number</span><input type="text" id="mobileNumber" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="enroll-sms-submit-btn">Enroll</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'initEnrollMobileNumber');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#mobileNumber"), this, 'initEnrollMobileNumber');

  } // this.buildSMSMobileEnrollmentForm

  // Displays the form for PHONE_CALL enrollment, where the user provides his  phone number and receives an OTP in it.
  this.buildPhoneCallMobileEnrollmentForm = function (formDiv, payload) {
    this.logMsg("Building the Phone Call Mobile Enrollment Form ");
    formDiv.noResend = true;
    formDiv.innerHTML =
      '<h3 data-res="enroll-phone-call-hdr">Enrolling in OTP over Phone Call</h3>' +
      '<div class="sameline"><span class="info" data-res="enroll-phone-call-info-msg">Please, enter phone number to make Phone Call</span></div>' +
      '<label><span data-res="enroll-phone-call-fld">Mobile Number</span><input type="text" id="mobileNumber" required></label>' +
      '<label><span><input type="checkbox" id="landlineFlag" data-res="landline-flag"><span data-res="enroll-phone-call-landline-flag">Landline</span></label><label><span>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="enroll-phone-call-submit-btn">Enroll</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'initEnrollPhoneNumber');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#mobileNumber"), this, 'initEnrollPhoneNumber');

  } // this.buildPhoneCallMobileEnrollmentForm

  // social registration page
  this.displaySocialRegistrationForm = function (socialData) {

    const self = this;

    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';

    formDiv.innerHTML =
      '<h3 data-res="social-socialRegisterUser-hdr">Social Registration</h3>' +
      '<label><span data-res="social-email-fld">Email</span><input type="text" id="social-email" readonly></label>' +
      '<label><span data-res="social-givenName-fld">First Name</span><input type="text" id="social-givenName"></label>' +
      '<label><span data-res="social-familyName-fld">Last Name</span><input type="text" id="social-familyName"></label>' +
      '<label><span data-res="social-phoneNo-fld">Phone #</span><input type="text" id="social-phoneNo"></label>' +
      '<label><span data-res="social-mobileNo-fld">Mobile Phone #</span><input type="text" id="social-mobileNo"></label>' +
      '<button type="button" class="submit" id="social-submit-btn" data-res="social-submit-btn">Register</button>' +
      '<button type="button" class="submit" id="social-cancel-btn" data-res="social-cancel-btn">Cancel</button>';

    // prepopulate using values from ID TOKEN...
    formDiv.querySelector("#social-email").value = socialData.userData.userName;
    formDiv.querySelector("#social-givenName").value = socialData.userData.givenName;
    formDiv.querySelector("#social-familyName").value = socialData.userData.familyName;

    formDiv.querySelector("#social-submit-btn").onclick = function () {
      var data = {};
      data.op = "socialRegister";
      data.socialSCIMAttrs = {};
      data.socialSCIMAttrs.userName = socialData.userData.userName;
      data.socialSCIMAttrs.email = socialData.userData.email;
      data.socialSCIMAttrs.givenName = formDiv.querySelector("#social-givenName").value;
      data.socialSCIMAttrs.familyName = formDiv.querySelector("#social-familyName").value;
      data.socialSCIMAttrs.phoneNo = formDiv.querySelector("#social-mobileNo").value;
      data.userMappingAttr = "email";
      data.callbackUrl = "http://www.google.com"; //dummy! api will break without it...
      data.requestState = self.getRequestState();
      self.sdk.authenticate(JSON.stringify(data));
    };

    formDiv.querySelector("#social-cancel-btn").onclick = function () {
      self.removeSocialData();
      window.location.href = './signin.html';
    }

    self.replaceDiv("signin-div", formDiv, true);
    // remove the 'Sign-Up' button
    var button = document.querySelector('.img__btn');
    button.parentNode.removeChild(button);
  }

  // Builds the form for security questions enrollment.
  this.buildSecurityQuestionsEnrollmentForm = function (formDiv, payload) {
    this.logMsg("Display Security Questions Setup Form");
    this.logMsg("Payload: " + JSON.stringify(payload));

    formDiv.innerHTML =
      '<h3 data-res="enroll-qa-hdr">Enrolling in Security Questions</h3>' +
      '<div class="sameline"><span class="info" data-res="enroll-qa-info-msg">Enter an answer for each chosen question</span></div>';

    var numOfQuestions = payload.SECURITY_QUESTIONS.secQuesSettings.numQuestionsToSetup;
    this.logMsg("numOfQuestions=" + numOfQuestions);

    var questions = payload.SECURITY_QUESTIONS.questions;
    this.logMsg("Questions " + JSON.stringify(questions));

    var listCount = questions.length;
    var qIndex;
    for (qIndex = 0; qIndex < numOfQuestions; qIndex++) {
      var selectLabel = document.createElement('label');
      var sel = document.createElement('select');
      sel.id = "sel-" + qIndex;
      selectLabel.appendChild(sel);

      var answerLabel = document.createElement('label');
      answerLabel.innerHTML = '<span data-res="enroll-qa-answer-fld">Answer</span><input type="password" id="ans-' + qIndex + '" required>';

      var hintLabel = document.createElement('label');
      hintLabel.innerHTML = '<span data-res="enroll-qa-hint-fld">Hint</span><input type="text" id="hint-' + qIndex + '">';

      for (i = 0; i < listCount; i++) {
        var opt = document.createElement('option');
        opt.innerHTML = questions[i].text;
        opt.value = questions[i].text;
        opt.id = questions[i].questionId;
        sel.appendChild(opt);
      }
      formDiv.appendChild(selectLabel);
      formDiv.appendChild(answerLabel);
      formDiv.appendChild(hintLabel);
    }

    formDiv.innerHTML +=
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="enroll-qa-submit-btn">Enroll</button>';

    this.handleClickToSubmitEvent(formDiv, self, 'enrollSecurityQuestions');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector('#ans-' + (qIndex - 1)), self, 'enrollSecurityQuestions');

  } // this.displaySecurityQuestionsEnrollmentForm

  // Displays enrollment success message and allows the user to enroll in another factor.
  this.displayEnrollmentSuccess = function (payload) {

    this.removeSignupFunction();

    const self = this;
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML =
      '<h3 data-res="enroll-hdr">Enabling 2-Step Verification</h3>' +
      '<div class="sameline">' +
      '<span class="info" data-res="enroll-success-hdr">2-Step verification method has been set successfully.</span>' +
      '</div>' +
      '<button type="button" class="submit" id="submit-btn" data-res="enroll-success-btn">Done</button>';

    if (payload.nextOp.indexOf("enrollment") >= 0) {
      formDiv.innerHTML +=
        '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right"></div>' +
        '<div class="sameline">' +
        '<a href="#" id="submit-btn-factor" data-res="enroll-anotherfactor-btn">Enroll Another Factor</a>' +
        '</div>';
    }

    this.replaceDiv("signin-div", formDiv, true);

    document.getElementById("submit-btn").onclick = function () {
      if (payload.nextOp.indexOf("createToken") >= 0) {
        self.sdk.createToken();
      }
      else {
        self.sdk.getEnrollmentFactors();
      }
    };

    // Button event listener for enroll in another factors should only be available if enrollment is in nextOp array.
    // Part of bug fix reported on 12/04/18 by Pulkit Agarwal.
    if (payload.nextOp.indexOf("enrollment") >= 0) {
      document.getElementById("submit-btn-factor").onclick = function () {
        self.sdk.getEnrollmentFactors();
      };
    }


  } // this.displayEnrollmentSuccess

  // Initiates enrollment in Time-Based OTP. The user will be sent a QR code to enroll his device (via OMA App) and asked to enter the TOTP.
  this.initEnrollOtpTotp = function (payload) {
    this.removeSignupFunction();

    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML = '<div class="loader" data-res="loading-msg">Loading...</div>';

    this.replaceDiv("signin-div", formDiv, true);

    this.sdk.initEnrollOtpTotp();
  } // this.initEnrollOtpTotp

  this.showAppLink = function () {
    var IS_IPAD = navigator.userAgent.match(/iPad/i) != null,
      IS_IPHONE = !IS_IPAD && ((navigator.userAgent.match(/iPhone/i) != null) || (navigator.userAgent.match(/iPod/i) != null)),
      IS_IOS = IS_IPAD || IS_IPHONE,
      IS_ANDROID = !IS_IOS && navigator.userAgent.match(/android/i) != null,
      IS_MOBILE = IS_IOS || IS_ANDROID;

    // we're mimicking the behavior of the OOTB form here
    // iPhones (but not iPads) and android devices will show the link that opens the OMA app
    if (IS_IPHONE || IS_ANDROID) {
      return true;
    }
    else {
      return false;
    }
  } //  this.showAppLink()

  // Builds the form for Time-Based OTP, where the user is asked to enter the TOTP that shows up in his/her enrolled device (via OMA App)
  this.buildTOTPForm = function (formDiv, payload) {

    // Enrolling
    var qrCode = payload.TOTP ? payload.TOTP.qrCode : false;
    if (qrCode) {
      if (qrCode.content) {
        let url = new URL(qrCode.content);
        this.setSelectedDevice(url.searchParams.get("Deviceid"));
      }
      buttonText = "Enroll";
      dataResKey = "enroll-totp-submit-btn";

      formDiv.innerHTML += '<h3 data-res="enroll-totp-hdr">Enrolling in time-based OTP</h3>';

      if (this.showAppLink()) {
        formDiv.innerHTML +=
          '<div class="newline">' +
          '<a href="' + qrCode.content + '"><span class="info qrcode-text" data-res="enroll-taplink-msg">Tap to enroll your phone.</span></a>' +
          '<span class="info qrcode-text" data-res="enroll-totp-respond-msg">Then enter the code in the field below.></span>' +
          '</div>';
      }
      else {
        formDiv.innerHTML +=
          '<div class="newline">' +
          '<span class="info qrcode-text" data-res="enroll-totp-scan-msg">Scan the QR code with the Oracle Mobile Authenticator App.</span>' +
          '<span class="info qrcode-text" data-res="enroll-totp-respond-msg">Then enter the code in the field below.</span>' +
          '</div>' +
          '<div class="qrcode-img">' +
          '<img id="enrollimage" src="data:' + qrCode.imageType + ";base64," + qrCode.imageData + '" />' +
          '</div>';
      }
    }

    // Verifying
    else {
      buttonText = "Login";
      dataResKey = "totp-submit-btn";

      formDiv.innerHTML += '<h3 data-res="totp-hdr">Verifying Time-based OTP</h3>';
      formDiv.innerHTML += '<div class="sameline"><span class="info" data-res="totp-info-msg">Please enter TOTP code as displayed in </span><span class="device-name">' + formDiv.whichDisplayName + '</span></div>';
    }

    formDiv.innerHTML +=
      '<label><span data-res="enroll-totp-fld">Time-based OTP Code</span><input type="text" id="otpCode" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="' + dataResKey + '">' + buttonText + '</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'submitTOTP', payload.alternate);
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#otpCode"), this, 'submitTOTP', payload.alternate);
  } //this.buildTOTPForm

  // Builds the form for push notifications enrollment via OMA App.
  this.buildPushEnrollForm = function (formDiv, payload) {
    qrCode = payload.PUSH.qrCode;

    formDiv.innerHTML += '<h3 data-res="enroll-push-hdr">Enrolling in Push Notifications</h3>';

    if (this.showAppLink()) {
      formDiv.innerHTML +=
        '<div class="sameline"><a href="' + qrCode.content + '"><span class="info qrcode-text" data-res="enroll-taplink-msg">Tap to enroll your phone.</span></a></div>';
    }
    else {
      formDiv.innerHTML +=
        '<div class="sameline"><span class="info qrcode-text" data-res="enroll-push-scan-msg">Scan the QR code with the Oracle Mobile Authenticator App.</span></div>' +
        '<div class="qrcode-img">' +
        '<img id="enrollimage" src="data:' + qrCode.imageType + ";base64," + qrCode.imageData + '" />' +
        '</div>';
    }

    formDiv.innerHTML += '<label class="error-msg" id="login-error-msg"></label>';

    this.submitPushPoll(3000);
  } // this.buildPushEnrollForm

  this.buildPushLoginForm = function (formDiv, payload) {
    formDiv.innerHTML =
      '<h3 data-res="push-hdr">Verifying Push Notification</h3>';
    if (formDiv.whichDisplayName) {
      formDiv.innerHTML +=
        '<div class="newline">' +
        '<span class="info" data-res="push-info-msg">Notification sent to the Authenticator App on the following mobile device:</span>' +
        '<span class="device-name">' + formDiv.whichDisplayName + '</span>' +
        '</div>';
    }
    else {
      formDiv.innerHTML +=
        '<div class="newline">' +
        '<span class="info" data-res="push-info-nodisplayname-msg">Notification sent to the Authenticator App on your mobile device</span>' +
        '</div>';
    }
    formDiv.innerHTML +=
      '<div class="sameline">' +
      '<span class="info" data-res="push-approve-info-msg">You must approve it for moving forward.</span>' +
      '</div>' +
      '<div class="loader" data-res="loading-msg">Loading...</div>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<div id="submit-btn"></div>';
    this.submitPushPoll(3000);
  } //this.buildPushLoginForm

  // Builds a form for entering a bypass code.
  this.buildBypasscodeLoginForm = function (formDiv, payload) {
    formDiv.innerHTML +=
      '<h3 data-res="bypass-hdr">Bypass Code</h3>' +
      '<div class="sameline"><span class="info" data-res="bypass-info-msg">Provide your bypass code</span></div>' +
      '<label><span data-res="bypass-fld">Bypass Code</span><input type="text" id="bypassCode" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="bypass-submit-btn">Submit</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'submitBypasscode');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#bypassCode"), this, 'submitBypasscode');

  } // this.buildBypasscodeLoginForm

  // Build the Terms of Use form
  this.buildTermsForm = function (formDiv, payload) {
    formDiv.innerHTML +=
      '<div class="consent">' +
      '<div class="consenttext">' + payload.TOU.statement + '</div>' +
      '<div class="consentcheckbox"><input type="checkbox" id="termsconsent"/>' +
      '<span style="display:none"></span>' +
      '<span data-res="signin-termsconsent">I Agree</span></div>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '</div>' +
      '<button type="button" class="submit" id="submit-btn" data-res="bypass-submit-btn">Submit</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'submitAcceptTerms');

  } // buildTermsForm

  // Displays a form with backup factors the user can choose from
  this.displayAltFactorsSubform = function (payload, username) {
    const self = this;
    let otherFactorsDiv = document.createElement('div');
    otherFactorsDiv.classList.add("alt-factor-pane");
    otherFactorsDiv.innerHTML += '<div class="alt-factor-header"><span class="info" data-res="backup-msg">Choose an alternative authentication method:</span></div>';

    // which factor is currently on screen?
    let currentFactor = document.getElementById("signin-div").whichFactorForm;
    // which device displayName is currently being used?
    let displayNameOnScreen = document.getElementById("signin-div").whichDisplayName;

    payload.nextAuthFactors.forEach(function (factor) {
      if (self.AuthenticationFactorInfo[factor]) {
        // Case when user is enrolled with the same factor via multiples devices.
        if (payload[factor] && payload[factor].enrolledDevices) {
          for (i = 0; i < payload[factor].enrolledDevices.length; i++) {
            if (displayNameOnScreen != payload[factor].enrolledDevices[i].displayName || currentFactor !== factor) {
              let div = document.createElement('div');
              //div.classList.add("tooltip");
              div.classList.add("alt-factor-row");
              div.innerHTML +=
                '<button type="button" class="alt-factor-button" data-res="factor-' + factor.toLowerCase() + '-msg-short" id="' + factor + '">' + factor + '</button><div class="alt-factor-text"><span data-res="factor-' + factor.toLowerCase() + '-msg">' + self.AuthenticationFactorInfo[factor].label + '</span>&nbsp;<span class=device-name>' + payload[factor].enrolledDevices[i].displayName + '</span></div>';
              //                '<span class="tooltiptext" data-res="factor-' + factor.toLowerCase() + '-desc">' + self.AuthenticationFactorInfo[factor].description + '</span>';
              let currentDevice = payload[factor].enrolledDevices[i];
              div.querySelector('.alt-factor-button').addEventListener('click', function (event) {
                self.logMsg(currentDevice.displayName + ':' + currentDevice.deviceId);
                self.initiateAlternativeFactor(factor, payload, currentDevice, username);
              });
              otherFactorsDiv.appendChild(div);
            }
          }
        }
        else {
          // Case where multiple devices is not supported.
          if (currentFactor && currentFactor !== factor) {
            let div = document.createElement('div');
            //div.classList.add("tooltip");
            div.classList.add("alt-factor-row");
            div.innerHTML +=
              '<button type="button" class="alt-factor-button" data-res="factor-' + factor.toLowerCase() + '-msg-short" id="' + factor + '">' + factor + '</button><div class="alt-factor-text"><span data-res="factor-' + factor.toLowerCase() + '-msg">' + self.AuthenticationFactorInfo[factor].label + '</span></div>';
            //            '<span class="tooltiptext" data-res="factor-' + factor.toLowerCase() + '-desc">' + self.AuthenticationFactorInfo[factor].description + '</span>';
            div.querySelector('.alt-factor-button').addEventListener('click', function (event) {
              self.initiateAlternativeFactor(factor, payload, null, username);
            });
            otherFactorsDiv.appendChild(div);
          }
        }
      };
    });

    this.replaceDiv("backupFactorChooser", otherFactorsDiv, false);
  };

  this.initiateAlternativeFactor = function (factor, payload, device, username) {
    this.logMsg('Alternative factor selected: ' + factor);
    // Need to save selected device here, so it can be retrieved back later in the flow,
    // as notice that a roundtrip to IDCS is needed for factors that require some initiation.
    this.setSelectedDevice(device);
    // Setting payload.alternate=true because some factors may require a different request body when used as alternative factor.
    // This is currently (as of Jan19) the case of TOTP.
    payload.alternate = 'true';
    this.stopPushPoll(); // we must stop polling for push because a new factor has been chosen.
    var credentials = {};
    if (device) {
      credentials.deviceId = device.deviceId;
    };
    if (username) {
      credentials.username = username;
    }
    switch (factor) {
      case 'EMAIL':
        this.sdk.initAuthnOtpEmail(credentials);
        break;
      case 'SMS':
        this.sdk.initAuthnMobileNumber(credentials);
        break;
      case 'PHONE_CALL':
        this.sdk.initAuthnPhoneNumber(credentials);
        break;
      case 'TOTP':
        this.displayForm(factor, "submitCreds", payload, username);
        break;
      case 'PUSH':
        this.sdk.initAuthnPush(credentials);
        break;
      case 'SECURITY_QUESTIONS':
        this.displayForm(factor, "submitCreds", payload, username);
        break;
      case 'BYPASSCODE':
        this.displayForm(factor, "submitCreds", payload, username);
        break;
      case 'USERNAME_PASSWORD':
        // this.displayForm(factor, "submitCreds", payload);
        this.displayuserNameFirstNextAuth({ "res": payload, "email": username });
        break;
      case 'FIDO_AUTHENTICATOR':
        this.sdk.initAuthnFido(credentials);
        break;
      default:
        this.logMsg('Unrecognized alternative factor: ' + factor);
    }

  }

  // Displays a form for just for password.  This is displayed during the user name first flow.
  this.displayPasswordForm = function (payload) {

    const self = this;
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    var userId = document.getElementById("userid");
    formDiv.innerHTML =
      '<h3 data-res="pw-hdr">Enter your Password</h3>' +
      '<div class="sameline"><span class="info" data-res="pw-info-msg">Please enter your for password.</span></div>' +
      '<label><span data-res="uid-fld"></span><input type="hidden" id="userid" required value="' + userId.value + '"> </label>' +
      '<label><span data-res="pw-fld">Password</span><input type="password" id="password" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="pw-submit-btn">Submit</button>' +
      '<div class="sameline"><a href="#" class="info" id="signin-forgot-pass" data-res="forgot-pw-btn">Forgot password?</a></div>';

    this.handleClickToSubmitEvent(formDiv, this, 'postCreds');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#password"), this, 'postCreds');
    this.handleClickEvent(formDiv, this);

    var backToLoginDivElem = document.createElement('div');
    backToLoginDivElem.classList.add('newline');
    backToLoginDivElem.innerHTML = '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right"></div>';
    backToLoginDivElem.innerHTML += '<a href="#" id="back-to-login-btn" data-res="back-to-login-msg">Back to Login</a>';
    formDiv.appendChild(backToLoginDivElem);

    if ((payload.IDP) && (payload.IDP.configuredIDPs.length > 0)) {
      var formIDPDiv = document.createElement('div');
      formIDPDiv.id = 'idp-div';
      formIDPDiv.innerHTML =
        '<h3 data-res="idp-hdr">Choose your IDP</h3>';
      this.buildIdpChooserForm(formIDPDiv, payload.IDP, false);
      formDiv.appendChild(formIDPDiv);
    }

    this.replaceDiv("signin-div", formDiv, true);

    document.getElementById("back-to-login-btn").onclick = function () {
      self.sdk.initAuthentication();
    };

  } // this.displayPassWordForm

  //  This form is displayed for user name first flow.
  this.displayIDPChooserForm = function (payload) {
    const self = this;

    //  if a single IDP exists, then redirect to that IDP
    if (payload.IDP.configuredIDPs.length == 1) {
      var idp = payload.IDP.configuredIDPs[0];
      var singleIDPPayload = {
        'requestState': self.getRequestState(),
        'idpName': idp.idpName,
        'idpId': idp.idpId,
        'clientId': self.getClientId(),
        'idpType': idp.idpType
      };
      self.sdk.chooseIDP(singleIDPPayload);
    }
    else {
      var formDiv = document.createElement('div');
      formDiv.classList.add("form");
      formDiv.classList.add("sign-in");
      formDiv.id = 'signin-div';
      formDiv.innerHTML =
        '<h3 data-res="pw-hdr">Choose your IDP</h3>';

      this.replaceDiv("signin-div", formDiv, true);

      this.buildIdpChooserForm(formDiv, payload.IDP, false);
    }
  }

  // Displays a form for forgotPassword flow with username as input.
  this.displayForgotPassWordForm = function (payload) {

    const self = this;
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML =
      '<h3 data-res="forgot-pw-hdr">Forgot your Password?</h3>' +
      '<div class="sameline"><span class="info" data-res="forgot-pw-info-msg">Please, enter username for password reset.</span></div>' +
      '<label><span data-res="forgot-pw-fld">Username</span><input type="text" id="forgotUserName" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="forgot-pw-submit-btn">Submit</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'getPasswordMethod');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#forgotUserName"), this, 'getPasswordMethod');

    var backToLoginDivElem = document.createElement('div');
    backToLoginDivElem.classList.add('newline');
    backToLoginDivElem.innerHTML = '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right"></div>';
    backToLoginDivElem.innerHTML += '<a href="#" id="back-to-login-btn" data-res="back-to-login-msg">Back to Login</a>';
    formDiv.appendChild(backToLoginDivElem);

    this.replaceDiv("signin-div", formDiv, true);

    document.getElementById("back-to-login-btn").onclick = function () {
      self.sdk.initAuthentication();
    };

  } // this.displayForgotPassWordForm

  // Displays a form for notification type in forgot password flow - email or sms.
  this.displayForgotPassWordMethodForm = function (payload, username) {

    const self = this;
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML =
      '<h3 data-res="forgot-pw-hdr">Forgot your Password?</h3>' +
      '<div class="sameline"><span class="info" data-res="forgot-pw-mth-msg">Please select the method for password reset:</span></div>' +
      '<input type="hidden" id="forgotUserName" name="forgotUserName" value="' + username + '"/>';

    for (i = 0; i < payload.options.length; i++) {  // TODO: Fix the radio button layout
      var currentType = payload.options[i].type;
      if (currentType === "email") {
        formDiv.innerHTML +=
          '<input type="hidden" id="userEmail" name="userEmail" value="' + payload.options[i].value + '"/>';
      }
      if (i == 0) {
        formDiv.innerHTML +=
          '<input type="radio" name="pwmethod" id="' + currentType + '" value="' + currentType + '" checked/>' +
          '<label for="' + currentType + '">' + currentType + '</label>';
      }
      else {
        formDiv.innerHTML +=
          '<input type="radio" name="pwmethod" id="' + currentType + '" value="' + currentType + '" />' +
          '<label for="' + currentType + '">' + currentType + '</label>';
      }
    }

    formDiv.innerHTML +=
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="forgot-pw-submit-btn">Submit</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'forgotPassword');

    for (i = 0; i < payload.options.length; i++) {
      var currentType = payload.options[i].type;
      this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#" + currentType), this, 'forgotPassword');
    }

    var backToLoginDivElem = document.createElement('div');
    backToLoginDivElem.classList.add('newline');
    backToLoginDivElem.innerHTML = '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right"></div>';
    backToLoginDivElem.innerHTML += '<a href="#" id="back-to-login-btn" data-res="back-to-login-msg">Back to Login</a>';
    formDiv.appendChild(backToLoginDivElem);

    this.replaceDiv("signin-div", formDiv, true);

    document.getElementById("back-to-login-btn").onclick = function () {
      self.sdk.initAuthentication();
    };

  } // this.displayForgotPassWordMethodForm

  // Displays a form for notification type in forgot password flow - sms.
  this.displayForgotPassWordSmsForm = function (payload, username) {
    this.logMsg("Building Forgot Password SMS Form");
    const self = this;
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML =
      '<h3 data-res="forgot-pw-hdr">Forgot your Password?</h3>' +
      '<input type="hidden" id="forgotUserName" name="forgotUserName" value="' + username + '"/>' +
      '<input type="hidden" id="deviceId" name="deviceId" value="' + payload.deviceId + '"/>' +
      '<input type="hidden" id="requestId" name="requestId" value="' + payload.requestId + '"/>' +
      '<label><span data-res="forgot-pw-sms-fld">Enter your SMS Code:</span><input type="text" id="smsCode" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="forgot-pw-submit-btn">Submit</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'processPasswordMethod');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#smsCode"), this, 'processPasswordMethod');

    var backToLoginDivElem = document.createElement('div');
    backToLoginDivElem.classList.add('newline');
    backToLoginDivElem.innerHTML = '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right"></div>';
    backToLoginDivElem.innerHTML += '<a href="#" id="back-to-login-btn" data-res="back-to-login-msg">Back to Login</a>';
    formDiv.appendChild(backToLoginDivElem);

    this.replaceDiv("signin-div", formDiv, true);

    document.getElementById("back-to-login-btn").onclick = function () {
      self.sdk.initAuthentication();
    };
  } // this.displayForgotPassWordSmsForm

  // Displays a form for notification type in forgot password flow - secquestsion.
  this.displayForgotPassWordSecquestionForm = function (payload, username) {
    this.logMsg("Building Forgot Password Secquestion Form");
    const self = this;
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML =
      '<h3 data-res="forgot-pw-hdr">Forgot your Password?</h3>' +
      '<div class="sameline"><span class="info" data-res="forgot-pw-sec-msg">' + payload.secquestions[0].localizedQuestionText + ' </span></div>' +
      '<label><span data-res="sec-pw-fld">Answer: </span><input type="text" id="secAnswer" required></label>' +
      '<input type="hidden" id="forgotUserName" name="forgotUserName" value="' + username + '"/>' +
      '<input type="hidden" id="questionId" name="questionId" value="' + payload.secquestions[0].questionId + '"/>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="forgot-pw-submit-btn">Submit</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'processPasswordMethod');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#secAnswer"), this, 'processPasswordMethod');

    var backToLoginDivElem = document.createElement('div');
    backToLoginDivElem.classList.add('newline');
    backToLoginDivElem.innerHTML = '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right"></div>';
    backToLoginDivElem.innerHTML += '<a href="#" id="back-to-login-btn" data-res="back-to-login-msg">Back to Login</a>';
    formDiv.appendChild(backToLoginDivElem);

    this.replaceDiv("signin-div", formDiv, true);

    document.getElementById("back-to-login-btn").onclick = function () {
      self.sdk.initAuthentication();
    };
  } // this.displayForgotPassWordSecquestionForm

  // Displays a form for notification type in forgot password flow - email.
  this.displayForgotPassWordEmailForm = function (payload, username) {
    this.logMsg("Building Forgot Password EMail Form");
    const self = this;
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML =
      '<h3 data-res="forgot-pw-hdr">Forgot your Password?</h3>' +
      '<div class="sameline"><span class="info" data-res="email-pw-mth-msg">Please enter the token you recieved via E-Mail:</span></div>' +
      '<input type="hidden" id="forgotUserName" name="forgotUserName" value="' + username + '"/>' +
      '<label><span data-res="email-pw-fld">Token: </span><input type="text" id="emailToken" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="forgot-pw-submit-btn">Submit</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'processPasswordMethod');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#emailToken"), this, 'processPasswordMethod');

    var backToLoginDivElem = document.createElement('div');
    backToLoginDivElem.classList.add('newline');
    backToLoginDivElem.innerHTML = '<div class="hr"><hr class="left"><span class="hr-text" data-res="or-msg">OR</span><hr class="right"></div>';
    backToLoginDivElem.innerHTML += '<a href="#" id="back-to-login-btn" data-res="back-to-login-msg">Back to Login</a>';
    formDiv.appendChild(backToLoginDivElem);

    this.replaceDiv("signin-div", formDiv, true);

    document.getElementById("back-to-login-btn").onclick = function () {
      self.sdk.initAuthentication();
    };

  } // this.displayForgotPassWordEmailForm

  // Displays forgotPassword Success
  this.displayForgotPassWordSuccess = function (payload, username) {
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.whichForm = "FORGOT_PASSWORD_FORM";
    formDiv.innerHTML =
      '<h3 data-res="forgot-pw-hdr">Forgot your Password?</h3>' +
      '<div class="sameline"><span class="info" data-res="forgot-pw-success-info-msg">An email with reset password instructions has been sent for username: </span><span> ' + username + ' </span></div>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<input type="hidden" id="forgotUserName" name="forgotUserName" value="' + username + '"/>';

    this.replaceDiv("signin-div", formDiv, true);
  } // this.displayForgotPassWordSuccess

  // Builds the Reset Password form, Post validation of usertoken
  this.displayResetPassWordForm = function (usertoken) {
    this.logMsg("Building Reset Password Form");

    this.shortlived_token = usertoken;
    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML +=
      '<h3 data-res="reset-pw-hdr">Reset Password</h3>' +
      '<div class="sameline"><span class="info" data-res="reset-pw-info-msg">Please, fill out password and confirm password.</span></div>' +
      '<label><span data-res="reset-pw-fld">Password</span><input type="password" id="resetPassword" required></label>' +
      '<label><span data-res="reset-pw-confirm-fld">Confirm Password </span><input type="password" id="confresetPassword" required></label>' +
      '<label class="error-msg" id="login-error-msg"></label>' +
      '<button type="button" class="submit" id="submit-btn" data-res="reset-pw-submit-btn">Submit</button>';

    this.handleClickToSubmitEvent(formDiv, this, 'resetPassword');
    this.handleKeyPressToSubmitEvent(formDiv, formDiv.querySelector("#confresetPassword"), this, 'resetPassword');

    this.replaceDiv("signin-div", formDiv, true);

  } // this.displayResetPassWordForm

  // Builds the Reset Password Success Page, Post validation of password policies and resetting user password
  this.displayResetPassWordSuccess = function () {
    this.logMsg("Building Reset Password Success page");

    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-in");
    formDiv.id = 'signin-div';
    formDiv.innerHTML +=
      '<h3 data-res="reset-pw-hdr">Reset Password</h3>' +
      '<div class="sameline">' +
      '<span class="info" data-res="reset-pw-success-info-msg">Your password has been successfully reset.</span>' +
      '<span class="info" data-res="reset-pw-windows-close-msg">You can close this window.</span>' +
      '</div>' +
      '<label class="error-msg" id="login-error-msg"></label>';

    this.replaceDiv("signin-div", formDiv, true);

  } // this.displayResetPassWordSuccess

  // This method works as the app main controller, directing requests to the appropriate methods based on the received payload from IDCS.
  this.nextOperation = function (payload, username) {

    this.logMsg("nextOperation: " + this.mask(payload));

    if (payload.requestState && payload.nextOp) {

      this.setRequestState(payload.requestState);

      if (payload.nextOp[0] === 'credSubmit') {
        if (payload.nextAuthFactors) {

          if (payload.nextAuthFactors.includes('USERNAME_PASSWORD')) {
            this.displayPasswordForm(payload);
          }
          if (payload.nextAuthFactors.includes('IDP')) {
            this.displayIDPChooserForm(payload);
          }

          //    else {
          var sameFactorMultipleDevices = false;
          payload.nextAuthFactors.forEach(function (factor) {
            if (payload[factor] && payload[factor].enrolledDevices && payload[factor].enrolledDevices.length > 0) {
              sameFactorMultipleDevices = true;
            }
          });
          // Fix on bug reported by Pulkit Agarwal on 12/04/18. Used to happen when MFA is active for a Social User that isn't registered in IDCS.
          // We must send the user to enrollment where enrollment is also in nextOp array.
          if (payload.nextOp[1] === "enrollment") {
            this.displayEnrollmentOptionsForm(payload);
          }
          // End of fix.
          // If there's more than one nextAuthFactor or multiple devices for the same factor, we go to alternative factors flow.
          else if (payload.nextAuthFactors.length > 1 && payload.nextAuthFactors.includes("USERNAME") && payload.nextOp.includes("credSubmit")) {
            if (!this.getUnPwOrigin() || this.getUnPwOrigin() === "true") {
              this.setPreferredFactor({ factor: payload.nextAuthFactors[0], displayName: payload.displayName });
              this.setUnPwOrigin("false");
            }
            this.displayForm(payload.nextAuthFactors[0], "submitCreds", payload);
          }
          else if (payload.nextAuthFactors.length > 1 || sameFactorMultipleDevices) {
            this.displayAltFactorsSubform(payload, username);
          }

          else {
            // ER #1
            // Doing this because the API response not always tell whether the factor is the preferred one.
            // Setting the user preferred factor. It's the one returned from username/password submit.
            // We may also come here via Social Login, in which case the origin is undefined.
            if (!this.getUnPwOrigin() || this.getUnPwOrigin() === "true") {
              this.setPreferredFactor({ factor: payload.nextAuthFactors[0], displayName: payload.displayName });
              this.setUnPwOrigin("false");
            }
            // End of ER #1.
            this.displayForm(payload.nextAuthFactors[0], "submitCreds", payload);
            //       }
          }
        }
        else
          if (payload.nextOp.indexOf('enrollment') == -1) { // Alternative factors case
            which = Object.keys(self.AuthenticationFactorInfo).filter(function (x) { return x in payload; });
            this.logMsg('nextOperation: Factor is ' + which[0]);

            if (typeof which[0] === 'undefined') { // PUSH alternative factor case, when there's no 'PUSH' in the payload.
              if (payload.status === 'pending' && payload.cause && payload.cause[0].code === 'AUTH-1108') {
                let signinDiv = document.getElementById("signin-div");
                if (signinDiv && signinDiv.whichFactorForm === "PUSH") {
                  self.logMsg(signinDiv.whichFactorForm + " is active");
                  this.logMsg('Waiting on ' + signinDiv.whichFactorForm + '[submitCreds] with payload ' + this.mask(payload));
                }
                else {
                  this.logMsg('About to display form for PUSH [submitCreds] with payload ' + this.mask(payload));
                  this.displayForm("PUSH", "submitCreds", payload, username);
                }
              }
            }
            else {
              this.logMsg('About to display form for ' + which[0] + '[submitCreds] with payload ' + this.mask(payload));
              this.displayForm(which[0], "submitCreds", payload, username);
            }

          }
          else
            if (payload.EMAIL || payload.SECURITY_QUESTIONS || payload.PUSH || payload.TOTP || payload.FIDO_AUTHENTICATOR) {
              which = Object.keys(self.AuthenticationFactorInfo).filter(function (x) { return x in payload; });
              this.logMsg('which[0] is ' + which[0]);
              this.displayForm(which[0], "enrollment", payload);
            }
            else
              if (payload.nextOp[1] === "enrollment") {
                which = Object.keys(self.AuthenticationFactorInfo).filter(function (x) { return x in payload; });
                this.displayForm(which[0], "enrollment", payload);
              }
              else
                if (payload.SMS && payload.SMS.credentials[0] === "otpCode") {
                  which = Object.keys(self.AuthenticationFactorInfo).filter(function (x) { return x in payload; });
                  this.logMsg('which[0] is ' + which[0]);
                  this.displayForm(which[0], "enrollment", payload);
                }
                else
                  if (payload.PHONE_CALL && payload.PHONE_CALL.credentials[0] === "otpCode") {
                    which = Object.keys(self.AuthenticationFactorInfo).filter(function (x) { return x in payload; });
                    this.logMsg('which[0] is ' + which[0]);
                    this.displayForm(which[0], "enrollment", payload);
                  }
                  else {
                    this.logMsg('Do not know what to do with given payload.');
                  }
      }
      // Fix on bug reported by Pulkit Agarwal on 12/04/18. Used to happen when there was only one MFA method active.
      // Added the check payload.nextOp.indexOf('createToken') >= 0 below.
      else if (payload.nextOp.indexOf('enrollment') >= 0 || payload.nextOp.indexOf('createToken') >= 0) {
        if (!payload.nextAuthFactors) {
          this.displayEnrollmentSuccess(payload);
        }
        else {
          this.displayEnrollmentOptionsForm(payload);
        }
      }
      else if (payload.nextOp[0] === 'acceptTOU') {
        this.displayForm('TOU', "submitCreds", payload);
      }
      else {
        this.logMsg('Do not know what to do with given payload.');
      }
    }
  }; // this.nextOperation

  /* ----------------------------------------------------------------------------------------------------------------
     -------------------------------------------- HELPER METHODS ----------------------------------------------------
     ---------------------------------------------------------------------------------------------------------------- */

  this.addErrorDetailsIfAny = function (errorElem, details) {
    if (details != null) {
      var detailsDiv = document.createElement('div');
      detailsDiv.classList.add('newline');
      for (i = 0; i < details.length; i++) {
        detailsDiv.innerHTML += '<span class="error-msg-detail">' + details[i] + '</span>';
      }
      errorElem.appendChild(detailsDiv);
    }
  }

  this.handleBackendError = function (error) {
    var errorMsg = '';
    if (error) {
      errorMsg = error.msg;
      if (error.code.indexOf('AUTH-1120') != -1) {
        errorMsg = this.localizeMsg('error-AUTH-1120', 'Invalid state. Please, reinitiate login');
      }
      else if (error.code.indexOf('AUTH-1112') != -1) {
        errorMsg = this.localizeMsg('error-AUTH-1112', 'Access denied');
      }
      else if (error.code.indexOf('SDK-AUTH') != -1) {
        errorMsg = this.localizeMsg('error-' + error.code, error.msg);
      }
      else if (error.code.indexOf('SSO-') != -1 && error.msg === 'undefined') {
        errorMsg = this.localizeMsg('error-' + error.code, '<Undefined error message>');
      }
      else {
        this.logMsg('Passing backend error message as is: ' + errorMsg);
      }
    }
    return errorMsg;
  }

  this.changeButtonOnError = function (button) {
    if (button) {
      button.style.display = 'block';
      button.disabled = false;
    }
  }

  this.clearErrorsOnScreenIfAny = function () {
    var socialErrorElem = document.getElementById("social-login-error-msg");
    if (socialErrorElem) {
      socialErrorElem.innerHTML = '';
    }
    var loginErrorElem = document.getElementById("login-error-msg");
    if (loginErrorElem) {
      loginErrorElem.innerHTML = '';
    }
  }

  this.setLoginErrorMessage = function (error) {

    this.clearErrorsOnScreenIfAny();

    var errorElemId = "login-error-msg";
    if (error.type === 'social') {
      errorElemId = "social-login-error-msg";
    }

    this.stopPushPoll();
    this.removeSpinner();
    var errorMsg = this.handleBackendError(error);

    var errorElem = document.getElementById(errorElemId);
    if (errorElem) {

      this.changeButtonOnError(document.querySelector("#submit-btn"));
      errorElem.innerHTML = errorMsg;
      this.addErrorDetailsIfAny(errorElem, error.details);
    }
    else {
      var formDiv = document.createElement('div');
      formDiv.id = 'signin-div';
      formDiv.classList.add('form');

      var errorLabel = document.createElement('label');
      errorLabel.id = errorElemId;
      errorLabel.classList.add('error-msg');
      errorLabel.innerHTML = errorMsg;

      formDiv.appendChild(errorLabel);
      this.replaceDiv("signin-div", formDiv, true)
    }
  }

  this.getBackendErrorMsg = function () {
    var error = sessionStorage.getItem('backendError'); // This is set by the server-side backend
    if (error) {
      sessionStorage.removeItem('backendError');
      return error;
    }
    return;
  }

  this.encodeValueChars = function (str) {
    return (
      encodeURIComponent(str)
        // Note that although RFC3986 reserves "!", RFC5987 does not,
        // so we do not need to escape it
        .replace(/['()]/g, escape) // i.e., %27 %28 %29
        .replace(/\*/g, "%2A")
        // The following are not required for percent-encoding per RFC5987,
        // so we can allow for a little better readability over the wire: |`^
        .replace(/%(?:7C|60|5E)/g, unescape)
    );
  }

  this.htmlEscape = function (string) {
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  this.setAccessToken = function (at) {
    return sessionStorage.setItem("signinAT", at);
  }

  this.getAccessToken = function () {
    return sessionStorage.getItem("signinAT");
  }

  this.isIDPUserInIDCS = function () {
    return sessionStorage.getItem("isIDPUserInIDCS");
  }

  this.getIDPAuthnToken = function () {
    return sessionStorage.getItem("IDPAuthnToken");
  }

  this.getSocialData = function () {
    var socialData = {};
    socialData.requestState = this.getRequestState();
    socialData.userData = JSON.parse(sessionStorage.getItem('social.scimUserAttrs'));
    return socialData;
  };

  this.isSocialRegistrationRequired = function () {
    var isRequired = sessionStorage.getItem("social.needToRegister");
    if (isRequired && isRequired === 'true') {
      return true;
    } else {
      return false;
    }
  };

  this.removeSocialData = function () {
    sessionStorage.removeItem('social.scimUserAttrs');
    sessionStorage.removeItem('social.needToRegister');
  }

  this.getLoginCtx = function () {
    return sessionStorage.getItem("initialState");
  }

  this.setRequestState = function (rs) {
    sessionStorage.setItem("requestState", rs);
  }

  this.getRequestState = function () {
    return sessionStorage.getItem("requestState");
  }

  this.getClientId = function () {
    return sessionStorage.getItem("clientId");
  }

  this.getInitialState = function () {
    return sessionStorage.getItem("initialState");
  }

  this.setTrustedDeviceOption = function (trusted) {
    sessionStorage.setItem("isDeviceTrusted", trusted);
  }

  this.getTrustedDeviceOption = function () {
    return sessionStorage.getItem("isDeviceTrusted");
  }

  // Issue #1
  // The following six methods were introduced to support the preferred device feature.
  this.setPreferredFactor = function (factor) {
    sessionStorage.setItem("preferredFactor", JSON.stringify(factor));
  }

  this.getPreferredFactor = function () {
    return JSON.parse(sessionStorage.getItem("preferredFactor"));
  }

  // This captures the device object (containing deviceId and displayName) selected by the user.
  this.setSelectedDevice = function (device) {
    this.logMsg('Setting selectedDevice: ' + JSON.stringify(device));
    sessionStorage.setItem("device", JSON.stringify(device));
  }

  this.getSelectedDevice = function () {
    var selectedDevice = sessionStorage.getItem("device")
    this.logMsg('Getting selectedDevice: ' + selectedDevice);
    try {
      return JSON.parse(selectedDevice);
    }
    catch (e) {
      return null;
    }
  }

  // As of IDCS 18.4.2, the preferred factor is the factor returned as a result of successful username/password submit.
  // So it must be stored and retrieved at a later time.
  this.setUnPwOrigin = function (flag) {
    sessionStorage.setItem("unPwOrigin", flag)
  }

  this.getUnPwOrigin = function () {
    return sessionStorage.getItem("unPwOrigin");
  }
  // End of Issue #1.

  // This object is used mostly by method displayForm, telling it which form to build.
  const self = this;
  this.AuthenticationFactorInfo = {
    USERNAME_PASSWORD: {
      // this one is only used for the initial login screen
      label: "Username and password",
      loginFormFunction: function (formdiv, payload) { self.buildUidPwForm(formdiv, payload); },
    },
    USERNAME: {
      // this one is only used for the initial login screen
      label: "Username",
      loginFormFunction: function (formdiv, payload) { self.buildUidForm(formdiv, payload); },
    },
    IDP: {
      // If the admin removes "local IDP" in the IDP Policies then IDCS asks custom login app
      // to display only the IDP chooser on the intiial form
      label: "Select an IDP",
      loginFormFunction: function (formdiv, payload) { self.buildIdpChooserForm(formdiv, payload.IDP, true); },
    },
    EMAIL: {
      label: "Email",
      description: "Send an email with a code to use",
      initEnrollFormFunction: function () { self.displayForm("spinner"), self.sdk.initEnrollOtpEmail(); },
      enrollFormFunction: function (formDiv, payload) { self.buildOtpEmailEnrollmentForm(formDiv, payload); },
      loginFormFunction: function (formdiv, payload) { self.buildEmailOtpForm(formdiv, payload); },
    },
    FIDO_AUTHENTICATOR: {
      label: "Fido Authenticator",
      description: "Fido Authentication",
      initEnrollFormFunction: function () { self.displayForm("spinner"), self.sdk.initEnrollFido(); },
      enrollFormFunction: function (formDiv, payload) { self.buildFidoEnrollmentForm(formDiv, payload); },
      loginFormFunction: function (formdiv, payload) { self.buildFidoAuthenticationForm(formdiv, payload); },
    },
    SECURITY_QUESTIONS: {
      label: "Security Questions",
      description: "Security question and answers",
      initEnrollFormFunction: function () { self.displayForm("spinner"), self.sdk.initEnrollSecurityQuestions(); },
      enrollFormFunction: function (formDiv, payload) { self.buildSecurityQuestionsEnrollmentForm(formDiv, payload); },
      loginFormFunction: function (formdiv, payload) { self.buildSecQuestionsForm(formdiv, payload); },
    },
    SMS: {
      label: "SMS",
      description: "SMS to Mobile Number",
      enrollFormFunction: function (formDiv, payload) { self.buildSMSMobileEnrollmentForm(formDiv, payload); },
      loginFormFunction: function (formdiv, payload) { self.buildSmsOtpForm(formdiv, payload); },
    },
    PHONE_CALL: {
      label: "PHONE_CALL",
      description: "Make a Phone Call to deliver OTP",
      enrollFormFunction: function (formDiv, payload) { self.buildPhoneCallMobileEnrollmentForm(formDiv, payload); },
      loginFormFunction: function (formdiv, payload) { self.buildPhoneCallOtpForm(formdiv, payload); },
    },
    PUSH: {
      label: "Oracle Authenticator App",
      description: "Pop-up on the Oracle Mobile Authenticator",
      initEnrollFormFunction: function () { self.displayForm("spinner"), self.sdk.initEnrollPush(); },
      enrollFormFunction: function (formDiv, payload) { self.buildPushEnrollForm(formDiv, payload); },
      loginFormFunction: function (formdiv, payload) { self.buildPushLoginForm(formdiv, payload); },
    },
    TOTP: {
      label: "Time-based OTP",
      description: "OTP code from the Oracle Mobile Authenticator or another TOTP app.",
      initEnrollFormFunction: function () { self.displayForm("spinner"), self.sdk.initEnrollOtpTotp(); },
      // this is not a mistake - buildTOTPForm does both enroll and regular
      enrollFormFunction: function (formDiv, payload) { self.buildTOTPForm(formDiv, payload); },
      loginFormFunction: function (formdiv, payload, device) { self.buildTOTPForm(formdiv, payload); },
    },
    BYPASSCODE: {
      label: "Bypass code",
      description: "Use a security bypass code from your list",
      loginFormFunction: function (formdiv, payload) { self.buildBypasscodeLoginForm(formdiv, payload); },
    },
    TOU: {
      label: "Terms of Use",
      description: "Terms of Use",
      loginFormFunction: function (formdiv, payload) { self.buildTermsForm(formdiv, payload); },
    }
    // If/when enginering adds a new factor begin by copying and then uncommenting this block
    // NEW_ONE: {
    //   label: "New mechanism",
    //   description: "Update the description (used in the tooltip and elsewhere)",
    //   // then figure out which of these three you need.
    //   // initEnrollFormFunction is used when the user clicks if we need to make a REST call to kick things off
    //   initEnrollFormFunction: function (...args) { self.ToBeImplemented("NEW_ONE: enroll");},
    //   enrollFormFunction: function (...args) { self.ToBeImplemented("NEW_ONE: enroll");},
    //   loginFormFunction: function (...args) { self.ToBeImplemented("NEW_ONE: login");},
    // }
  }

  this.getOperation = function () {
    return sessionStorage.getItem("operation");
  }

  this.getToken = function () {
    return decodeURIComponent(sessionStorage.getItem("token"));
  }

  this.ToBeImplemented = function (which) {
    alert("Case " + which + " needs to be implemented!");
  }

  this.sdk = new IdcsAuthnSDK(this);
  this.sdk.initAuthentication();
}; // function loginApp

const loginApp = new LoginApp();
loginApp.localize(document);
