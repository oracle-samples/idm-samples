
// these two "polyfills" add .startsWith and .endsWith for Strings to browsers
// that don't have them built in. At this point I believe that's just IE

if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(search, this_len) {
    if (this_len === undefined || this_len > this.length) {
      this_len = this.length;
    }
    return this.substring(this_len - search.length, this_len) === search;
  };
}
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(search, pos) {
    return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
  };
}


function RegisterApp() {
/* RegisterApp is a copied and modified LoginApp for purpose of Self Registration
 * Construct is pretty much like LoginApp.
 * This does following :
 * Displays Self Reg Form
 * Displays Self Reg Success Form
 * Gets Application Context Error (when applicable)
 */
  this.baseUri = sessionStorage.getItem("baseUri");
  this.selfRegProfiles = sessionStorage.getItem("selfRegProfiles");
  this.debugEnabled = sessionStorage.getItem("debugEnabled") && (sessionStorage.getItem("debugEnabled").toLowerCase() == "true");

  this.registrationProfiles = undefined;

  this.localize = function() {
    if (typeof resources !== 'undefined') {
      var resElms = document.querySelectorAll('[data-res]');
      for (var n = 0; n < resElms.length; n++) {
        var elem = resElms[n];
        var resKey = elem.getAttribute('data-res');
        if ( resources[resKey] ) {
          elem.innerHTML = resources[resKey];
        }
        else {
          this.logWarning( "Translation missing for resource key '" + resKey + "'");
        }
      }
    }
  } // this.localize

  this.mask = function(msg) {
    let propsToMask = ['username','password','userid','emails.value'];
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
    catch(e) {
      return stars;
    }
  } //this.mask

  this.logMsg = function(msg) {
    if (window.console && this.debugEnabled) {
      console.log('RegisterApp: ' + msg);
    }
  } // this.logMsg

  this.logWarning = function(msg) {
    console.log('RegisterApp (WARNING): ' + msg);
  }

  this.removeSignupFunction = function() {
    Array.prototype.slice.call(document.querySelectorAll('.hidelater')).forEach(function(e) {
      e.style.visibility = "hidden";
    });
  }

  this.replaceDiv = function(divid,replacement,dofocus) {
      // divname is the ID of the div to replace
      // replacement is the Element to replace it with
      // dofocus says "set the focus to the first text input"

      var oldForm = document.getElementById(divid);
      if ( ! oldForm ) {
        throw( "Could not find div to replace" );
      }

      oldForm.parentNode.replaceChild(replacement, oldForm);

      this.localize();

      // find the first text input field and put the focus there
      if ( dofocus ) {
        let firstInput = document.getElementById(divid).querySelector('input[type="text"]');
        if (firstInput) firstInput.focus();
      }
  }

  this.validateForm = function(formDiv) {
    // Cleaning up any errors displaying on screen.
    this.setRegisterErrorMessage(undefined, '');
    // Looking for input fields marked as required and empty.
    const inputFields = formDiv.getElementsByTagName("INPUT");
    var isError = false;
    var passwordField = undefined;
    var passwordConfField = undefined;
    for (i=0; i < inputFields.length; i++) {
      this.logMsg('Validating field ' + inputFields[i].name);
      let thisInput = inputFields[i]
      if (thisInput.required && thisInput.value.trim() === '') {
        isError = true;
        // Toggling the element class for styling on error.
        thisInput.classList.add('on__error');
      }
      if ( thisInput.id.endsWith(".password") ) {
        passwordField = thisInput;
      }
      else
      if ( thisInput.id.endsWith(".password_conf") ) {
        passwordConfField = thisInput;
      }
    }
    if (isError) {
      this.setRegisterErrorMessage("error-required-fld", 'Required field empty');
      return false;
    }

    if ( ( passwordField ) &&
         ( passwordField.value != passwordConfField.value ) ) {
      passwordField.classList.add("on__error");
      passwordConfField.classList.add("on_error");
      this.setRegisterErrorMessage("signup-passwordmatch", "Password and Confirm Password do not match");
      return false;
    }

    return true;
  }

  this.displaySpinner = function() {
    var spinnerDiv = document.createElement('div');
    spinnerDiv.classList.add("sign-up");
    spinnerDiv.id = 'signup-div';
    spinnerDiv.innerHTML = '<label><div class="loader" data-res="loading-msg">Loading...</div></label>';
    this.replaceDiv("signup-div",spinnerDiv,false);
  }

  this.selectLocalized = function( textOptions ) {
    // headerText and footerText contain an array of different possible text
    // bits to show they each look like (but only one has default=true)
    // {
    //   "default": true,
    //   "locale": "en-US",
    //   "value": "foo"
    // }
    // selectLocalized picks the "best" one to show
    if ( textOptions.length == 1 ) {
      // if there's only one then return that one
      return textOptions[0].value;
    }
    // get the user's language
    // we're going to use the same code as in the rest of this app to get the language
    var preferredLang = window.navigator.userLanguage || window.navigator.language;
    // and also (for browsers that support it) we get the LIST of localizations
    var allLangs = window.navigator.languages;

    var defaultOption = undefined;
    var bestMatch = undefined;

    // loop through the textOptions to see if we have a match
    for ( var x in textOptions ) {
      var thisOpt = textOptions[x];
      // when we find the default save it away
      if ( thisOpt["default"] ) {
        defaultOption = thisOpt;
      }
      if ( thisOpt["locale"] == preferredLang ) {
        return thisOpt["value"];
      }
      // if we haven't had a good match yet AND the first 2 chars match then
      // it's not perfect but it's the best option so far
      if ( ( !bestMatch ) &&
           ( (thisOpt["locale"]).substring(0, 2) == preferredLang.substring(0, 2) ) ) {
             bestMatch = thisOpt;
      }
    }

    if ( bestMatch ) {
      return bestMatch["value"];
    }
    return defaultOption["value"];

  } // this.selectLocalized

  this.displaySelfRegForm = function(payload) {
    const self = this;

    self.logMsg("Displaying Sign Up Form");
    self.registrationProfiles = payload;
    self.logMsg("UI profile fields:");
    self.logMsg(JSON.stringify(self.registrationProfiles,null,2));

    var signupFormDiv = document.createElement('div');
    signupFormDiv.classList.add("form");
    signupFormDiv.classList.add("sign-up");
    signupFormDiv.id = 'signup-div';

    // build the registration form dynamically
    var defaultProfile = undefined;

    if ( Object.keys(self.registrationProfiles).length == 0 ) {
      signupFormDiv.innerHTML += '<span id="signup-noprofiles" class="error-msg" data-res="signup-noprofile">No registration profiles available</span>';
    }
    else
    if ( Object.keys(self.registrationProfiles).length == 1 ) {
      // I left this as a separate "if" in case you want to do something special
      // when there's only one available Self Reg profile
      defaultProfile = Object.keys(self.registrationProfiles)[0];
    }
    else
    if ( Object.keys(self.registrationProfiles).length > 1 ) {
      defaultProfile = Object.keys(self.registrationProfiles)[0];
      // then we need a drop down

      // we have to do this as a string and then add it in one step b/c of how
      // .innerHTML works
      let html = '<div class="sameline"><span class="info" data-res="signup-chooseprofile">Choose a Self Registration Profile</span></div>' +
                 '<div class="sameline"><select id="regProfileSelector">';
      for (var key in self.registrationProfiles) {
        html += '<option';
        // 0'th is always default. But this works too.
        if ( key === defaultProfile ) {
          html += ' selected="selected"';
        }
        html += ' value="' + key + '"';
        html += '>' + self.selectLocalized(self.registrationProfiles[key].displayName) + '</option>';
      }
      html += '</select></div>';
      signupFormDiv.innerHTML += html;
    }

    // tuck this away here for convenient access later
    signupFormDiv.ActiveProfileName=defaultProfile;

    var profileFootersDiv = document.createElement('div');
    profileFootersDiv.style.className = "newline";

    // RegistrationProfiles can have the same fields but in different orders
    // to allow for that we create one div for each reg profile that we want
    // to present to the user
    for (var prof in self.registrationProfiles) {
      self.logMsg("Creating Self Reg profile div for profile " + prof);
      var thisProfile = self.registrationProfiles[prof]

      var profileFormDiv = document.createElement('div');
      profileFormDiv.style.display="block";

      // we give it a good id so we can find it later
      profileFormDiv.id = 'SIGNUPPROFILE.' + prof;

      profileFormDiv.innerHTML +=
        '<input type="hidden" id="' + profileFormDiv.id + '.ProfileID" value="' + thisProfile.profileID + '">' +
        '<input type="hidden" id="' + profileFormDiv.id + '.ProfileName" value="' + prof + '">';

      // if there's header text & logo we show that
      var profileHeaderDiv = document.createElement('div');
      profileFootersDiv.style.className = "newline";
      if ( thisProfile.headerLogoURL ) {
        profileHeaderDiv.innerHTML += '<img src="' + thisProfile.headerLogoURL + '"/>';
      }
      if ( thisProfile.headerText ) {
        profileHeaderDiv.innerHTML += self.selectLocalized( thisProfile.headerText );
      }
      profileFormDiv.appendChild(profileHeaderDiv);

      // this for loop adds an input field for each field requested by the profile
      for ( var i=0;i<thisProfile.fields.length;i++ ) {
        var field = thisProfile.fields[i]
        self.logMsg( "Field # " + i.toString()+ " of " + self.registrationProfiles[prof].fields.length.toString() );
        self.logMsg( "Field: " + JSON.stringify(field,null,2) );

        let html = '<label><span>' + field.display + '</span>';

        let inputName = profileFormDiv.id + '.' + field.name;
        if ( field.name == "password" ) {
          // watch out for password
          // if we are asked for one we build an extra field for the confirmation
          // at the same time
          html += '<input type="password" id="' + inputName + '" name="' + inputName + '" required></label>' +
                  '<label><span>Confirm Password</span>' +
                  '<input type="password" id="' + inputName + '_conf" name="' + inputName + '_conf" required>';
        }
        // any other special cases should go here
        else
        if ( field.name.endsWith(".primary") ) {
          // drop the current html (so the label doesn't show) and replace it
          // we'll swap the string "true" to bool later
          html = '<label><input type="hidden" id="' + inputName + '" name="' + inputName + '" value="true"/>';
        }
        else
        if ( field.name == "emails.type" ) {
          // see bugdb # 27664213
          html = '<label><input type="hidden" id="' + inputName + '" name="' + inputName + '" value="work"/>';
        }
        // end of special cases
        else
        if ( field.options ) {
          // then it's a select
          html += '<select id="' + inputName + '">';
          for ( var y=0;y<field.options.length;y++) {
            html += '<option>' + field.options[y] + '</option>';
          }
          html += '</select>';
        }
        else
        if ( field.type == "boolean" ) {
          html += '<input type="checkbox" id="' + inputName + '" name="' + inputName + '" required>';
        }
        else
        if ( field.type == "string" ) {
          html += '<input type="text" id="' + inputName + '" name="' + inputName + '" required>';
        }
        html += '</label>';

        profileFormDiv.innerHTML += html;
      } // end of each field

      // if consentText is present display it and a checkbox saying "I Agree"
      if (thisProfile.consentText) {
        let inputName = profileFormDiv.id + '.consent';

        let html = '<div class="consent">' +
                     '<div class="consenttext">' + self.selectLocalized( thisProfile.consentText ) + '</div>' +
                     '<div class="consentcheckbox"><input type="checkbox" id="' + inputName + '"/><span data-res="signup-consent">I Agree</span></div>' +
                   '</div>';

        profileFormDiv.innerHTML += html;

      }

      signupFormDiv.appendChild(profileFormDiv);

      // then build the footer for under the button
      var profileFooterDiv = document.createElement('div');
      profileFooterDiv.style="display:block";
      // profileFooterDiv.style.display="block";
      // we give it a good id so we can find it later
      profileFooterDiv.id = 'SIGNUPPROFILE.FOOTER.' + prof;
      if ( thisProfile.footerLogoURL ) {
        profileFooterDiv.innerHTML += '<img src="' + thisProfile.footerLogoURL + '"/>';
      }
      if ( thisProfile.footerText ) {
        profileFooterDiv.innerHTML += self.selectLocalized( thisProfile.footerText );
      }
      profileFootersDiv.appendChild( profileFooterDiv );

    }

    // and then append the bottom bits
    // we have to have a single button and error message rather than one per profile
    // because when displaying an error message the code looks for the one with id= "error-msg"
    // We *COULD* change that but I don't want to do that because this is
    // consistent with what we did in the login app
    signupFormDiv.innerHTML +=
      // and then the error message and submit button
      '<label class="error-msg" id="register-error-msg"></label>' +
      '<button type="button" class="submit" id="signup-btn" data-res="signup-btn">Sign Up</button>';

    // then append the divs for the form footers
    signupFormDiv.appendChild( profileFootersDiv );

    signupFormDiv.querySelector("#signup-btn").addEventListener('click', function() {

      // find the right <div> for the active profile
      // this is where we use signupFormDiv.ActiveProfileName
      let whichProfile = signupFormDiv.ActiveProfileName;

      var activeForm = document.getElementById( "SIGNUPPROFILE." + whichProfile);
      // validate the form first
      if (self.validateForm(activeForm)) {
        // then construct JSON to pass down to SDK
        var inputs = activeForm.querySelectorAll("input,select");
        var payload = {};
        let trimLen = ( "SIGNUPPROFILE." + whichProfile + ".").length; // I'll explain in a sec
        for (var n = 0; n < inputs.length; n++) {
          let e = inputs[n];
          // e.id will be "SIGNUPPROFILE." + the profile name + "." + the field name
          // we just want to send the last part, BUT remember that might include a .
          // so trim off the front
          let pFieldName = e.id.substring(trimLen);

          // any fields we need to ignore?
          if ( pFieldName == "password_conf" ) { continue; }

          let val = e.value; // default to the .value
          // but special cases for valued get caught here
          if ( e.type == "checkbox" ) {
            val = e.checked; // set it to the boolean
          }
          else
          if ( pFieldName.endsWith(".primary") ) {
            val = true;
          }
          payload[ pFieldName ] = val;
        }


        // If you prefer disabling the button to replacing it with a spinner
        // use these lines instead. Be sure to change the other place as well
        // signupFormDiv.querySelector("#signup-btn").disabled = true;
        // signupFormDiv.querySelector("#signup-btn").classList.add("disabled")
        
        self.removeBtnAndShowSpinner(this);

        self.logMsg( "Sending payload to SDK: " + self.mask(payload) );
        self.selfregSDK.registerUser(payload);
      }
    });

    // now add the show/hide capability
    // but only if we have more than one profile
    if ( Object.keys(self.registrationProfiles).length > 1 ) {
      signupFormDiv.querySelector("#regProfileSelector").addEventListener('change', function() {
        var activeProfile = signupFormDiv.querySelector("#regProfileSelector").value;
        self.logMsg("Setting active profile to " + activeProfile);
        signupFormDiv.ActiveProfileName=activeProfile;

        var resElms = signupFormDiv.querySelectorAll("div");
        for (var n = 0; n < resElms.length; n++) {
          let e = resElms[n];
          if ( e.id.startsWith('SIGNUPPROFILE.') ) {
            if ( ( e.id == 'SIGNUPPROFILE.' + activeProfile ) ||
                 ( e.id == 'SIGNUPPROFILE.FOOTER.' + activeProfile ) ){
              e.style.display="block";
            }
            else {
              e.style.display="none";
            }
          }
        }
      });


      // If you recall there is one extra option added to the end of the profiles
      // we now change the selected option to =defaultProfile. That will invoke
      // the "on change" above and show/hide the right fields
      // formDiv.querySelector("#regProfileSelector").value=defaultProfile;
      // formDiv.querySelector("#regProfileSelector").onchange();

      // formDiv.querySelector("#regProfileSelector").blur();
      // formDiv.querySelector("#regProfileSelector").focus();


      // document.createEvent and initEvent() are deprecated
      // but the other syntax (i.e. new Event() ) doesn't work in IE
      var event = document.createEvent("HTMLEvents");
      event.initEvent('change', false, true);
      // When IE is dead and buried we can switch to something like this:
      // var event = new Event( "change", {"bubbles":true, "cancelable":false} );

      // We then "fire" the event.
      // This will have the same effect as if the user clicked and changed it.
      // Which fires the above event handler and shows/hides the fields needed
      signupFormDiv.querySelector("#regProfileSelector").dispatchEvent(event);
    }
    self.replaceDiv("signup-div",signupFormDiv,false);
  } // this.displaySelfRegForm

  this.removeBtnAndShowSpinner = function(btn) {
    btn.style.display = 'none';
    var spinnerDiv = document.createElement('div');
    spinnerDiv.classList.add('loader');
    spinnerDiv.data_res = 'loading-msg';
    spinnerDiv.innerHTML = 'Loading...';
    // Showing the spinner after btn
    btn.parentNode.insertBefore(spinnerDiv, btn.nextSibling);
  }
  
  this.removeSpinner = function() {
    let spinner = document.querySelector("div.loader");
    if (spinner != null) {
      spinner.parentNode.removeChild(spinner);
    }
  }

  this.encodeHTML = function(str){
      return str.replace(/[\u00A0-\u9999<>&](?!#)/gim, function(i) {
        return '&#' + i.charCodeAt(0) + ';';
      });
  }

  this.displaySelfRegistrationSuccess = function(payload , step) {
    const self = this;
    var buttonLabel;
    var navigtext;

    var formDiv = document.createElement('div');
    formDiv.classList.add("form");
    formDiv.classList.add("sign-up");
    formDiv.id = 'signup-div';

    switch (step) {
      case 'registration':
        formDiv.innerHTML =
          '<h3><span data-res="signup-hello-msg">Hello</span> ' + this.encodeHTML(payload.displayName) + '.<BR><span data-res="signup-reg-success-msg">Your registration was successful. You should receive a confirmation email shortly.</span></h3>'+
          '<input type="hidden" id="uname" value="' + this.encodeHTML(payload.userName) + '"/>' +
          '<button type="button" class="submit" id="signup-btn" data-res="signup-btndone">Done</button>';
          
          formDiv.querySelector("#signup-btn").onclick = function() {
            if ( typeof(notifyRegComplete) === typeof(Function) ) {
              // if there is a function named notifyRegComplete then we call it
              // customers may remove this so we check for its existence
              notifyRegComplete();
            }
          }
        break;
      case 'validation':
        // hide any UI elements unrelated to showing the success message
        Array.prototype.slice.call(document.querySelectorAll('.hidelater')).forEach(function(e) { // Making MS family (IE and Edge) happy
          e.style.visibility = "hidden";
        });

        if ( typeof(notifyRegComplete) === typeof(Function) ) {
          // if there is a function named notifyRegComplete then we call it
          // customers may remove this so we check for its existence
          notifyRegComplete();
        }
        formDiv.innerHTML =
          '<h3 data-res="signup-reg-complete-msg">Self Registration is Complete.<BR/>You can close this window</h3>'
        break;
    }
    self.replaceDiv("signup-div",formDiv,true);
  } // this.displaySelfRegistrationSuccess

  this.setRegisterErrorMessage = function(reason, msg) {
    // if we have an localizable string try to translate it
    if ( reason && resources[reason] ) {
      msg = resources[reason];
    }

    if ( document.getElementById("register-error-msg")) {
      document.getElementById("register-error-msg").innerHTML = msg;
      // and turn the button back on
      let div = document.getElementById('signup-div');
      
      // If you prefer disabling the button to replacing it with a spinner
      // use these lines instead. Be sure to change the other place as well
      // div.querySelector("#signup-btn").classList.remove("disabled")
      // div.querySelector("#signup-btn").disabled = false;
      
      // make the signup button visible again and then remove the spinner
      div.querySelector("#signup-btn").style.display = "block";
      this.removeSpinner();
    }
    else {
      var errorDiv = document.createElement('div');
      errorDiv.innerHTML += '<div class="sameline"><span class="error-msg">' + msg + '</span></div>';
      errorDiv.id = 'signup-div';

      this.replaceDiv("signup-div", errorDiv,true)
    }
  }

  this.getAccessToken = function() {
    return sessionStorage.getItem("signinAT");
  }

  this.selfregSDK = new IdcsSelfRegSDK(this);
  this.displaySpinner();
  this.selfregSDK.initSelfregSDK();

  if ( sessionStorage.getItem("operation") &&
       sessionStorage.getItem("operation") == 'register') {
    this.selfregSDK.validateUser( decodeURIComponent(sessionStorage.getItem("token")) );
  }
  else {
    this.selfregSDK.loadSelfRegProfiles();
  }

}; // function loginApp

const registerApp = new RegisterApp();
