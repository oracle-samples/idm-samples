// TODO: throw if the AT is expired

function IdcsSelfRegSDK(app) {
/* IdcsSelfRegSDK is copied and modified IdcsAuthnSDK for purpose of Self Registration
 * Construct is pretty much like IdcsAuthnSDK.
 * This does following :
 * Validates incoming Password against Password Policies
 * Self Registers a User
 * Gets a User Details
 * Validates user email for incoming short-lived token
 */
  this.app = app;
  // start out with an empty array
  this.selfRegProfiles = [];

  this.initSelfregSDK = function() {
    this.app.logMsg('[IdcsSelfRegSDK] Initializing the self registration SDK');

    const self = this;

    if ( !this.app.getAccessToken() ) {
        this.app.logMsg("[IdcsSelfRegSDK] Access Token not found!");
        this.app.setRegisterErrorMessage(undefined, "Stored Access Token not found.");
    }
  }

  this.loadSelfRegProfiles = function() {
    const self = this;

    if ( undefined == app.selfRegProfiles ) {
      // if there are no self reg profiles tell the caller that
      self.app.setRegisterErrorMessage("signup-noprofile", "No self registration profiles configured.") ;
    }
    else
    {
      // make the call to get the self reg profiles

      // do a for loop over the profiles
      this.app.logMsg("[IdcsSelfRegSDK] Self reg profiles to be loaded: " + app.selfRegProfiles);
      var profileIDs = self.app.selfRegProfiles.split(",");
      // force allocate the entire array
      // I was going to use .push() to add them as they come in from the REST
      // calls, but we need to keep them in order.
      self.selfRegProfiles = new Array(profileIDs.length);
      var numProfilesDownloaded = 0;

      // then go make the calls to get the data to fill it in.
      for( var i in profileIDs ) {
        var profile = profileIDs[i];
        this.app.logMsg("[IdcsSelfRegSDK] Loading self reg profile " + profile);

        var xhr = new XMLHttpRequest();

        xhr.addEventListener("readystatechange", function () {
          if (this.readyState === 4) {
            // TODO: 200 vs 404
            switch ( this.status ) {
              case 200:
                self.app.logMsg("[IdcsSelfRegSDK] Self reg profile " + profile + " loaded.");
                self.app.logMsg('[IdcsSelfRegSDK] Self Reg Profile: ' + this.responseText);
                const jsonResponse = JSON.parse(this.responseText);

                // again: we're not using push because I need to preserve the order
                // and I can't use "i" because by the time get called it will
                // already have been incremented
                // so figure out where to put this one in the array
                self.selfRegProfiles[ profileIDs.indexOf(jsonResponse.id) ] = jsonResponse;
                numProfilesDownloaded++;

                // if ALL of the self reg profiles have all been downloaded
                if ( numProfilesDownloaded == self.selfRegProfiles.length) {
                  // then let the app know
                  self.callBackToDisplaySelfRegForm();
                }

                break;
              default:
                // if ANY of them fail to download then set the error and bail out
                // TODO: think about if this is the behavior we actually want in PROD
                //       My initial gut says yes but I want to think about it.
                self.app.setRegisterErrorMessage(undefined, "Error loading self registration profiles.") ;
            }
          }
        });

        xhr.open("GET", app.baseUri + "/admin/v1/SelfRegistrationProfiles/" + profile);
        // xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());
        xhr.send();
      }
    }
  }; // this.initSelfregSDK

  this.callBackToDisplaySelfRegForm = function() {
    const self = this;
    // we need to construct the fields as expected by the app
    // our syntax is simpler than that what comes back from IDCS
    // all we need to build is something like:
    // {
    //   "Profile One": {
    //   "profileID": "c232d47368fd459bb293ec2be7f1338e",
    //   "fields" : [
    //      {
    //        "name": "name.givenName",
    //        "display": "First Name",
    //        "description": "First name",
    //        "type": "string",
    //        "minLength": 1,
    //        "maxLength": 150,
    //        "multiValued": false
    //     },
    //     {...},
    //     ...
    //   ],
    // },
    // ... and then as many others as we want to show

    var simpleRegProfileData = {};

    // console.log( JSON.stringify(selfRegProfiles,null,4));
    // remember order matters - the first one is the default.
    for ( var i in self.selfRegProfiles ) {
      var profile = self.selfRegProfiles[i];
      profile.UserAttributesOrganized = {};
      self.app.logMsg( "[IdcsSelfRegSDK] profile " + profile.name + " has " + profile.userAttributes.length.toString() + " fields." );

      // I hate using "continue". But it's the best way out of here
      if ( !profile.active ) {
        continue;
      }

      var thisOne = {
        "profileID": profile["id"],
        "fields": new Array( profile.userAttributes.length )
      };

      // there's a funny thing about he sequence numbers in self reg profiles:
      // they may not be contiguous. You expect 1,2,3,4,5,6.
      // But the same set of attributes COULD be in there as 1,3,5,6,7,11
      //
      // This is intentional in IDCS as it allows admins to leave gaps for later use
      //
      // Rather than making myself nuts I do my best here and allocate what I
      // assume is the right size. Then once it's full I do a quick filter to
      // remove any that are undefined.

      for ( var j=0;j<profile.userAttributes.length; j++ ) {
        var thisAttr = profile.userAttributes[j];
        var metadata = JSON.parse(thisAttr.metadata);

        var field = { "name": thisAttr.value };

        // we only need enough info to build the GUI
        if ( metadata.type === "string" ) {
          field["type"] = "string";
          field["minLength"] = metadata["idcsMinLength"];
          field["maxLength"] = metadata["idcsMaxLength"];

          // there are a couple of special ones
          if ( thisAttr.value === 'userName' ) {
            field.display="Username";
          }
          else
          if ( thisAttr.value === 'password' ) {
            field.display="Password";
          }
          else {
            field.display=thisAttr.value;
          }
        }
        else
        if ( metadata.type === "complex" ) {
          // for complex types
          // console.log( thisAttr.value );
          // console.log( metadata );
          if ( metadata.subAttributes.length != 1 ) {
            throw("Invalid subattribute");
          }
          else {
            field["display"] = metadata.subAttributes[0].idcsDisplayName;
            field["description"] = metadata.subAttributes[0].description;
            field["type"] = metadata.subAttributes[0].type;
            if ( field["type"] === "string"  ) {
              field["minLength"] = metadata.subAttributes[0].idcsMinLength;
              field["maxLength"] = metadata.subAttributes[0].idcsMaxLength;

              // look for canonical values
              if ( metadata.subAttributes[0].canonicalValues ) {
                field["options"] = metadata.subAttributes[0].canonicalValues;
              }
            }
            else
            if ( field["type"] == "boolean" ) {
              // do nothing
            }
            else {
              throw("unknown type");
            }

          }
        }
        field["multiValued"] = metadata["multiValued"];

        self.app.logMsg( "[IdcsSelfRegSDK] Placing field " + profile.name + " at position " + (thisAttr.seqNumber-1).toString() );
        thisOne.fields[thisAttr.seqNumber-1] = field;

        // then for good measure put the user attr definition back in the
        profile.UserAttributesOrganized[thisAttr.value] = thisAttr;
        profile.UserAttributesOrganized[thisAttr.value].metadata = metadata;
      }

      // before adding it filter out any "undefined" entries (see above)
      thisOne.fields = thisOne.fields.filter( function(x) {
        if ( x == undefined ) {
          return false;
        }
        else {
          return true;
        }
      } );

      // Then add the other bits and pieces we need to present the UI

      // localized names for the self reg profiles
      thisOne.displayName = profile.displayName;

      // we add consentText to the profile only if the flag saying consent is required is set to true
      if ( profile.consentTextPresent) {
        thisOne.consentText = profile.consentText;
      }

      // and then the header and footer text + images
      thisOne.headerLogoURL = profile.headerLogo;
      thisOne.headerText = profile.headerText;
      thisOne.footerLogoURL = profile.footerLogo;
      thisOne.footerText = profile.footerText;

      simpleRegProfileData[profile.name] = thisOne;
    }

    self.app.displaySelfRegForm(simpleRegProfileData);
  }


  this.evaluatePasswordPolicies = function(payload, callback) {
    const self = this;
    // this should *NEVER* happen unless a programmer makes a mistake
    // the payload
    if ( ! payload["password"] ) {
      self.app.setRegisterErrorMessage(undefined, "No inputs.");
      throw( "Invalid inputs" );
    }

    var data = JSON.stringify({
      "userName": payload["emails.value"],
      "givenName": payload["name.givenName"],
      "familyName": payload["name.familyName"],
      "password": payload["password"],
      "schemas": [
        "urn:ietf:params:scim:schemas:oracle:idcs:UserPasswordValidator"
      ]
    });

    var xhr = new XMLHttpRequest();

    xhr.addEventListener("readystatechange", function () {
      if (this.readyState === 4) {
        // TODO: check return code (200 vs 400)
        self.app.logMsg('[IdcsSelfRegSDK] Password Policy Eval Response: ' + this.responseText);
            const jsonResponse = JSON.parse(this.responseText);
            callback(jsonResponse);
      }
    });

    xhr.open("POST", app.baseUri + "/admin/v1/UserPasswordValidator");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());
    xhr.send(data);

  }; //this.evaluatePasswordPolicies

  // this function creates the user object from the profile name and bag of attributes
  // I'm convinced there's a better way to do this but I don't know it yet
  this.createUserObject = function( profileName, userAttrs ) {
    const self = this;

    let newUser = {
      "schemas": [
        "urn:ietf:params:scim:schemas:core:2.0:User"
      ]
    };

    // find the profile
    var profile;
    for ( var p in self.selfRegProfiles ) {
      var thisProfile = self.selfRegProfiles[p];
      if ( thisProfile.name == profileName ) {
        profile = self.selfRegProfiles[p];
      }
    }
    if ( !profile ) {
      self.app.logWarning("[IdcsSelfRegSDK] Self Registraton Profile named '" + profileName + "' not found in previously loaded profiles.");
      throw( "Invalid profile - " + profileName );
    }

    // user attributes are in profile.userAttributes as an array
    // but I previously re-organized them in profile.UserAttributesOrganized
    // so that I could easily access them later.

    // which makes this easy
    for ( var field in userAttrs ) {
      console.log(field);
      console.log( profile.UserAttributesOrganized[field] );
      let fieldInfo = profile.UserAttributesOrganized[field];

      // fullyQualifiedAttributeName tells us where to put the field
      let fqName = fieldInfo.fullyQualifiedAttributeName;

      let insertIntoUser = function(u,f,m,v) {
        // NOTE: this only deals with values that are foo.bar = X
        //       if we ever have foo.bar.baz we'll need to revisit
        logMsg( "Inserting Field " + f );
        // logMsg( "into user: " + JSON.stringify(u,null,2) );
        if ( f.length == 1)  {
          newUser[f[0]] = userAttrs[f[0]];
        }
        else {
          if ( !u[f[0]] ) {
            if ( m.multiValued ) {
              u[f[0]] = [{}];
            }
            else {
              u[f[0]] = {};
            }
          }
          if ( m.multiValued ) {
            u[f[0]][0][f[1]] = v;
          }
          else {
            u[f[0]][f[1]] = v;
          }
        }
      };

      if ( fqName.startsWith( "urn:ietf:params:scim:schemas:core:2.0:User:") ) {
        insertIntoUser( newUser, field.split('.'), fieldInfo.metadata, userAttrs[field] );
      }
      else
      if ( field.indexOf('.') == -1 ) {
        let schema = fieldInfo.fullyQualifiedAttributeName.substr(0, fieldInfo.fullyQualifiedAttributeName.lastIndexOf(':'));
        if ( newUser.schemas.indexOf( schema ) ) {
          newUser.schemas[newUser.schemas.length] = schema;
        }
        // this is a bit of a hack :-)
        insertIntoUser( newUser, [schema,field], fieldInfo.metadata, userAttrs[field] );
      }
      else {
        console.log( "Sorry, the Self Reg SDK does not yet support field '" + field + "'");
        throw( "Error" );
      }
    }

    self.app.logMsg( "New user object: " + self.app.mask(newUser) );
    return newUser;
  }; // this.createUserObject

  this.selfRegUser = function(payload,callback) {
    // we will need the Profile Name and the ProfileID
    // get them from the payload first
    let profileID = payload["ProfileID"];
    let profileName = payload["ProfileName"];

    if ( !profileID ) {
      throw("Missing ProfileID in payload");
    }
    if ( !profileName ) {
      throw("Missing ProfileName in payload");
    }

    // save consent response
    let haveConsent = false;
    if ( payload["consent"] != undefined ) {
      haveConsent = payload["consent"];
    }

    // then remove the fields that are for us and not needed to create the user
    delete payload["ProfileID"];
    delete payload["ProfileName"];
    delete payload["consent"];

    var newUser = this.createUserObject( profileName, payload );

    newUser['urn:ietf:params:scim:schemas:oracle:idcs:extension:selfRegistration:User'] =
      {
        selfRegistrationProfile: {
          value: profileID
        }
      };

    if ( haveConsent ) {
      newUser['urn:ietf:params:scim:schemas:oracle:idcs:extension:selfRegistration:User'].consentGranted = true;
    }

    var xhr = new XMLHttpRequest();
    const self = this;

    xhr.addEventListener("readystatechange", function () {
      if (this.readyState === 4) {
        self.app.logMsg('[IdcsSelfRegSDK] SelfRegister User Response:' + this.responseText);
        const jsonResponse = JSON.parse(this.responseText);
        callback(jsonResponse);
      }
    });

    self.app.logMsg( "[IdcsSelfRegSDK] Sending new user request: " + self.app.mask(newUser) );
    self.app.logMsg( "[IdcsSelfRegSDK] Sending new user request" );

    xhr.open("POST", app.baseUri + "/admin/v1/Me");
    xhr.setRequestHeader("Content-Type", "application/scim+json");
    xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());
    xhr.send(JSON.stringify(newUser));

  }; //this.selfRegUser

  this.registerUser = function(payload){
    this.app.logMsg("[IdcsSelfRegSDK] In Register User..")
    const self = this;

    self.evaluatePasswordPolicies(payload,function(returnValue1){
      if(returnValue1.hasOwnProperty('failedPasswordPolicyRules')){
        var failedmsg = "Password failed for these "+ returnValue1.failedPasswordPolicyRules.length +" Policies:";
        self.app.logMsg("[IdcsSelfRegSDK] Number of failed policies:-->"+ returnValue1.failedPasswordPolicyRules.length);
        // we should return these as an array so they can be printed more nicely
        for (var i = 0; i < returnValue1.failedPasswordPolicyRules.length; i++) {
          failedmsg += '\r\n' + returnValue1.failedPasswordPolicyRules[i].value;
        }
        self.app.logMsg("[IdcsSelfRegSDK] Failed for these Password policies :-->"+ failedmsg);
        self.app.setRegisterErrorMessage(undefined, failedmsg);
      }
      else {
        self.app.logMsg("[IdcsSelfRegSDK] Password policies came back fine..Proceed with registration:\n " );
        self.selfRegUser(payload,function(returnValue2) {
          if( returnValue2.hasOwnProperty('id') ) {
            self.app.logMsg("[IdcsSelfRegSDK] Registration was successful, You should get a confirmation email");
            self.app.displaySelfRegistrationSuccess(returnValue2 , "registration");
          }
          else {
            self.app.logMsg("[IdcsSelfRegSDK] Registration failed");
            self.app.setRegisterErrorMessage(undefined, "Registration failed : " + returnValue2.detail);
          }
        });
      }
    });
  }; // this.registerUser

  this.validateEmail = function(token, callback) {
    this.app.logMsg("[IdcsSelfRegSDK] In Validate Email..");
    var data = JSON.stringify(
      {
        "token": token,
        "schemas": [
          "urn:ietf:params:scim:schemas:oracle:idcs:MeEmailVerified"
        ]
      });

    var xhr = new XMLHttpRequest();
    const self = this;

    xhr.addEventListener("readystatechange", function () {
      if (this.readyState === 4) {
        self.app.logMsg('[IdcsSelfRegSDK] Validate Email Response:' + this.responseText);
        const jsonResponse = JSON.parse(this.responseText);
        callback(jsonResponse);
      }
    });

    xhr.open("POST", app.baseUri + "/admin/v1/MeEmailVerified");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", "Bearer " + this.app.getAccessToken());
    xhr.send(data);
  }; // this.validateEmail

  this.validateUser = function(token) {
    this.app.logMsg("[IdcsSelfRegSDK] In Validate User...")
    const self = this;

    self.validateEmail(token , function(returnVal1){
      var id = returnVal1.id;

      if ( returnVal1.hasOwnProperty('id') ) {
        self.app.logMsg("[IdcsSelfRegSDK] validateEmail response success for user with id '" + returnVal1.id + "'" );
        self.app.displaySelfRegistrationSuccess(returnVal1 , "validation");
      }
      else {
        self.app.setRegisterErrorMessage(undefined, "User Validation Failed ");
      }
    });
  }; // this.validateUser
}
