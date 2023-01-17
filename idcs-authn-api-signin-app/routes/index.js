var express = require('express');
var router = express.Router();

var logger = require('../helpers/logging');
var idcsCrypto = require('../helpers/idcsCrypto.js');
var oauth = require('../helpers/oauth.js');
var xss = require("xss");

const crypto = require('crypto');

function getHostName() {
  try {
    var hostName = process.env.HOST || process.env.HOSTNAME;
    if (!hostName) {
      var OS = require('os');
      hostName = OS.hostname();
    }
    logger.log('Hostname is ' + hostName);
    return hostName;
  }
  catch (e) {
    logger.log('Cannot retrieve host name! Aborting...')
    throw (e);
  }
}

// utility function:
function redirectBrowser(req, res, url, payload) {
  res.statusCode = 200;

  oauth.getAT().then(function (accessToken) {
    logger.log('Access Token: ' + accessToken);

    res.setHeader('Content-Type', 'text/html');
    res.write('<script language="JavaScript">\n');

    res.write('try {\n');

    // Check to make sure session storage isn't disabled.
    res.write('if (!sessionStorage) { console.log("Session storage missing."); throw("No session storage");}\n');
    // Then make sure it works.
    res.write('let temp = Math.floor( Math.random() * 10000).toString();\n');
    res.write('sessionStorage.setItem("test", temp);\n');
    res.write('if ( sessionStorage.getItem("test") != temp ) {\n');
    res.write('console.log("Save and read back from session storage failed.");\n');
    res.write('throw("Unable to save in session storage");\n')
    res.write('}\n');

    // Clear storage to make sure we're starting from a clean slate
    // We do this to remove the above test but also to deal with the case where
    // a user comes to the login page (and possibly begins working through a login)
    // but then abandons it.
    res.write('sessionStorage.clear();\n');

    // Then add the basic fields in.
    res.write('sessionStorage.setItem("debugEnabled", ' + logger.debugEnabled() + ');\n');
    res.write('sessionStorage.setItem("signinAT", "' + accessToken + '");\n');
    res.write('sessionStorage.setItem("baseUri", "' + process.env.IDCS_URL + '");\n');

    if (process.env.IDCS_SELFREGPROFILES) {
      res.write('sessionStorage.setItem("selfRegProfiles", "' + process.env.IDCS_SELFREGPROFILES + '");\n');
    }
    res.write('sessionStorage.setItem("clientId",\'' + process.env.IDCS_CLIENT_ID + '\');\n');

    //Building the base URI of this server
    //It may be used by the client-side to call back (for refreshing the access token, for instance).
    // let serverSideBaseUri = process.env.PROTOCOL + '://' + getHostName() + ':' + process.env.PORT;
    // logger.log('serverSideBaseUri: ' + serverSideBaseUri)
    // res.write('sessionStorage.setItem("serverSideBaseUri", "' + serverSideBaseUri + '");\n');

    // Then add on everything from the payload.
    for (var field in payload) {
      var sanitizedField = xss(field);
      var sanitizedValue = xss(payload[field]);
      res.write('sessionStorage.setItem("' + sanitizedField + '",\'' + sanitizedValue.replace(/'/g, "\\'") + '\');\n');
    }
    // Finally send the user to the requested URL.
    res.write('document.write("You should be redirected in a moment...");\n');
    res.write('window.location = "' + url + '";\n');

    // This closes out the try block above.
    res.write('}\n');
    res.write('catch(err) {\n')
    res.write('document.write("Something went wrong.");\n');
    res.write('}\n');

    res.write('</script>\n\n');
    res.end();
  });
}

/* GET home page. */

router.get('/', function (req, res, next) {
  // If a user does a GET here one of three things is going on:
  // 1: They just set this up, don't know how to use it, and are just poking around
  // 2: They are not developer or admin and they are exploring
  // 3: There is a misconfig and Oracle Identity Cloud Service is 302'ing them here instead of having them POST
  //    The most common misconfiguration is forgetting to enable the SDK under Oracle Identity Cloud Service' SsoSettings
  //    See https://docs.oracle.com/en/cloud/paas/identity-cloud/rest-api/op-admin-v1-ssosettings-id-get.html
  //    check/change the sdkEnabled setting - it should be set to "true"
  //
  // In all 3 cases we set the HTTP response code to 500 and let the HTML page speak for itself.
  res.statusCode = 500;

});

// TODO: pull common stuff (i.e. sessionStorage.setItem() and the JS to window.location)
// up into a single utility function

/* POST to "/" */
router.post("/", function (req, res, next) {
  // Take loginCtx from the the POST data and decode it
  logger.log("POST for / received.")

  logger.log("POST body:\n" + JSON.stringify(req.body, null, 2));

  // From Oracle Identity Cloud Service 18.3.+, /social/callback sends us back here.
  // Social user is in Oracle Identity Cloud Service and no MFA
  if (req.body.authnToken) {
    redirectBrowser(req, res, "../../signin.html", {
      "IDPAuthnToken": req.body.authnToken
    });
  }

  else if (req.body.loginCtx && req.body.signature) {
    // Only proceed if both 'loginCtx' and 'signature' parameters set in the request.

    // Then verify the signature
    idcsCrypto.verifySignature("loginCtx", req.body.loginCtx, req.body.signature);
    // If there's a problem with the signature .verifySignature will throw an exception
    // so if we get past that line then the signature was OK

    const encrypted = req.body.loginCtx;
    logger.log("Looking for request state...");
    logger.log("Decrypting loginCtx: " + encrypted);

    var decrypted = idcsCrypto.decrypt(encrypted);

    // Parse it as JSON
    var loginContext = JSON.parse(decrypted);
    if ((!loginContext.requestState) &&
      (!loginContext.status)) {
      // Then the request state AND status are both missing
      // it could be that SSO Settings haven't been adjusted to set sdkEnabled to true
      res.statusCode = 500;
      res.end("Login context does not contain request state.");
    }
    else {
      logger.log('Acquired request state successfully.');
      logger.log('Request state: ' + loginContext.requestState);

      logger.log("Prettified that's:");
      logger.log(JSON.stringify(JSON.parse(decrypted), null, 2));

      // No values in the payload we pass in to redirectBrowser should ever
      // contain a single quote (i.e. an apostrophe).
      // JSON.stringify always uses double quotes (i.e. "str") for strings,
      // but just in case something funny happens we do an extra check

      // TODO: consider using a filter function to simply remove such values since they're likely an attempt to break us
      // loginContext["foo"] = "'";
      // logger.log('login Context: ' + JSON.stringify(loginContext).replace(/'/g, "\\'"));

      redirectBrowser(req, res, "signin.html", {
        "initialState": JSON.stringify(loginContext)
      });
    }
  }
  else {
    res.statusCode = 500;
    res.end("Could not understand your request.");
  }
});


// From Oracle Identity Cloud Service 18.2.4+, /u1/v1/error POST endpoint is triggered in a number of cases
// 1. When the external IDP is successful and the account exists in Oracle Identity Cloud Service.
// 2. When the external IDP is successful and the account doesn't exist in Oracle Identity Cloud Service.

router.post('/ui/v1/error', function (req, res, next) {
  // Take loginCtx from the the GET data and decode it
  logger.log("POST for /ui/v1/error received.")

  // Social user is in Oracle Identity Cloud Service and no MFA
  if (req.body.authnToken) {
    redirectBrowser(req, res, "../../signin.html", {
      "IDPAuthnToken": req.body.authnToken
    });
  }
  // Social user needs to be registered in Oracle Identity Cloud Service, using SAME id as social provider's
  else if (req.body.userData) {
    var decrypted = idcsCrypto.decryptSocial(req.body.userData, process.env.IDCS_CLIENT_SECRET);
    var userData = JSON.parse(decrypted);
    var scimUserAttrs = JSON.parse(userData.scim_user_attr);

    redirectBrowser(req, res, "../../signin.html", {
      "requestState": req.body.requestState,
      "social.scimUserAttrs": JSON.stringify(scimUserAttrs),
      "social.needToRegister": "true"
    });
  }
  else {
    res.statusCode = 500;
    res.end("Something has gone terribly wrong!");
  }
});


// We end up here if either:
// 1. Social IDP login fails and user cancels the process.
// 2. If social login succeeds and and user is already provisioned in Oracle Identity Cloud Service but deactivated!

router.get('/ui/v1/error', function (req, res, next) {
  logger.log("GET for /ui/v1/error received.")
  var encrypted = req.query.errorCtx;

  logger.log("Decrypting loginCtx: " + encrypted);

  var decrypted = idcsCrypto.decrypt(encrypted);

  logger.log("errorCtx decrypted: " + decrypted);
  var errCtx = JSON.parse(decrypted);
  logger.log("First error:" + JSON.stringify(errCtx.errors[0]));

  var errorType = 'login';

  if (errCtx.errors[0].code === 'SSO-1003' || errCtx.errors[0].code === 'SSO-1002') {
    logger.log("errorType is not social");
    errorType = 'social';
  }

  logger.log("Redirecting browser with error context info.")
  redirectBrowser(req, res, "../../signin.html", {
    "isIDPUserInIDCS": "false",
    "backendError": JSON.stringify({ type: errorType, code: errCtx.errors[0].code, msg: errCtx.errors[0].message })
  });
});


router.get("/selfreg", function (req, res, next) {
  // take loginCtx from the the POST data and decode it
  logger.log("GET for selfreg received.")

  if (req.query.token) {
    logger.log("Token: " + req.query.token);
    logger.log("Token post encoding: " + encodeURIComponent(req.query.token));

    redirectBrowser(req, res, "signin.html", {
      "operation": "register",
      "token": encodeURIComponent(req.query.token)
    });
  }
  else {
    res.statusCode = 500;
    res.end("Could not understand your request.");
  }
});

router.get("/resetpwd", function (req, res, next) {
  // take loginCtx from the the POST data and decode it
  logger.log("GET for resetpwd received.");

  if (req.query.token) {
    redirectBrowser(req, res, "signin.html", {
      "operation": "resetpwd",
      "token": encodeURIComponent(req.query.token)
    });
  }
  else {
    res.statusCode = 500;
    res.end("Could not understand your request.");
  }
});

router.post("/newAccessToken", function (req, res) {
  logger.log("------------------------------------------------");
  logger.log("--- New access token request.");
  oauth.authorize(req.get('Authorization')).then(oauth.getAT).then(function (accessToken) {
    logger.log("--- Access token request fulfilled.");
    res.status(200).send(accessToken);
  })
    .catch(function (error) {
      logger.log("--- Access token request rejected: " + error);
      res.status(401).send(error);
    });
});

module.exports = router;
