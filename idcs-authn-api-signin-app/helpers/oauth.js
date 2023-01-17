var axios = require('axios');
var jwt = require('jsonwebtoken');
var logger = require('./logging');
var idcsCrypto = require("./idcsCrypto.js");

// urn:opc:idm:__myscopes__ will get all of the IDCS scopes granted to the app
// I don't want that.
//
// the three scopes we do want are:
// urn:opc:idm:t.user.signin          - to perform the login API calls
// urn:opc:idm:t.user.mecreate        - to perform self registration
// urn:opc:idm:t.user.resetpassword   - to make password reset request calls
//
// if you disable any of those functions in the app you can
// (and probably should) remove the associated scope from here
let neededScopes = [
  'urn:opc:idm:t.security.client',
  'urn:opc:idm:t.user.signin',
  'urn:opc:idm:t.user.mecreate',
  'urn:opc:idm:t.user.forgotpassword',
  'urn:opc:idm:t.user.resetpassword',
  'urn:opc:idm:t.user.verifyemail'
];

// those scopes are currently included in these IDCS app roles:
var necessaryAppRoles = [
  'Authenticated Client',
  'Forgot Password',
  'Reset Password',
  'Self Registration',
  'Signin',
  'Verify Email'
];
// the 'Authenticated Client' one comes for free so you only need to grant your app the other 3

// compares 2 sorted arrays to make sure the contents are the same
// this isn't a complete function, it's just as much as I need
function isEqual(a1, a2) {
  if (a1.length != a2.length) {
    return false;
  }
  for (var i = 0; i < a1.length; i++) {
    if (a1[i] != a2[i]) return false;
  }
  return true;
}

// the getAT function goes and gets an AT from IDCS
function getAT() {
  return new Promise(function (resolve, reject) {
    axios.post(
      process.env.IDCS_URL + "/oauth2/v1/token",
      'grant_type=client_credentials&scope=' + encodeURIComponent(neededScopes.join(' ')),
      {
        headers: {
          'Content-type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(process.env.IDCS_CLIENT_ID + ":" + process.env.IDCS_CLIENT_SECRET).toString('base64'),
          'Accept': 'application/json'
        }
      }).then((response) => {


        if (response && response.status) {
          logger.log('statusCode: ' + response.status);
        }
        logger.log('body: ', response.data);

        if ((response) &&
          (200 == response.status)) {
          var bodydata = response.data;
          let token = bodydata.access_token;
          var decoded = jwt.decode(token);

          // NOTE: I am **INTENTIONALLY** doing this every time
          //       I could do this check once in the startup but I want these
          //       warnings to appear over and over and over so they can't be missed!
          //
          // Special check: make sure the clientAppRoles claim has exactly what we expect
          //
          // Missing roles are non fatal as long as we have the necessary scopes
          var clientAppRoles = decoded.clientAppRoles.sort(); // sort them to make the compare easier

          if (!isEqual(clientAppRoles, necessaryAppRoles)) {
            logger.error('');
            logger.error('');
            logger.error('');
            logger.error('!!!!!! WARNING !!!!!!');
            logger.error('!!!!!! WARNING !!!!!!');
            logger.error('!!!!!! WARNING !!!!!!');
            logger.error('');
            logger.error('');
            logger.error('Application configured incorrectly!');
            logger.error('Sign in application should have **ONLY** these ' + necessaryAppRoles.length + ' IDCS app roles granted:');
            necessaryAppRoles.forEach(function (role) {
              logger.error(' * "' + role + '"')
            });
            logger.error('');
            logger.error('Your application has the following instead:');
            clientAppRoles.forEach(function (role) {
              logger.error(' * "' + role + '"')
            });
            logger.error('');
            logger.error('The acquired token will only contain absolutely necessary scopes,');
            logger.error('but this is a **POTENTIAL SECURITY ISSUE** in your configuration');
            logger.error('and should be remedied ASAP!');
            logger.error('');
            logger.error('');
          }

          // NOTE:
          //       If the config is wrong when we spin up throwing here will force
          //       the server to exit. This is intentional!
          //
          //       We throw rather than exiting to deal with the case where we
          //       initialize properly. But someone later changes IDCS' config
          //       (while we're running).
          //       In that case the throw() will result in a 500 error appearing
          //       in the end user's browser, but the server won't shutdown.
          //       As soon as the admin corrects the mistake the app will begin
          //       working again without needing to be restarted.

          // OAuth allows a client to request more scopes than it is allowed to have.
          // The only way to know if we got everything we need is to actually check.
          // This is where I do that check
          let missingScopes = [];
          neededScopes.forEach(function (scope) {
            if (decoded.scope.indexOf(scope) == -1) missingScopes.push(scope);
          });
          if (missingScopes.length > 0) {
            logger.error('ERROR: Token does not have required scopes ' + missingScopes.join(', '));
            // don't tell the user which is missing. Just that there's a config error.
            // the admin will have to look at the logs to know what they did wrong.
            throw ('Unable to continue due to configuration error');
          }

          // if we got here then things are OK
          resolve(token);
        } else {
          throw ('Failed to acquire Access Token. Check client ID, Secret, and IDCS URL.');
          // and also for sunspots, or leopards in the server room?
        }
      }).catch((error) => {
        logger.error('error: ', error);
      });
  });
};

exports.getAT = getAT;


const initialized = false;

// We need the signing cert to verify the signature on POST data
// We get the cert from the JWKS URL. But to talk to that we need an AT
// So we wire this function in to be called as soon as we acquire the AT.
//
// In the future we may be able to just use the Client ID and secret.
// Enh 27896624
function getSigningKeyOriginal(accessToken) {
  return new Promise(function (resolve, reject) {
    axios.get(
      process.env.IDCS_URL + "/admin/v1/SigningCert/jwk",
      {
        headers: {
          'Content-type': 'application/x-www-form-urlencoded',
          'Authorization': 'Bearer ' + accessToken,
          'Accept': 'application/json'
        }
      }
    ).then((response) => {

      if (response && response.status) {
        logger.log('statusCode: ' + response.status);
      }
      logger.log('body: ' + response.data);

      if ((response) &&
        (200 == response.status)) {
        var bodydata = response.data;
        logger.log(JSON.stringify(bodydata, null, 2));
        // we need the first (and probably only) cert from there
        if ((bodydata.keys) &&
          (bodydata.keys[0]) &&
          (bodydata.keys[0].x5c)) {
          logger.log("Extracting x5c from first JWKS key");

          var x5c = bodydata.keys[0].x5c[0];

          // PEM format says that lines must be no more than 64 chars
          // so rewrap the x5c content 64 bytes at a pop
          var cert = '-----BEGIN CERTIFICATE-----\n';
          while (x5c.length > 0) {
            if (x5c.length > 64) {
              cert += x5c.substring(0, 64) + '\n';
              x5c = x5c.substring(64, x5c.length);
            } else {
              cert += x5c;
              x5c = '';
            }
          }
          cert += '\n-----END CERTIFICATE-----\n';

          logger.log("Cert: \n" + cert);
          idcsCrypto.setTenantCert(cert);
          return;
        }
      }

      // if we get down to here there was a problem.
      // for now we just throw a generic error.
      // since this function is only called during startup throwing here
      // will crash out of the startup and shut the server down.
      // I *think* that's what we want.
      throw ("Failed to acquire certificate from JWKS URI!");
    }).catch(error => {
      if (error)
        logger.log('error: ', error);
    });
  });
}

function getSigningKey(accessToken) {
  return new Promise(function (resolve, reject) {
    axios.get(
      process.env.IDCS_URL + "/admin/v1/SigningCert/jwk",
      {
        headers: {
          'Content-type': 'application/x-www-form-urlencoded',
          'Authorization': 'Bearer ' + accessToken,
          'Accept': 'application/json'
        }
      }
    ).then((response) => {
      if (response && response.status == 200) {
        var bodydata = response.data;

        if (bodydata.keys && bodydata.keys[0] && bodydata.keys[0].x5c) {

          var x5c = bodydata.keys[0].x5c[0];
          var cert = '-----BEGIN CERTIFICATE-----\n';
          while (x5c.length > 0) {
            if (x5c.length > 64) {
              cert += x5c.substring(0, 64) + '\n';
              x5c = x5c.substring(64, x5c.length);
            }
            else {
              cert += x5c;
              x5c = '';
            }
          }
          cert += '\n-----END CERTIFICATE-----\n';
          idcsCrypto.setTenantCert(cert);
          logger.log("Cert: \n" + cert);
          return resolve(cert);
        }
      }
      else {
        return reject("Unable to get certificate from JWKS URI.");
      }
    }).catch((error) => {
      return reject(error);
    });
  });
}

function authorize(value) {
  return new Promise(function (resolve, reject) {
    logger.log("--- Authorizing request...");
    if (!value) {
      return reject("Invalid token.");
    }
    let valueArray = value.split(" ");
    let tokenType = valueArray[0];
    let tokenValue = valueArray[1];
    if (tokenType && tokenType.toLowerCase() !== 'bearer') {
      return reject("Invalid token.");
    }
    let cert = idcsCrypto.getTenantCert();
    logger.log("--- Cert: \n" + cert);
    logger.log("--- Signing cert obtained. Verifying JWT...");
    jwt.verify(tokenValue, cert, { sub: process.env.IDCS_CLIENT_ID, issuer: 'https://identity.oraclecloud.com/', ignoreExpiration: 'true' }, function (error, decoded) {
      if (error) {
        logger.log("--- Verification failed: " + error.message);
        return reject("Invalid token.");
      }
      if (decoded) {
        logger.log("--- Verification ok. Token decoded: " + JSON.stringify(decoded));
        return resolve(decoded);
      }
    });
  });
}

exports.authorize = authorize;

// only do this once:
if (!initialized) {
  // go get an initial AT not only to check the config, but
  // also to set the tenant ID.
  // We will need that later to decode the post data.
  logger.log('Acquiring initial Access Token...');
  getAT()
    .then(function (accessToken) {
      logger.log("Acquired initial Access Token successfully:");
      logger.log(accessToken + "\n");

      // then acquire the tenant signing certificate
      // we should only need to do this once
      // TODO: think about if we need to do this more often
      //getSigningKey(accessToken)
      getSigningKey(accessToken)
        .then(function () {
          logger.log("Looking for tenant name in Access Token...\n");
          var decoded = jwt.decode(accessToken);
          if (decoded["user.tenant.name"]) {
            let tenantName = decoded["user.tenant.name"];
            logger.log("Tenant name is: " + tenantName);
            idcsCrypto.setTenantName(tenantName);
          }
        });
    })
    .catch((err) => logger.log(err));
}
