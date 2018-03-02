# Oracle Identity Cloud Service' SDK Node.js Sample Application

Oracle Identity Cloud Service provides a Software Development Kit (SDK) that you can use to integrate Node.js web applications with Oracle Identity Cloud Service.

The Node.js SDK is available as a passport strategy, called **passport-idcs**, and must be installed in the Node.js web application source code's node_modules folder.

This Sample Code is used in the following tutorial: [Use Oracle Identity Cloud Service's SDK for Authentication in Node.js Web Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:22661)

**Important:** The sample web application isn't meant to be published to production and isn't concerned about the language’s specific best practices, such as data handling, patterns, security, and so on. The sole purpose of the sample web application is to address the recommended approach to integrate Oracle Identity Cloud Service and a custom application using the SDK.

**Note:** Before deploying or using this sample application, it need to be updated following the instruction below:

## How to Update the Sample Application:

The sample web application needs an application's Client ID and Secret to establish communication with Oracle Identity Cloud Service.  Follow the referenced tutorial to register an application.

Edit the **auth.js** file, update the ClientId, ClientSecret, IDCSHost and AudienceServiceUrl variables, and then save the file.
```javascript
var ids = {
  oracle: {
    "ClientId": '1234567890',
    "ClientSecret": 'abcdefghij',
    "IDCSHost": 'https://example.idcs.oracle.com:443',
    "AudienceServiceUrl" : 'https://example.idcs.oracle.com:443',
    "TokenIssuer": 'https://identity.oraclecloud.com/',
    "scope": 'urn:opc:idm:t.user.me openid',
    "logoutSufix": '/sso/v1/user/logout',
    "redirectURL": 'http://localhost:3000/callback'
  }
};
module.exports = ids;
```

Edit the **app.js** file include the handler of the **/auth/oracle** route:
```javascript
app.get("/auth/oracle", function(req, res){
  am = new IdcsAuthenticationManager(auth.oracle);
  am.getAuthorizationCodeUrl(auth.oracle.redirectURL, auth.oracle.scope, "1234", "code")
    .then(function(authZurl){
        res.redirect(authZurl);
    }).catch(function(err){
      res.end(err);
    })
  });
```
The handler route uses the IdcsAuthenticationManager.getAuthorizationCodeUrl() SDK's function to generate the authorization URL.

The parameter value (1234) of the getAuthorizationCodeUrl SDK's function is meant to be a code that the sample web application might use to check if the communication was made correctly to Oracle Identity Cloud Service. The sample web application does not use it.

The IdcsAuthenticationManager.getAuthorizationCodeUrl() SDK's function uses promise to redirect the request upon successful generation of the authorization code URL, or to render an error instead.

Edit the **app.js** file and include the handler of the **/callback** route:
```javascript
app.get("/callback", function(req,res){
  var am = new IdcsAuthenticationManager(auth.oracle);
  var authZcode = req.query.code;
  am.authorizationCode(authZcode)
    .then(function(result){
       res.cookie(config.IDCS_COOKIE_NAME, result.access_token);
       res.redirect('/auth.html');
    }).catch(function(err){
      res.end(err);
    })
  });
```
The sample application handles the **/callback** route, and uses the authorization code, sent as a query parameter, to request an access token. The access token is stored as a cookie, and then sent to the browser for future use.

The **IdcsAuthenticationManager.authorizationCode()** SDK's function also uses promise (then/catch statement) to set the access token as a cookie, and to redirect the browser to the **/auth.html** page.

- Edit the **app.js** file and include the handler of the **/auth** route:
```javascript
app.get('/auth', passport.authenticate(config.IDCS_STRATEGY_NAME, {}), function(req, res) {
    res.redirect('/home');
});
```

Edit the **app.js** file and include the handler of the **/home**, **/appDetails** and **/userInfo** route:
```javascript
app.get('/home', ensureAuthenticated, function(req, res) {
  res.render('home', {layout: 'privateLayout', title: 'Home', user: req.user});
});
app.get('/appDetails', ensureAuthenticated, function(req, res) {
  res.render('appDetails', {layout: 'privateLayout', title: 'App Details', user: req.user});
});
app.get('/userInfo', ensureAuthenticated, function(req, res) {
  res.render('userInfo', {layout: 'privateLayout', title: 'User Info', user: req.user, userInfo: JSON.stringify(req.user, null, 2)});
});
```
The **/home**, **/appDetails**, and **/userInfo** URLs are protected resources. The sample web application uses the ensureAuthenticated function to handle these protected resources. 

Edit the **app.js** file and include the handler of the **/myProfile** route:
```javascript
app.get("/myProfile", ensureAuthenticated, function(req,res){
        var um = new IdcsUserManager(auth.oracle);
        um.getUser(req.user.id)
          .then(function(user){
            res.render('myProfile', {layout: 'privateLayout', title: 'My Profile', user: req.user, userInfo: JSON.stringify(user, null, 2)});
          }).catch(function(err1){
            res.end(err1);
          })
});
```
The **/myProfile** route's handler calls the **IdcsUserManager.getUser()** SDK's function to get the JSON object, which represents the user profile, and sends it to the **myProfile.handlebars** file to be rendered in the browser.

## Run the Sample Web Application

- Open a command prompt, navigate to the **nodejs folder**, and enter `npm install` to install all of the necessary modules, which are specified in the **package.json** file. 

- Extract the contents of the SDK zip file into the sample web application source code's **node_modules** folder. 

- In the command prompt, run the `node app.js` command to start the application
 
- Open a browser window, access the http://localhost:3000 URL, click **Log in**, and then click the Oracle red icon.

- The Oracle Identity Cloud Service Sign In page appears.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.
