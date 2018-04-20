# Oracle Identity Cloud Service's Mobile Software Development Kit (SDK) for iOS

 
## Introduction 
The IDM Mobile SDK provides a single, unified, seamless & consistent that would work with existing IDM infrastructure both within enterprise & cloud. 
It servers as a Security Layer for developing secure mobile applications on Universal Windows platforms, iOS and Android platforms. 
This document explains the IDM Mobile SDK (Headless), its functionality, and how to consume the same in iOS applications. 
 
## Functionalities 
1. Initialization 
2. Authentication 
	a. HTTP Basic Authentication 
	b. OAuth 2.0 Authentication 
		i. Authorization Grant flow 
		ii. Resource Owner flow 
		iii. Client credential flow 
		iv. Implicit flow 
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
* **Authentication Module:** It performs user authentication against remote server by specified protocol. SDK supports HTTP Basic, OAuth 2.0 (authorization grant flow, resource owner flow, client credential flow, implicit flow), OpenID, Federated and Certificate based authentication. 
* **Cryptography Module:** Cryptography module has support for all cryptography needs e.g. Encryption, Decryption, Hashing, Signature verification etc. It supports all cryptographi algorithms. 
* **Local Authentication Module:** Local authenitcation module provides features of local authentication using PIN or biometric. 
* **Key Store Module:** Key Store module provides faetures for managing key encryption keys or data encryption keys, which includes CRUD operations on keys. These keys are used for cryptographic operation on any type of data. 
* **Secure Storage Module:** Secure storage module provides way to store any type of data securely, which cannot be tampered and accessed by unauthorized user. 
* **Connection Handler Module:** This module provides feature to invoke REST call. 
 
## Developing Platform Applications 
The IDM mobile SDK for iOS available in both Framework and library format. Developers can consume either Framework or library.
 
 
### Set Up the project in the Integrated Development Environment (IDE) 

Consuming the IDM Mobile SDK

##### Framework
IDM Mobile Headless SDK for iOS is provided as a framework which developers can include in their project.The steps for which are as follows
1. Go to your Xcode project Targets and scroll to General>Embedded Binaries
2. Click on the + sign. This will ask you to Choose frameworks and libraries to add
3. Click on Add Other and navigate to IDMMobileSDKv2.framework and click add

##### Library
1. Go to your Xcode project Targets and scroll to Linked Framework and Libraries
2. Click on the + sign. This will ask you to Choose frameworks and libraries to add
3. Click on Add Other and navigate to libIDMMobileSDKv2Library.a and click add
4. Add "PublicHeaders" to your project using “Add Files to <your_project_name>” option.
5. PublicHeaders contains header files of IDM Mobile SDK. You can just include IDMMobileSDKv2Library.h file, which takes care of including required SDK header files.
6.Open "Build Settings" and search for "Other Linker Flags". Add “-ObjC –all_load” to Other Linker Flags. 

##### Add frameworks
Open Build Phases in your project and expand "Link Binary with Libraries". Using the "+" button add following frameworks one after the other.
```iOS
    SystemConfiguration.framework
    Security.framework
    WebKit.framework
    LocalAuthentication.framework
```

### Write Your Code 
This section uses reference code to help you understand how to develop your application using the SDK. 
 
**1. Initial SDK setup:** 
 
First step is to Initialize a dictionary with the properties required for configuring the  SDK, create OMMobileSecurityService instance and to receive authentication  events and authentication  challenges callback the class should implement OMMobileSecurityServiceDelegate.

a. Create a Dictionary to populate parameters and add parameters in it.
```iOS
    NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    [dict setObject:OM_PROP_AUTHSERVER_HTTPBASIC forKey:OM_PROP_AUTHSERVER_TYPE];
    [dict setObject:@"TestApp" forKey:OM_PROP_APPNAME];
    [dict setObject:@"http://adc01jql.us.oracle.com:8080/basic" forKey:OM_PROP_LOGIN_URL];
    [dict setObject:@"http://adc01jql.us.oracle.com:8080/oma/index.html"  forKey:OM_PROP_LOGOUT_URL];
	For detailed information about supported properties, refer to "List of Initialization Parameters" section below. 
```

b. Now create the instance of OMMobileSecurityService and pass the initialization dictionary and OMMobileSecurityServiceDelegate delegate object.
```iOS
OMMobileSecurityService *mss = [[OMMobileSecurityService alloc] initWithProperties:dict delegate:self];	 
```
If your app will authenticate against single OAM server or single ServiceDomain, there should be only one instance of the OMMobileSecurityService object throughout the application life cycle. This is required to maintain one valid session with the server at a time, and also to support the single sign-on feature. 
 
c. Call the Setup method (Optional) 
Call the [self.mss setup]; method, which is mandatory in case of OpenID authentication. It will download application profile from authentication server.

This is an asynchronous call and when the operation is completed successfully then you will get "configuration" object. Incase of any problem is encountered then "configuration" will be nil and error object is returned.
```iOS
(void)mobileSecurityService:(OMMobileSecurityService *)mss completedSetupWithConfiguration:(OMMobileSecurityConfiguration *)configuration error:(NSError *)error
{
}
``` 
	 
* Setup challenge [X] 
``` 
OMChallengeServerTrust

You will receive the challenge with challengeType as OMChallengeServerTrust challenge, if server certificate is untrusted. 
 
**2. Authenticate users:** 
 
	call the [mss startAuthenticationProcess:nil]; to start the authentication.
if you used the Setup methods you need to wait till 
-(void)mobileSecurityService:(OMMobileSecurityService *)mss completedSetupWithConfiguration:(OMMobileSecurityConfiguration *)configuration error:(NSError *)error; callback to start authentication 
 
a. Define one Method to implement OMAuthChallengeEvent callback
```iOS
(void)mobileSecurityService:(OMMobileSecurityService *)mss didReceiveAuthenticationChallenge:(OMAuthenticationChallenge *)challenge {
    if (challenge.challengeType == OMChallengeUsernamePassword) // Userid and password is requested for 								authentication 
	// Pass userid and password to SDK for authentication 
        if ([[challenge.authData objectForKey:OM_USERNAME] isEqual: [NSNull null]])
        {
            [dictionary setValue:@"u1" forKey:OM_USERNAME];
        }
        if ([[challenge.authData objectForKey:OM_PASSWORD] isEqual: [NSNull null]])
        {
            [dictionary setValue:@"welcome1" forKey:OM_PASSWORD];
        }
        challenge.authChallengeHandler(dictionary,OMProceed);
    }
    else if (challenge.challengeType == OMChallengeClientCert)
    {
	// Pass client certificate to SDK for authentication. 
        NSArray *certsInfo = [dictionary objectForKey:OM_CLIENTCERTS];
        OMCertInfo *selectedInfo = [certsInfo firstObject];
        [dictionary setObject:selectedInfo forKey:OM_SELECTED_CERT];
        challenge.authChallengeHandler(dictionary,OMProceed);
    }else if (challenge.challengeType == OMChallengeServerTrust)
    {
	// Handle untrusted server certificate scenario
	[dictionary setObject:[NSNumber numberWithBool:YES]
                       forKey:OM_TRUST_SERVER_CHALLANGE];
        challenge.authChallengeHandler(dictionary,OMProceed);
    }
    else if (challenge.challengeType == OMChallengeExternalBrowser)
    {
	// Launch external browser and load Login URL from args 
        NSURL *url = [dictionary valueForKey:@"frontChannelURL"];
        if ([[UIApplication sharedApplication] canOpenURL:url])
        {
            [[UIApplication sharedApplication] openURL:url];
        }
    }
   else  if (challenge.challengeType == OMChallengeEmbeddedBrowser)
    {
	// Pass Webview object to SDK
        [dictionary setObject:self.fedWebView forKey:OM_PROP_AUTH_WEBVIEW];

        challenge.authChallengeHandler(dictionary,OMProceed);
    }
}
``` 
	 
b. Call the completion handler.
	once all the required fields are set, call the completion handler with the new dictionary and proceed. 
```iOS
challenge.authChallengeHandler(dictionary,OMProceed);
```
	This is an asynchronous request and when the authentication is completed successfully then the delegate method 
```iOS
	(void)mobileSecurityService:(OMMobileSecurityService *)mss
     didFinishAuthentication:(OMAuthenticationContext *)context error:(NSError *)error
```` 

will be called, "context" will be authentication context object. Incase of any problem is encountered during authentication then "context" will be null and error object will be send . 
	 
	 
* Authentication challenge [X] 
```
The mobileSecurityService:didReceiveAuthenticationChallenge: delegate method calls for the following types of authentication challenges
 
OMUsernamePassword 
This challenge is sent, when userid and password is requested.  
 
OMChallengeEmbeddedBrowser 
This challenge is sent, when webview instance is requested to navigate login page. 
 
OMChallengeExternalBrowser 
This challenge is sent, when it asked to navigate login page in external web browser. 
 
OMChallengeServerTrust 
This challenge is sent, if server certificate is untrusted. 
 
OMChallengeClientCert 
This challenge is sent, when client certificate is requested. 

OMChallengeEmbeddedSafari 
This challenge is sent, when SFSafariViewController instance is requested to navigate login page. 
 
 
**3. Access authenticated user information:** 
 
Now use Authentication context to access protected resources. 
 ```iOS
        NSDictionary *headerTokens = context.accessTokens;
        OMConnectionHandler *connectionHandler = [[OMConnectionHandler alloc] init];
        
	[connectionHandler invokeHTTPRequestAsynchronouslyForURL:@"https://host:port/someurl" 
	withPayload:nil header:headerTokens 
	requestType:@"GET" convertDataToJSON:YES 
	completionHandler:^(id data, NSURLResponse *response, NSError *error) {
        }];
```

**4. Logout procedure:** 
 
App can invoke logout: method to perform logout. 
 
a. Define one Method to implement LogoutAuthenticationChallenge callback
```iOS
(void)mobileSecurityService:(OMMobileSecurityService *)mss didReceiveLogoutAuthenticationChallenge:				(OMAuthenticationChallenge *)challenge
	{
    NSMutableDictionary *dictionary = [NSMutableDictionary
                                       dictionaryWithDictionary:challenge.authData];
    if (challenge.challengeType == OMChallengeEmbeddedBrowser)
    {
         [dictionary setObject:self.fedWebView forKey:OM_PROP_AUTH_WEBVIEW];
          challenge.authChallengeHandler(dictionary,OMProceed);
    }else if (challenge.challengeType == OMChallengeServerTrust)
    {
	// Handle untrusted server certificate scenario
	[dictionary setObject:[NSNumber numberWithBool:YES]
                       forKey:OM_TRUST_SERVER_CHALLANGE];
        challenge.authChallengeHandler(dictionary,OMProceed);
    }
}
```	 
	 
b. Invoke Logout method 
	[mss logout:true]	 
	This is an asynchronous call and when the logout is completed then the SDK will call the -(void)mobileSecurityService:didFinishLogout: method, if error came it will send the error Object 

-(void)mobileSecurityService:(OMMobileSecurityService *)mss

             didFinishLogout:(NSError *)error

{


}
 
``` 
* Logout challenge [X] 
``` 
OMChallengeEmbeddedBrowser 
This challenge is sent, when webview instance is requested for logout.  
 
OMChallengeServerTrust 
This challenge is sent, if server certificate is untrusted.  


## Additional Information 
 
### List of Initialization Parameters 
 
Property Name 				| Description 				| Property Value 					| Property Type 		| Mandatory 
------------- 				| ----------- 				| -------------- 					| ------------- 		| --------- 
Prop 		  				| description 				| value 		 					| type 		 			| yes/optional 
 
[Please refer Initialization Properties section in https://stbeehive.oracle.com/teamcollab/wiki/Mobile+Development:IDM+Mobile+SDK+configuration+parameters wiki.] 
 
 
### Remember the User's Credentials 
This section describes how to enable the remember credentials functionality of the SDK 
 
Auto Login: 
 
Auto login refers to the ability of SDK to cache user credentials and replay them during subsequent authentications. This is entirely a client side process , the authentication server is unaware of such scheme. Having Auto login enabled will never prompt the login screen (for user credentials) to user till the time user logs out or user session gets expired. 
 
Use the following during OMMobileSecurityService initialization. 
OM_PROP_AUTO_LOGIN_ALLOWED				bool			Auto login feature allowed in the current instance of OMMobileSecurityService 
(autoLogin) 
OM_AUTO_LOGIN_DEFAULT					bool			Default value for the Auto Login check box on the UI 
(autoLoginDefaultValue) 
 
 
Remember Credentials: 
 
Remember Credentials is a subset of Auto login in this the only difference is that, instead of replaying the user credentials silently, the SDK pre fills the login screen with the user credentials. To authenticate, user has to tap login button. 
 
The SDK caches the user credentials if the Remember Credentials feature is passed to SDK and after the first authentication succeeds. To enable Remember Credentials feature use property 
 
OM_PROP_REMEMBER_CREDENTIALS_ALLOWED	bool			Remember Credentials feature allowed in the current instance of OMMobileSecurityService 
(rememeberCredentials) 
 
OM_REMEMBER_CREDENTIALS_DEFAULT			bool			Default value for the Remember Credentials check box on the UI 
(rememeberCredentialsDefaultValue) 
 
 
Remember User Name: 
 
Remember username if subset of Remember credentials, in this only username is stored by SDK instead of the both username and password. To enable Remember User Name feature use property 

OM_PROP_REMEMBER_USERNAME_ALLOWED		bool			Remember username feature allowed in the current instance of OMMobileSecurityService 
(rememberUsername) 
 
OM_REMEMBER_USERNAME_DEFAULT			bool			Default value for the Remember Username check box on the UI 
(rememberUsernameDefaultValue) 


Sample Code for Initialization 
```iOS
[dict setObject:@"TRUE" forKey:OM_PROP_AUTO_LOGIN_ALLOWED];
[dict setObject:@"TRUE" forKey:OM_PROP_REMEMBER_CREDENTIALS_ALLOWED];
[dict setObject:@"TRUE" forKey:OM_PROP_REMEMBER_USERNAME_ALLOWED];

If the developer want to persist the credentials as per these preferences then the following needs to be set in didReceiveAuthenticationChallenge delegate method

[dictionary setObject:[NSNumber numberWithBool:true] forKey:OM_AUTO_LOGIN_PREF];
[dictionary setObject:[NSNumber numberWithBool:true] forKey:OM_REMEMBER_CREDENTIALS_PREF];
[dictionary setObject:[NSNumber numberWithBool:true] forKey:OM_REMEMBER_USERNAME_PREF]; 
```

### Offline Authentication 
Offline authentication is supported in Basic Auth flow and oAuth resource owner flow. Set the following initialization property to enable feature. 
```iOS
    [dict setObject:@"TRUE" forKey:OM_PROP_OFFLINE_AUTH_ALLOWED];
 
Specify the way that offline authentication should happen when creating the OMMobileSecurityService object. Use the OM_PROP_CONNECTIVITY_MODE key. This key accepts the following values: 
 
    OMConnectivityOnline - Always authenticate with the server. Fails if device cannot reach the Internet. 
   
   OMConnectivityOffline - Authenticates locally with cached credentials. Offline authentication happens even if the device is online and can reach the server.
 
    OMConnectivityAuto - Authentication happens with the server if the server is reachable and happens offline if the device is not connected to the Internet. 
```
 
To support offline authentication, the credentials of the user are captured and stored by the SDK. The password of the user will either be hashed or encrypted based on the value set for the property OM_PROP_CRYPTO_SCHEME. If the application requires offline authentication and this property is not specified, the default crypto scheme is SSHA512. 
 
 
### Federated Authentication [Form-based Authentication] 
SDK supports Federated authentication or any Form-based authentication. The additional properties required in case of Federated Authentication are OM_PROP_LOGIN_SUCCESS_URL(mandatory), OM_PROP_LOGIN_FAILURE_URL(mandatory). The following table explains the configuration properties which can be specified while doing Federated Authentication. 
 
[Refer table present in Federated Autheticatoin section in https://confluence.oraclecorp.com/confluence/display/OCIS/IDM+Mobile+Headeless+SDK+for+iOS wiki.] 
 
All other configuration properties are neglected. Since Offline Authentication is not supported in case of Federated Authentication, it is recommended to keep the Idle time out and Session time out as the same. 
 
To use this mode, you can use code as given below: 
```iOS
 	NSMutableDictionary *dict = [NSMutableDictionary dictionary];
    	[dict setObject:OM_PROP_AUTHSERVER_FED_AUTH forKey:OM_PROP_AUTHSERVER_TYPE];
    	[dict setObject:@"TestApp" forKey:OM_PROP_APPNAME];
        [dict setObject:@"http:/loginurl" forKey:OM_PROP_LOGIN_URL];
        [dict setObject:@"http:/loginurlsuccess.html" forKey:OM_PROP_LOGIN_SUCCESS_URL];
        [dict setObject:@"http:/loginurlfailure.html" forKey:OM_PROP_LOGIN_FAILURE_URL];
        [dict setObject:@"http://logoutUrl" forKey:OM_PROP_LOGOUT_URL];
            
	//Setting session time-out and idle connection time out are optional 

        [dict setObject:@"55" forKey:OM_PROP_IDLE_TIMEOUT_VALUE];
        [dict setObject:@"55" forKey:OM_PROP_SESSION_TIMEOUT_VALUE];
        [dict setObject:@"60" forKey:OM_PROP_PERCENTAGE_TO_IDLE_TIMEOUT];
```
WKWebView Support
 
In iOS Federated Authentication supports both UIWebView and WKWebView for authentication default is UIWebView.

To enable the WKWebView you need add below code to configuration 
```iOS
    if ([OMMobileSecurityConfiguration isWKWebViewAvailable])
    {
        [dict setObject:@"TRUE" forKey:OM_PROP_ENABLE_WKWEBVIEW];
        
    }
```

### OAuth 2.0 
IDMMobile SDK provides authorization against OAuth Server in order to access the protected resources. The SDK will also work against any OAuth2.0 generic server which supports the below mentioned grant types for mobile clients. 

IDMMobile SDK supports authorization against any OAuth2.0 compliant server .The support is added in order to fit with current authentication architecture followed by the IDMMobile SDK for other types of authentications .
The Current implementation supports following grant types:

- Implicit
- Authorization code
- Resource Owner Credentials
- Client credential
- Assertion

The following are the new properties added for OAuth2.0 supoprt:

| Configuration Property                 | Valid Value                                                 | Mandatory                                                                                                                                                                                                           |
|----------------------------------------|-------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| OM_PROP_AUTHSERVER_TYPE                | OM_PROP_OAUTH_OAUTH20_SERVER                                | Yes                                                                                                                                                                                                                 |
| OM_PROP_OAUTH_AUTHORIZATION_GRANT_TYPE | OM_OAUTH_AUTHORIZATION_CODE                                 | yes                                                                                                                                                                                                                 |
|  OM_OAUTH_IMPLICIT                     |                                                             |                                                                                                                                                                                                                     |
| OM_OAUTH_RESOURCE_OWNER                |                                                             |                                                                                                                                                                                                                     |
| OM_PROP_OAUTH_AUTHORIZATION_ENDPOINT   | NSString                                                    | Not Mandatory if OM_PROP_OAUTH_AUTHORIZATION_GRANT_TYPE is   OM_OAUTH_RESOURCE_OWNER                                                                                                                                |
| OM_PROP_OAUTH_TOKEN_ENDPOINT           | NSString                                                    | Mandatory if the OM_PROP_OAUTH_AUTHORIZATION_GRANT_TYPE is   OM_OAUTH_AUTHORIZATION_CODE or OM_OAUTH_RESOURCE_OWNER                                                                                                 |
| OM_PROP_OAUTH_REDIRECT_ENDPOINT        | NSString                                                    | Not Mandatory if OM_PROP_OAUTH_AUTHORIZATION_GRANT_TYPE is   OM_OAUTH_RESOURCE_OWNER                                                                                                                                |
| OM_PROP_OAUTH_CLIENT_ID                | NSString                                                    | yes                                                                                                                                                                                                                 |
| OM_PROP_OAUTH_SCOPE                    | NSSet                                                       | No                                                                                                                                                                                                                  |
| OM_PROP_BROWSER_MODE                   | OM_PROP_BROWSERMODE_EMBEDDED orOM_PROP_BROWSERMODE_EXTERNAL | No , But default will be EXTERNAL if nothing is set during   initialization .                                                                                                                                       |
| OM_PROP_OAUTH_CLIENT_SECRET            | NSString                                                    | No                                                                                                                                                                                                                  |
| OM_PROP_OAUTH_OAM_SERVICE_ENDPOINT     | NSString                                                    | Mandatory for Mobile & Social mobile client flows. In   case of M&S mobile clients this attribute will be used to get client   profile. Token and Authorization endpoints will be formed from the client   profile. |

[Please add Standard flows, Getting the tokens from SDK, Accessing protected resources and credential collection sections from above mentioned wiki.] 


### Timers
After successful login app has to register for session timeout and idle timeout timers using OMAuthenticationContextDelegate protocol.

During config user can mention the timeout intervals

[dict setObject:@"32" forKey:OM_PROP_IDLE_TIMEOUT_VALUE];
[dict setObject:@"55" forKey:OM_PROP_SESSION_TIMEOUT_VALUE];
[dict setObject:@"60" forKey:OM_PROP_PERCENTAGE_TO_IDLE_TIMEOUT];

@protocol OMAuthenticationContextDelegate<NSObject>
-(void)authContext:(OMAuthenticationContext *)context timeoutOccuredForTimer:(OMTimerType)timerType remainingTime:(NSTimeInterval)duration;
@end

Usage:

1. Registering for callback.
```iOS
-(void)mobileSecurityService:(OMMobileSecurityService *)mss
didFinishAuthentication:(OMAuthenticationContext *)context error:(NSError *)error
{
if (!error) {
self.context = context;
self.context.delegate = self;
}
}
```
2.Delegate Methods Implementation
```iOS
-(void)authContext:(OMAuthenticationContext *)context timeoutOccuredForTimer:(OMTimerType)timerType remainingTime:(NSTimeInterval)duration
{
if (timerType == OMSessionTimer) {

NSLog(@"Session Expired");

}else if (timerType == OMIdleSessionTimer)
{
NSLog(@"IdleSession remainingTime = %f", duration);

}
}
```
One can reset the timer by calling reset timer api, which takes input parameter of OMTimerType on authcontext instance.
```
(BOOL)resetTimer:(OMTimerType)timerType;
```
Note: If OM_PROP_PERCENTAGE_TO_IDLE_TIMEOUT value is too low the calculated Delta T could be very less.

 

e.g. If Total Idle Timeout = 100 seconds

OM_PROP_PERCENTAGE_TO_IDLE_TIMEOUT = 5%

Delta T would be calculated = 5 Seconds

In this case, the warning event would be fired at 95 seconds and would have only 5 seconds for Idle time to go off.

It’s up to the developer to configure correct/well-suited % value for OM_PROP_PERCENTAGE_TO_IDLE_TIMEOUT so that sufficient time period is available for idle time to go off. This is important especially in cases where App Users have to take the decision/react based on timer events and idle timeouts. In this case, the user would have only 5 seconds to respond!

 





### Error Codes

The following table describes codes and descriptions for the error codes:

|    Named value/Symbolic constant                 |    Numeric  |    Short description                                            |
|--------------------------------------------------|-------------|-----------------------------------------------------------------|
|    COULD_NOT_CONNECT_TO_SERVER                   |    10001    |    Could not connect to   server                                |
|    UN_PWD_INVALID                                |    10003    |    username or password   invalid                               |
|    COULD_NOT_PARSE_RESPONSE_FROM_SERVER          |    10005    |    Could not parse response   from server                       |
|    UN_PWD_TENANT_INVALID                         |    10011    |    username, password or   tenant invalid                       |
|    INITIALIZATION_FAILED                         |    10025    |    Initialization failed                                        |
|    IDENTITY_DOMAIN_REQUIRED                      |    10037    |    Identity domain required                                     |
|    AUTHENTICATION_TIMED_OUT                      |    10042    |    Authentication timed out                                     |
|    KEY_IS_NIL                                    |    10501    |    key for credential or for   map nil                          |
|    INVALID_INPUT                                 |    10502    |    Input is not proper   ,invalid input or missing input        |
|    MEMORY_ALLOCATION_FAILURE                     |    10503    |    out of memory in keychain                                    |
|    RANDOM_GENERATOR_SYSTEM_ERROR                 |    10504    |    Random generation failure                                    |
|    REQUESTED_LENGTH_TOO_SHORT                    |    10505    |    salt length less then min   length                           |
|    INPUT_TEXT_CANNOT_BE_EMPTY                    |    10506    |    Input text empty                                             |
|    UNKNOWN_OR_UNSUPPORTED_ALGORITHM              |    10507    |    unsupported encrypt   algorithm                              |
|    KEY_SIZE_NOT_SUPPORTED_BY_ALGORITHM           |    10508    |    key size not   supported                                     |
|    IV_LENGTH_MUST_MATCH_ALGORITHM_BLOCK_SIZE     |    10509    |    length not matching to   block size                          |
|    PADDING_REQUIRED                              |    10510    |    padding missing   error                                      |
|    ENCRYPTION_SYSTEM_ERROR                       |    10511    |    ENCRYPTION SYSTEM ERROR                                      |
|    REQUESTED_LENGTH_NOT_A_MULTIPLE_OF_4          |    10512    |    key length not multiple   of 4                               |
|    SALT_REQUIRED_FOR_CHOSEN_ALGORITHM            |    10513    |    salt required error                                          |
|    SALT_NOT_SUPPORTED_FOR_CHOSEN_ALGORITHM       |    10514    |    salt not supported for   algorithm                           |
|    CANNOT_PREFIX_SALT_IN_NON_SALTED_ALGORITHM    |    10515    |    cannot prefix salt in not   supported salt algorithm         |
|    DENIED_ACTION                                 |    10030    |    user denied                                                  |
|    INPUT_NOT_PREFIXED_WITH_ALGORITHM_NAME        |    10516    |    Algorithm name   missing                                     |
|    INPUT_MUST_BE_NSSTRING_WHEN_BASE64_IS_ENABLED |    10517    |    input has to be NSString   type                              |
|    UNKNOWN_INPUT_TYPE                            |    10518    |    unknown input type                                           |
|    INPUT_LENGTH_MUST_BE_LESS_THAN_OR_EQUAL_TO    |    10519    |    input length error                                           |
|    KEYPAIR_GENERATION_SYSTEM_ERROR               |    10520    |    key-pair generation   system error                           |
|    TAG_REQUIRED_TO_IDENTIFY_KEY_IN_KEYCHAIN      |    10521    |    tag require to identify   key in key-chain error             |
|    KEYCHAIN_SYSTEM_ERROR                         |    10522    |    key-chain system   error                                     |
|    KEYCHAIN_ITEM_NOT_FOUND                       |    10523    |    key-chain item missing                                       |
|    SIGNING_SYSTEM_ERROR                          |    10524    |    signing missing   error                                      |
|    INPUT_SIGN_CANNOT_BE_EMPTY                    |    10525    |    sign cannot be empty                                         |
|    VERIFICATION_SYSTEM_ERROR                     |    10526    |    system verification   failed                                 |
|    DECRYPTION_SYSTEM_ERROR                       |    10527    |    Decryption system error                                      |
|    KEYCHAIN_ITEM_ALREADY_FOUND                   |    10528    |    key-chain item already   there                               |
|    UNKNOWN_OR_UNSUPPORTED_KEY_TYPE               |    10529    |    Unsupported key type                                         |
|    INVALID_KEYCHAIN_DATA_PROTECTION_LEVEL        |    10530    |    invalid key chain   protection level                         |
|    PBKDF2_KEY_GENERATION_ERROR                   |    10531    |    PBKDF2 key generation   error                                |
|    DELEGATE_NOT_SET                              |    10532    |    delegate missing   error                                     |
|    RESOURCE_FILE_PATH                            |    10533    |    file not found at   resource path error                      |
|    INVALID_APP_NAME                              |    10100    |    Invalid app name                                             |
|    LOGIN_URL_IS_INVALID                          |    10101    |    invalid login URL                                            |
|    LOGOUT_URL_IS_INVALID                         |    10102    |    invalid logout URL                                           |
|    INVALID_SESSION_TIMEOUT_TIME                  |    10103    |    invalid session timeout   time                               |
|    INVALID_IDLE_SESSION_TIMEOUT_TIME             |    10104    |    Invalid idle session   timeout time                          |
|    INVALID_IDLE_SESSION_DELTA                    |    10105    |    invalid idle session   timeout delta                         |
|    INVALID_RETRY_COUNTS                          |    10106    |    Invalid retry counts                                         |
|    OAUTH_UNSUPPORTED_RESPONSE_TYPE               |    40001    |    Unsupported   response                                       |
|    OAUTH_UNAUTHORIZED_CLIENT                     |    40002    |    Unauthorized client                                          |
|    OAUTH_INVALID_REQUEST                         |    40230    |    Invalid request                                              |
|    OAUTH_ACCESS_DENIED                           |    40231    |    access denied                                                |
|    OAUTH_INVALID_SCOPE                           |    40232    |    Invalid scope                                                |
|    OAUTH_SERVER_ERROR                            |    40233    |    Internal server   error                                      |
|    OAUTH_TEMPORARILY_UNAVAILABLE                 |    40234    |    Oauth temporarily not   available                            |
|    OAUTH_OTHER_ERROR                             |    40235    |    Unknown error                                                |
|    OAUTH_BAD_REQUEST                             |    40236    |    Bad request                                                  |
|    OAUTH_CLIENT_ASSERTION_REVOKED                |    40237    |    Client assertion                                             |
|    OAUTH_CLIENT_SECRET_INVALID                   |    40241    |    Client secret can not be   null or empty for this grant type |
|    INVALID_REQUIRED_TOKENS                       |    10107    |    Invalid required tokens   format                             |
|    INVALID_IDENTITY_DOMAIN                       |    10108    |    Invalid identity domain   format                             |
|    INVALID_COLLECT_IDENTITY_DOMAIN_PARM          |    10109    |    Invalid collect identity   domain format                     |
|    INVALID_REMEMBER_CREDENTIALS_ENABLED_PARM     |    10110    |    Invalid remember   credentials enabled parm                  |
|    INVALID_REMEMBER_USERNAME_DEFAULT_PARM        |    10111    |    Invalid remember username   default parm                     |
|    INVALID_AUTOLOGIN_PARM                        |    10112    |    Invalid autologin parm                                       |
|    INVALID_REMEMBER_CREDENTIALS_PARM             |    10113    |    invalid remember   credentails parm                          |
|    INVALID_REMEMBER_USERNAME_PARM                |    10114    |    invalid remember username   parm                             |
|    INVALID_AUTH_SERVER_TYPE                      |    10115    |    Invalid auth server   type                                   |
|    INVALID_OFFLINE_AUTH_ALLOWED_PARM             |    10116    |    INVALID_OFFLINE_AUTH_ALLOWED_PARM                            |
|    INVALID_CONNECTIVITY_MODE_PARM                |    10117    |    Invalid connectivity   mode                                  |
|    FEDAUTH_LOGIN_SUCCESS_URL_IS_INVALID          |    50001    |    Fedauth invalid login   successes url                        |
|    FEDAUTH_LOGIN_FAILURE_URL_IS_INVALID          |    50002    |    Fedauth invalid login   failure url                          |

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.