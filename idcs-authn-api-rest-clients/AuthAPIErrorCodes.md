# Oracle Identity Cloud Service's Authentication API Authentication Error Codes

The SSO Authentication APIs for Oracle Identity Cloud Service REST client samples contain a collection of sample REST API requests that can be used with clients such as [Postman](http://getpostman.com) to make test calls to Oracle Identity Cloud Service's authentication API. The Authentication API enables you to develop your own customized sign-in page for Oracle Identity Cloud Service.

This document describes the error codes for the Authentication APIS for Oracle Identity Cloud Service.

## Authentication Error Codes

This table lists the authentication error codes that the Authentication SDK module responds with when there are errors. 

 | Auth Error Code  | Error Message                                     | 
 |------------------|---------------------------------------------------|
 | AUTH-3001        | You entered an incorrect user name or password.   |
 | AUTH-3002        | Your account is locked. Contact your system administrator. |
 | AUTH-3003        | Your account is deactivated. Contact your system administrator. |
 | AUTH-3004        | Your password is expired.                         |
 | AUTH-3005        | You must change your password.                    |
 | AUTH-3006        | A system error has occurred in Oracle Identity Cloud Service. Contact your system administrator. |
 | AUTH-3007        | The user name that you entered is invalid. Contact your system administrator.|
 | AUTH-3008        | Invalid token. Contact your system administrator. |
 | AUTH-3009        | Token expired. Contact your system administrator. |
 | AUTH-3010        | Oracle Identity Cloud Service can't authenticate the user account. Contact your system administrator.|
 | AUTH-3011        | There is a problem with the Oracle Identity Cloud Service server. Contact your system administrator.|
 | AUTH-3012        | A federated user can't perform local authentication.|
 | AUTH-3013        | The logout URL {0} is invalid.                    |
 | AUTH-3014        | Token has no subject.                             |
 | AUTH-3015        | Token has no issuer.                              | 
 | AUTH-3016        | Token has invalid issue time.                     |
 | AUTH-3017        | Token has no expiry time.                         |
 | AUTH-3018        | User not found.                                   |
 | AUTH-3019        | Token has no issue time.                          |
 | AUTH-3020        | The Subject claim doesn't match the Issuer claim. |
 | AUTH-3021        | The Identity Provider name is either blank or incorrect in the request.|
 | AUTH-3022        | No identity provider is configured.               |
 | AUTH-3023        | The credentials that you entered don't match the existing user session.|
 | AUTH-3024        | You aren't authorized to access the app. Contact your system administrator.|
 | AUTH-3025        | Your account is not activated. To activate your account,  click the link in the activation email that was sent to your email address.|
 | AUTH-3026        | Invalid login request. The request wasn't initiated using a supported protocol channel.|
 | AUTH-3028        | Oracle Identity Cloud Service can't authenticate the user account. Contact your system administrator.|
 | AUTH-3029        | MFA is enabled for the user. The user must provide a second factor of authentication in addition to password authentication.|
 | AUTH-3030        | Tenant has Multi-Factor Authentication (MFA) enabled. Use MFA for all users of this tenant. |
 | AUTH-3031        | User has Multi-Factor Authentication (MFA) enabled. Use MFA for this user.|
 | AUTH-3032        | The user is already logged in.                    |
 | AUTH-3033        | The sign-on policy prevents the user {0} from accessing applications protected by Oracle Identity Cloud Service because: {1}.|
 | AUTH-3034        | You configured an invalid error URL.              |
 | AUTH-1001        | Invalid request. The required parameter '{0}' is missing from the request. |
 | AUTH-1002        | The {0} authentication factor is not supported or enabled. |
 | AUTH-1003        | Your request to enroll failed because: {0}. Contact your system administrator.|
 | AUTH-1004        | Enrollment initiation request failed because: {0}. |
 | AUTH-1005        | You are enrolled in the maximum number of 2-Step Verification methods that are allowed.|
 | AUTH-1006        | Authentication initiation request failed because {0}.|
 | AUTH-1007        | Authentication failed.                             |
 | AUTH-1008        | Couldn't validate security questions because: {0}. |
 | AUTH-1009        | Couldn't update security questions because: {0}.   |
 | AUTH-1010        | Your account is locked. Contact your system administrator. |
 | AUTH-1011        | No MFA factors are enabled for this domain.        |
 | AUTH-1012        | System error.                                      |
 | AUTH-1013        | You are not authorized to use 2-Step Verification. Contact your system administrator.|
 | AUTH-1014        | The device with ID {1} is not found. Contact your system administrator.|
 | AUTH-1015        | User has not selected any security questions.      |
 | AUTH-1016        | You can't skip enrollment. 2-Step Verification is required.|
 | AUTH-1017        | Your 2-Step Verification methods are no longer valid. Contact your system administrator.|
 | AUTH-1018        | The ""{0}"" security question hasn''t been enabled for user enrollment. Please contact your system administrator.|
 | AUTH-1020        | You've already provided this answer for another security question. Please specify a different answer for this question. |
 | AUTH-1021        | The answer to the ""{0}"" security question must have at least {1} characters. |
 | AUTH-1022        | You must set up {0} security questions to use the Security Questions feature.|
 | AUTH-1023        | The hint can't be the same as the answer of a security question. |
 | AUTH-1024        | You can select a security question only once.      |
 | AUTH-1026        | You have entered the wrong answer.                 |
 | AUTH-1027        | You have exceeded the maximum number of 2-Step Verification attempts. Reset your password to unlock your account. Contact your system administrator if you can't reset your password. |
 | AUTH-1028        | You have exceeded the maximum number of 2-Step Verification attempts. Contact your system administrator to unlock your account. |
 | AUTH-1029        | Resetting factors cannot be supported if enrollment type is Required. |
 | AUTH-1030        | Your phone number {0} is not valid.                |
 | AUTH-1031        | The phone number {0} is already enrolled for the user. |
 | AUTH-1032        | The device status is not valid.                    |
 | AUTH-1033        | Payload error. Either the payload in the request is null, or the payload couldn't be parsed. |
 | AUTH-1034        | You are not authorized to perform this action.     |
 | AUTH-1035        | You have already enrolled in 2-Step Verification. Register for additional factors using the administrative console.|
 | AUTH-1036        | Session is no longer valid. Close the browser and log in again.|
 | AUTH-1037        | You must set {0} security questions.               |
 | AUTH-1038        | Please provide your answer for the ""{0}"" security question.|
 | AUTH-1039        | The ID of the {0} security question isn''t valid.  |
 | AUTH-1040        | You must answer {0} security questions.            |
 | AUTH-1041        | Your answer to the ""{0}"" security question can''t exceed {1} characters.|
 | AUTH-1042        | Your hint to the ""{0}"" security question can''t exceed {1} characters.|
 | AUTH-1100        | The SMS authentication factor is not enabled.      |
 | AUTH-1101        | The PUSH authentication factor is not enabled.     |
 | AUTH-1102        | The OTP authentication factor is not enabled.      |
 | AUTH-1103        | The Security Questions authentication factor is not enabled.|
 | AUTH-1104        | The Bypass Code authentication factor is not enabled.|
 | AUTH-1105        | Invalid passcode.                                  |
 | AUTH-1106        | Unable to process the request at this time. Use a backup verification method.|
 | AUTH-1107        | Pull notification channel has not been enabled for your tenant.|
 | AUTH-1108        | Push Notification approval is pending.             |
 | AUTH-1109        | Enrollment in the One-Time Passcode authentication method is pending verification.|
 | AUTH-1110        | The authentication token has expired.              |
 | AUTH-1111        | The request provided is invalid. Please look at the error message for validation error details.|
 | AUTH-1112        | Unexpected error encountered while processing the request.|
 | AUTH-1113        | An authentication factor must be provided while configuring a preferred device.|
 | AUTH-1114        | You must provide the deviceId when configuring {0} as the preferred authentication factor.|
 | AUTH-1115        | The authentication factor passed in the request is not supported. Supported factors are {0}.|
 | AUTH-1116        | The op passed in the request is not supported. Supported operations are {0}.|
 | AUTH-1117        | The requestState provided has expired. Please provide a valid requestState.|
 | AUTH-1118        | You provided an invalid appName. Verify that the App display name is correct.|
 | AUTH-1119        | The operation {0} isn't supported by the {1} endpoint. Use the {2} endpoint.|
 | AUTH-1120        | The requestState provided is either invalid or expired. Please provide a valid requestState.|
 | AUTH-1121        | You provided an invalid request JSON payload.      |
 | AUTH-1122        | The application is not active.                     |
 | AUTH-1123        | An error occurred while logging in using social identity.|
