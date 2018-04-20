# Oracle Identity Cloud Service's Mobile Software Development Kit (SDK) for Android

## Introduction
The IDM Mobile SDK provides a single, unified, seamless & consistent framework that would work with existing IDM infrastructure both within enterprise & cloud.
It serves as a Security Layer for developing secure mobile applications on Universal Windows Platform, iOS and Android.
This document explains the IDM Mobile SDK (Headless), its functionality, and how to consume the same in Android applications.

## Functionalities
1. Initialization
2. Authentication
  a. HTTP Basic Authentication
  b. OAuth 2.0 Authentication
  	i. Authorization Code flow
  	ii. Resource Owner flow
  	iii. Client Credentials flow
  c. OpenID authentication
  d. Federated authentication
  e. Certificate based authentication (CBA)		
3. Authorization
4. Logout
5. Validity check of Authentication Context
6. Cryptography
7. Secure Storage
8. PIN and Biometric Authentication
9. Connection Handler
10. Key Storage

### Available Modules
* **Authentication Module:** It performs user authentication against remote server by specified protocol. SDK supports HTTP Basic, OAuth 2.0 (authorization code flow, resource owner flow, client credentials flow), OpenID, Federated and Certificate based authentication.
* **Cryptography Module:** Cryptography module has support for all cryptography needs e.g. Encryption, Decryption, Hashing etc. It supports all cryptographic algorithms.
* **Local Authentication Module:** Local authentication module provides features of local authentication using PIN or biometric.
* **Key Store Module:** Key Store module provides features for managing key encryption keys or data encryption keys, which includes CRUD operations on keys. These keys are used for cryptographic operation on any type of data.
* **Secure Storage Module:** Secure storage module provides a way to store any type of data securely, which cannot be tampered and accessed by unauthorized user.
* **Connection Handler Module:** This module provides feature to invoke REST call.

## Developing Android Applications
The IDM mobile SDK for Android is provided as an Android Archive (AAR) file which developers must include in the project.

### Set Up the project in Android Studio
1. Extract the SDK zip file (e.g: IDCS-SDK-for-Android-18.1.2-1.0.26.zip) in any location. It contains a **.aar** file named **oamms_sdk_for_android_headless.aar** (name may vary depending on the current version).

2. Follow the standard process as described in [Android documentation](https://developer.android.com/studio/projects/android-library.html#AddDependency) to add this library as a dependency in your application. The below steps are quoted from the previous link for ease of access:

   1. Add the library to your project 
      1. Click **File > New > New Module**.
      2. Click **Import .JAR/.AAR Package** and then click **Next**.
      3. Enter the location of the **oamms_sdk_for_android_headless.aar** file and then click **Finish**.

   2. Make sure the library is listed at the top of your file `settings.gradle`, as shown below:

      ```groovy
      include ':app', ':oamms_sdk_for_android_headless'
      ```

   3. Open the app module's `build.gradle` file and add a new line to the `dependencies`  block as shown in the following snippet:

   ```groovy
   dependencies {
       compile project(":oamms_sdk_for_android_headless")
   }
   ```

   4. Click **Tools > Android > Sync Project with Gradle Files**.

3. Add the following dependencies in the app module's `build.gradle` file as IDM Mobile SDK uses these libraries:

   ```groovy
   compile group: 'org.slf4j', name: 'slf4j-api', version: '1.7.25'
   compile 'com.nimbusds:nimbus-jose-jwt:4.26@jar'
   compile group: 'net.minidev', name: 'json-smart', version: '2.3'
   compile 'com.squareup.okhttp3:okhttp:3.8.0'
   ```

### Write Your Code
This section uses reference code to help you understand how to develop your application using the SDK.

**1. Initial SDK setup**

First step is to create a Map object with required parameters and create OMMobileSecurityService instance.
a. Create a `Map<String, object>` to populate parameters and add parameters in it.
```java
HashMap<String, Object> map = new HashMap<>();
map.put(OMMobileSecurityService.OM_PROP_AUTHSERVER_TYPE, OMMobileSecurityService.AuthServerType.HTTPBasicAuth);
map.put(OMMobileSecurityService.OM_PROP_APPNAME, "MyApp");
map.put(OMMobileSecurityService.OM_PROP_LOGIN_URL, new URL("http://host:port/index.html"));
map.put(OMMobileSecurityService.OM_PROP_LOGOUT_URL, new URL("http://host:port/logout"));
...
```

For detailed information about supported properties, refer to "List of Initialization Parameters" section below.

b. Create an object of OMMobileSecurityService by passing the map created above. 

```java
OMMobileSecurityService mss = new OMMobileSecurityService(getApplicationContext(), map, new OMMobileSecurityServiceCallbackImp());
```
`OMMobileSecurityServiceCallbackImp()` is an implementation of `OMMobileSecurityServiceCallback`  interface. `OMMobileSecurityServiceCallback` is a callback interface to be implemented by the application to receive events during or after performing operations on `OMMobileSecurityService`. The operations like `OMMobileSecurityService.setup()`, `OMMobileSecurityService.authenticate()` and `OMMobileSecurityService.logout(boolean)` are asynchronous methods. Once the operation is done, it will be indicated using callback methods in this interface ending with "Completed". If input is required to complete the operation, the same will be indicated using callback methods ending with "Challenge".

**Note:** Maintain this instance of `OMMobileSecurityService` throughout the application life cycle either by having it in a class which extends [Application](https://developer.android.com/reference/android/app/Application.html) or in a Singleton. This is required to maintain one valid session with the server at a time.

c. Call the Setup method (Optional for all authentication mechanisms except for OpenID)

Call `OMMobileSecurityService#setup()` method, which is mandatory in case of OpenID authentication. It is optional in case of other authentication mechanisms. It will download open id configuration details from authentication server. `OMMobileSecurityService#setup()` method is an asynchronous method, so, once the download is complete, it will be indicated by the callback method: `OMMobileSecurityServiceCallback#onSetupCompleted(OMMobileSecurityService mss, OMMobileSecurityConfiguration config, OMMobileSecurityException mse)`.

`config` will contain the OpenID configuration details downloaded from the server. If something went  wrong while downloading, the exception will be available in `mse` and `config` will be `null`.


```java
class OMMobileSecurityServiceCallbackImp implements OMMobileSecurityServiceCallback {
       private CustomTabActivityHelper mTabHelper;
       @Override
        public void onSetupCompleted(OMMobileSecurityService mss, OMMobileSecurityConfiguration config, OMMobileSecurityException mse) {
            if (config != null) {
                String frontChannelRequest = (((OMOICMobileSecurityConfiguration) config).getOAuthAuthorizationEndpoint().toString());
                if (mTabHelper != null)
                    mTabHelper.mayLaunchUrl(Uri.parse(frontChannelRequest), null, null);
            }
        }
...
}
```

**2. Authenticate user**

Now app can invoke `OMMobileSecurityService#authenticate()` method to perform authentication. This is an asynchronous call. Depending on the authentication type, `OMMobileSecurityServiceCallback#onAuthenticationChallenge(OMMobileSecurityService mss, OMAuthenticationChallenge challenge, OMAuthenticationCompletionHandler completionHandler)` will be called to obtain input from end-user or developer. When the authentication is completed successfully, it will be indicated using `OMMobileSecurityServiceCallback#onAuthenticationCompleted(OMMobileSecurityService mss, OMAuthenticationContext authContext, OMMobileSecurityException mse)`. 

Following is a sample implementation of `OMMobileSecurityServiceCallback#onAuthenticationChallenge(OMMobileSecurityService mss, OMAuthenticationChallenge challenge, OMAuthenticationCompletionHandler completionHandler)`  for OpenID authentication flow:

```java
        @Override
        public void onAuthenticationChallenge(OMMobileSecurityService mss, final OMAuthenticationChallenge challenge, final OMAuthenticationCompletionHandler completionHandler) 		{
            if (challenge.getChallengeType() == OMAuthenticationChallengeType.EXTERNAL_BROWSER_INVOCATION_REQUIRED) {
                String externalBrowserURL = (String) challenge.getChallengeFields().get(OMSecurityConstants.Challenge.EXTERNAL_BROWSER_LOAD_URL);
                openCustomTab(externalBrowserURL);
            } else if (challenge.getChallengeType() == OMAuthenticationChallengeType.UNTRUSTED_SERVER_CERTIFICATE) {
                onUntrustedServerCertificateReceived(challenge, completionHandler);
            }
		}
```

Following is the list of various Authentication challenge types: 

- OMAuthenticationChallengeType.USERNAME_PWD_REQUIRED
  This challenge is sent, when username and password are required. 


- OMAuthenticationChallengeType.EMBEDDED_WEBVIEW_REQUIRED
  This challenge is sent, when webview instance is required to load login page.


- OMAuthenticationChallengeType.EXTERNAL_BROWSER_INVOCATION_REQUIRED
  This challenge is sent, when it is required to load login page in external browser. App can load the url either in mobile browsers or using Chrome Custom Tabs.


- OMAuthenticationChallengeType.UNTRUSTED_SERVER_CERTIFICATE
  This challenge is sent, if server certificate is untrusted. App MUST always cancel this challenge in release build. For testing purpose in debug build, app can proceed with this challenge.


- OMAuthenticationChallengeType.CLIENT_IDENTITY_CERTIFICATE_REQUIRED
  This challenge is sent, when client certificate is requested.
- OMAuthenticationChallengeType.INVALID_REDIRECT_ENCOUNTERED
  This challenge is sent, when a redirect from https to http is encountered. This is something which needs to be avoided if possible at your server side. But, if such a redirect happens with your server, you can proceed with this challenge. If not, cancel this challenge.

**3. Access OAuth protected resources**

The following sample shows how to access OAuth protected resources if user is authenticated using OpenID or OAuth 2.0. 

```java
Set<String> OAUTH_AUTHZ_SCOPE_SET = new HashSet<>();
OAUTH_AUTHZ_SCOPE_SET.add("urn:opc:idm:t.user.me");

OMAuthorizationService authZService = new OMAuthorizationService(mss);
OMHTTPRequest request = new OMHTTPRequest(new URL("https://host:port/someurl"), OMHTTPRequest.Method.GET);
authZService.executeRequest(request, new OMHTTPRequestCallbackImpl(), TestConstants.OAUTH_AUTHZ_SCOPE_SET);
```

**4. Logout procedure:**

App can invoke `OMMobileSecurityService#logout(boolean isForgetDevice)` method to perform logout. This is an asynchronous call. Depending on the authentication type, `OMMobileSecurityServiceCallback#onLogoutChallenge(OMMobileSecurityService mss, OMAuthenticationChallenge challenge, OMLogoutCompletionHandler completionHandler)` will be called to obtain input from end-user or developer. When the logout is completed successfully, it will be indicated using `OMMobileSecurityServiceCallback#onLogoutCompleted(OMMobileSecurityService mss, OMMobileSecurityException mse)`. 

Following is a sample implementation of `OMMobileSecurityServiceCallback#onLogoutChallenge(OMMobileSecurityService mss, OMAuthenticationChallenge challenge, OMLogoutCompletionHandler completionHandler)`  for OpenID logout  flow:

```java
        @Override
        public void onLogoutChallenge(OMMobileSecurityService mss, OMAuthenticationChallenge
                challenge, OMLogoutCompletionHandler completionHandler) {

            if (challenge.getChallengeType() == OMAuthenticationChallengeType.EXTERNAL_BROWSER_INVOCATION_REQUIRED) {
                String logoutURL = (String) challenge.getChallengeFields().get(OMSecurityConstants.Challenge.EXTERNAL_BROWSER_LOAD_URL);
                if (mTabHelper != null) {
                    mTabHelper.bindCustomTabsService(OpenIDConnectActivity.this);
                }
                openCustomTab(logoutURL);
            }
        }
```

Following is the list of various Logout challenge types: 

- OMAuthenticationChallengeType.EMBEDDED_WEBVIEW_REQUIRED
  This challenge is sent, when webview instance is required for logout. 


- OMAuthenticationChallengeType.EXTERNAL_BROWSER_INVOCATION_REQUIRED
  This challenge is sent, when it is required to load logout page in external browser. App MUST load the url either in mobile browsers or using Chrome Custom Tabs depending on where login url was loaded during authentication.


- OMAuthenticationChallengeType.UNTRUSTED_SERVER_CERTIFICATE
  This challenge is sent, if server certificate is untrusted. App MUST always cancel this challenge in release build. For testing purpose in debug build, app can proceed with this challenge.

## Additional Information

### List of Initialization Parameters

Property Name 				| Description 				| Property Value 					| Property Type 		| Mandatory
------------- 				| ----------- 				| -------------- 					| ------------- 		| ---------
Prop 		  				| description 				| value 		 					| type 		 			| yes/optional

[Please refer Initialization Properties section in https://confluence.oraclecorp.com/confluence/display/OCIS/IDM+Mobile+SDK+for+Windows+Wiki wiki.]

### OAuth 2.0

IDM Mobile SDK provides authorization against OAuth Server in order to access the protected resources. The SDK will also work against any OAuth2.0 generic server provided it supports the below mentioned grant types for mobile clients.

The application after initializing the IDM Mobile SDK with the correct properties followed by authentication should be able to get the access token in the same way as it did for other authentication modes.

[Refer table present in OAuth 2.0 section in https://confluence.oraclecorp.com/confluence/display/OCIS/IDM+Mobile+SDK+for+Windows+Wiki wiki.]

[Please add Standard flows, Getting the tokens from SDK, Accessing protected resources and credential collection sections from above mentioned wiki.]

### Open ID Connect

OpenID Connect provides a way for the client to have both authorization and authentication capabilities. Open ID Connect is an extension on OAuth2.0 in which the client gets additional claims of the authenticated user from the server. SDK provides a set of properties for the client application in order to configure/initialize the SDK. SDK provides dynamic and static way to initialize itself:

#### Dynamic

OpenID Connect exposes a REST endpoint which contains details on the well-known open id configuration.

Application can provide the same using OM_PROP_OPENID_CONNECT_CONFIGURATION_URL during MSS initialization. On calling up setup on the MSS instance,  SDK first fetches the configuration and then initializes the internal data structures to be used during lifespan of the MSS object.

#### Static

Application download the configuration first and then provide the open-id related configuration via initialization property OM_PROP_OPENID_CONNECT_CONFIGURATION. SDK accepts both JSON and String Objects for the same.In this, SDK does not download the configuration but just parses the JSON and initialize the internal Data Structures.

**Note:** A call to to `mss.setup()` is mandatory as all the configuration download and parsing is done in background.

##### Sample Initialization Code:

```java
Map<String, Object> map = new HashMap<>();
map.put(OMMobileSecurityService.OM_PROP_AUTHSERVER_TYPE, OMMobileSecurityService.AuthServerType.OpenIDConnect10);
map.put(OMMobileSecurityService.OM_PROP_OPENID_CONNECT_CONFIGURATION_URL, "https://idcs-abcd1234.identity.oraclecloud.com/.well-known/idcs-configuration" /*configET.getText().toString()*/);
map.put(OMMobileSecurityService.OM_PROP_OAUTH_AUTHORIZATION_GRANT_TYPE, OAuthAuthorizationGrantType.AUTHORIZATION_CODE);
map.put(OMMobileSecurityService.OM_PROP_BROWSER_MODE, OMMobileSecurityConfiguration.BrowserMode.EMBEDDED);
map.put(OMMobileSecurityService.OM_PROP_OAUTH_REDIRECT_ENDPOINT, "https://localhost");
map.put(OMMobileSecurityService.OM_PROP_OAUTH_CLIENT_ID, "123456789abcdefghij");
scopes.add("openid");scopes.add("profile");
map.put(OMMobileSecurityService.OM_PROP_OAUTH_SCOPE, scopes);
map.put(OMMobileSecurityService.OM_PROP_APPNAME, "OpenIDSampleApp");
headlessMSS = new OMMobileSecurityService(getApplicationContext(), map, new OMMobileSecurityServiceCallbackImp());
headlessMSS.setup();
```

#### Enabling PKCE

If the application wants to enable the PKCE support while doing the authentication against the Oracle Identity Cloud Service, the following property can be included in the MSS initialization configuration.

```java
map.put(OMMobileSecurityService.OM_PROP_OAUTH_ENABLE_PKCE, true);
```

#### Post Authentication

Post Authentication,SDK returns three main artifacts

1. Access Token
2. Open ID Token
3. Userinfo

After the SDK has access token and a valid and verified ID Token, control is returned back to the application.

Additionally,  SDK also populates a userinfo object in the Authentication Context, details on the userinfo can be found in the below section.

##### Sample Code to query the tokens

```
//Get all access tokens
for (OMToken token : authContext.getTokens(scopes)) {
    System.out.println("Access token: " + token.toString());
    //further details
    OAuthToken oauthToken = (OAuthToken) token;
}
```

```
//Get Open ID Token
OpenIDToken idToken = (OpenIDToken) authContext.getTokens().get(OpenIDToken.OPENID_CONNECT_TOKEN);
```

#### User Information

Once Authentication is done, application can get the user info details from the Authentication Context.

Please note that user information is created from the user claims found in the id token. SDK does not hit the user-info endpoint as of now. 

##### Sample code to get the user info.

```java
if (mAuthContext != null) {
	OpenIDUserInfo userInfo = mAuthContext.getOpenIDUserInfo();
	Log.d(TAG, userInfo.getUserTimeZone() + userInfo.getUserSubject() + userInfo.getUserLocale() + userInfo.getUserID() + userInfo.getUserLang());
}
```

#### Getting Complete User Information:

Since we have Access token post authentication, a simple OAuth resource access request can be made to user get complete user information. 

##### Sample code to get complete user info.

```java
String restEp = "http://<oracle_opc_server_hostname>/oauth2/v1/userinfo";
OMAuthorizationService authZService = new OMAuthorizationService(headlessMSS);
OMHTTPRequest request = new OMHTTPRequest(new URL(restEp), OMHTTPRequest.Method.GET);
authZService.executeRequest(request, new OMHTTPRequestCallbackImpl(),scopes);
```

### Remember the User's Credentials

This section describes how to enable the remember credentials functionality of the SDK.

#### Auto Login:

Auto login refers to the ability of SDK to cache user credentials and replay them during subsequent authentications. This is entirely a client side process , the authentication server is unaware of such scheme. Having Auto login enabled will never prompt the login screen (for user credentials) to user till the time user logs out or user session gets expired.

Use the following properties during OMMobileSecurityService initialization to use Auto Login feature:
OM_PROP_AUTO_LOGIN_ALLOWED				bool			Auto login feature allowed in the current instance of OMMobileSecurityService
(autoLogin)
OM_AUTO_LOGIN_DEFAULT					bool			Default value for the Auto Login check box on the UI
(autoLoginDefaultValue)

#### Remember Credentials:

Remember Credentials is a subset of Auto login in this the only difference is that, instead of replaying the user credentials silently, the SDK prefills the login screen with the user credentials. To authenticate, user has to tap login button.

The SDK caches the user credentials if the Remember Credentials feature is passed to SDK and after the first authentication succeeds. Use the following properties during OMMobileSecurityService initialization to use Remember Credentials feature:

OM_PROP_REMEMBER_CREDENTIALS_ALLOWED	bool			Remember Credentials feature allowed in the current instance of OMMobileSecurityService
(rememeberCredentials)

OM_REMEMBER_CREDENTIALS_DEFAULT			bool			Default value for the Remember Credentials check box on the UI
(rememeberCredentialsDefaultValue)

#### Remember User Name:

Remember username is a subset of Remember credentials. In this, only username is stored by SDK instead of the both username and password.  Use the following properties during OMMobileSecurityService initialization to use Remember User Name feature: 

OM_PROP_REMEMBER_USERNAME_ALLOWED		bool			Remember username feature allowed in the current instance of OMMobileSecurityService
(rememberUsername)

OM_REMEMBER_USERNAME_DEFAULT			bool			Default value for the Remember Username check box on the UI
(rememberUsernameDefaultValue)

Sample Code for Initialization

```java
map.put(OMMobileSecurityService.OM_PROP_AUTO_LOGIN_ALLOWED, true);
map.put(OMMobileSecurityService.OM_PROP_REMEMBER_CREDENTIALS_ALLOWED, true);
map.put(OMMobileSecurityService.OM_PROP_REMEMBER_USERNAME_ALLOWED, true);
map.put(OMMobileSecurityService.OM_AUTO_LOGIN_DEFAULT, false);
map.put(OMMobileSecurityService.OM_REMEMBER_CREDENTIALS_DEFAULT, true);
map.put(OMMobileSecurityService.OM_REMEMBER_USERNAME_DEFAULT, true);
```




### Offline Authentication
Offline authentication is supported in Basic Auth flow and OAuth Resource Owner flow. Set the following initialization property to enable this feature.

{OMMobileSecurityService.OM_PROP_OFFLINE_AUTH_ALLOWED, true}

Specify the way that offline authentication should happen when creating the OMMobileSecurityService object. Use the OM_PROP_CONNECTIVITY_MODE key. This key accepts the following values:

- `OMConnectivityMode.ONLINE` - Always authenticate with the server. Fails if device cannot reach the Internet.

- `OMConnectivityMode.OFFLINE` - Authenticates locally with cached credentials. Offline authentication happens even if the device is online and can reach the server.
- `OMConnectivityMode.AUTO` - 
  - In all authentication mechanisms except Basic Auth, authentication happens with the server if the server is reachable and happens offline if the device is not connected to the Internet. 
  - In case of Basic Auth, cookie validity determines the type of subsequent login performed. If cookies are valid, authentication is done locally, otherwise authentication is done against the server.

To support offline authentication, the credentials of the user are captured and stored by the SDK. The password of the user will either be hashed or encrypted based on the value set for the property OM_PROP_CRYPTO_SCHEME. If the application requires offline authentication and this property is not specified, the default crypto scheme is SSHA512.


### Federated Authentication [Form-based Authentication]
SDK supports Federated authentication or any Form-based authentication. The additional properties required in case of Federated Authentication are OM_PROP_LOGIN_SUCCESS_URL(mandatory), OM_PROP_LOGIN_FAILURE_URL(mandatory). The following table explains the configuration properties which can be specified while doing Federated Authentication.

- OM_PROP_LOGIN_SUCCESS_URL: The value should be a URL object or a String specifing the place where to redirect the browser after the sign in proccess is complete.
- OM_PROP_LOGIN_FAILURE_URL: The value should be a URL object or a String  specifing the place where to redirect the browser in case of failure.

All other configuration properties are neglected. Since Offline Authentication is not supported in case of Federated Authentication, it is recommended to use just Session timeout and not specify Idle timeout.

To use this mode, you can use code as given below:

```java
Map<String, Object> configurationMap = new HashMap<>();
configurationMap.put(OMMobileSecurityService.OM_PROP_AUTHSERVER_TYPE, OMMobileSecurityService.AuthServerType.FederatedAuth);
configurationMap.put(OMMobileSecurityService.OM_PROP_APPNAME, "IDMTestApp");
configurationMap.put(OMMobileSecurityService.OM_PROP_LOGIN_URL, new URL(TestConstants.FED_AUTH_HTTP_LOGIN_URL));
configurationMap.put(OMMobileSecurityService.OM_PROP_LOGIN_SUCCESS_URL, new URL(TestConstants.FED_AUTH_HTTP_LOGIN_SUCCESS_URL));
configurationMap.put(OMMobileSecurityService.OM_PROP_LOGIN_FAILURE_URL, new URL(TestConstants.FED_AUTH_HTTP_LOGIN_FAILURE_URL));
configurationMap.put(OMMobileSecurityService.OM_PROP_LOGOUT_URL, new URL(TestConstants.FED_AUTH_HTTP_LOGOUT_URL));

configurationMap.put(OMMobileSecurityService.OM_PROP_LOGOUT_SUCCESS_URL, new URL(TestConstants.FED_AUTH_HTTP_LOGOUT_SUCCESS_URL));
configurationMap.put(OMMobileSecurityService.OM_PROP_LOGOUT_FAILURE_URL, new URL(TestConstants.FED_AUTH_HTTP_LOGOUT_FAILURE_URL));                configurationMap.put(OMMobileSecurityService.OM_PROP_CONFIRM_LOGOUT_AUTOMATICALLY, true);
Set<String> logoutButtonIds = new HashSet<>();
logoutButtonIds.add("Confirm");
logoutButtonIds.add("confirm");
logoutButtonIds.add("logout_confirm");
configurationMap.put(OMMobileSecurityService.OM_PROP_CONFIRM_LOGOUT_BUTTON_ID, logoutButtonIds);

configurationMap.put(OMMobileSecurityService.OM_PROP_SESSION_TIMEOUT_VALUE, 3600); //in seconds
OMMobileSecurityService mss = new OMMobileSecurityService(getApplicationContext(), configurationMap, callback);
```

### Error Codes

The following table describes codes and descriptions for the error codes:

|    Named value/Symbolic constant              |    Numeric value    |    Short description                            |
|---------------------------------------------|-------------|-----------------------------------------------------------------|
|    COULD_NOT_CONNECT_TO_SERVER              |    10001    |    Could not connect to   server                                |
|    UN_PWD_INVALID                           |    10003    |    username or password   invalid                               |
|    INVALID_BASIC_AUTH_URL                   |    20001    |    Invalid basic auth url                                       |
|    UN_PWD_TENANT_INVALID                    |    10011    |    username, password or   tenant invalid                       |
|    NOT_YET_AUTHENTICATED                    |    10023    |    Not yet authenticated                                        |
|    USER_CANCELED_AUTHENTICATION             |    10029    |    User cancelled   authentication                              |
|    LOGOUT_TIMED_OUT                         |    10034    |    Logout timed out                                             |
|    LOGOUT_FAILED                            |    10035    |    Logout failed                                                |
|    USERNAME_REQUIRED                        |    10036    |    Username required                                            |
|    IDENTITY_DOMAIN_REQUIRED                 |    10037    |    Identity domain required                                     |
|    PASSWORD_REQUIRED                        |    10039    |    Password required                                            |
|    LOGOUT_IN_PROGRESS                       |    10043    |    Logout is in progress                                        |
|    AUTHENTICATION_FAILED                    |    10408    |    Authentication failed                                        |
|    SERVER_CERT_IMPORT_USER_CANCELED         |    10422    |    Untrusted server   certificate import was canceled.          |
|    INVALID_APP_NAME                         |    10100    |    Invalid app name                                             |
|    OAUTH_UNSUPPORTED_RESPONSE_TYPE          |    40001    |    Unsupported   response                                       |
|    OAUTH_UNAUTHORIZED_CLIENT                |    40002    |    Unauthorized client                                          |
|    OAUTH_INVALID_REQUEST                    |    40230    |    Invalid request                                              |
|    OAUTH_ACCESS_DENIED                      |    40231    |    access denied                                                |
|    OAUTH_INVALID_SCOPE                      |    40232    |    Invalid scope                                                |
|    OAUTH_SERVER_ERROR                       |    40233    |    Internal server   error                                      |
|    OAUTH_TEMPORARILY_UNAVAILABLE            |    40234    |    Oauth temporarily not   available                            |
|    OAUTH_UNSUPPORTED_GRANT_TYPE             |    40238    |    unsupported_grant_type                                       |
|    OAUTH_INVALID_CLIENT                     |    40239    |    invalid_client                                               |
|    OAUTH_INVALID_GRANT                      |    40240    |    invalid_grant                                                |
|    OAUTH_CLIENT_SECRET_INVALID              |    40241    |    Client secret can not be   null or empty for this grant type |
|    INVALID_AUTH_SERVER_TYPE                 |    10115    |    Invalid auth server   type                                   |
|    USERNAME_AND_IDENTITY_DOMAIN_REQUIRED    |    10040    |    Username and Identity   domain are required                  |
|    INVALID_CHALLENGE_INPUT_RESPONSE         |    10045    |    Challenge input response   is invalid                        |
|                                             |             |                                                                 |

All errors generated by platform APIs that we do not handle internally will be propagated as is.


## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.