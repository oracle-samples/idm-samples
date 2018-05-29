# Oracle Identity Cloud Service's Authentication API HTTPS Response Status Codes

The SSO Authentication APIs for Oracle Identity Cloud Service REST client samples contain a collection of sample REST API requests that can be used with clients such as [Postman](http://getpostman.com) to make test calls to Oracle Identity Cloud Service. 

This document describes the supported HTTPS Response Status Codes for the Authentication APIS for Oracle Identity Cloud Service.

## HTTPS Response Status Codes

The Auth APIs are REST compliant and use standard HTTP status codes to indicate failure. The table describes the different status codes and the use cases in which these status codes are sent.

 | Status Code | Use Case                          | Sample Response Body                                                            | 
 |-------------|-----------------------------------|---------------------------------------------------------------------------------|
 | 400         | This code is used to indicate a bad request. This code is sent if any attribute has been supplied with an invalid value in the payload, which signifies syntax issues.|{<br>"status": "failed",<br> "ecid": "Suwmo0F0000000000",<br> "cause":<br> [<br> {"message": "Invalid value [EMAILS] for attribute authFactor. One of [USERNAME_PASSWORD,PUSH,TOTP,EMAIL,SMS,BYPASSCODE,SECURITY_QUESTIONS] was expected.",<br>"code": "AUTH-1111"<br>}<br> ],<br> "requestState": "bnJ7Qkz2Vff0RNuxwcJQwnaQFA"<br>}<br>|
 | 401         | This code is used to indicate unauthorized access. This is used when the requestState is invalid/expired, or id of the otpCode provided during authentication is invalid.|{<br>"status": "failed",<br> "ecid": "3YkZh1H0000000000",<br> "cause":<br> [<br> {"message": "You entered an incorrect user name or password.",<br>"code": "AUTH-3001"}<br> ],<br> "requestState": "b0EYFnXpo"<br>}|
 | 422         | This code is used when the request is syntaxtically correct, but semantically wrong. 422 means the request is an unprocessable entity. For example, if the request is missing the op attribute, which is mandatory for a given action.|{<br>"status": "failed", <br>"ecid": "KIN^r0J0000000000",<br> "nextOp": ["credSubmit"],<br> "cause":<br> [<br> {"message": "Your input request is missing the op attribute, which is mandatory.", <br>"code": "AUTH-1111"}<br>],<br> "requestState": "b0EYFnLpFWEihmJ6btqTXpo",<br>"USERNAME_PASSWORD": <br>{"credentials": ["username","password"] },<br> "nextAuthFactors": ["USERNAME_PASSWORD"]<br> }|
 | 500         | This code indicates an internal server error. When this error occurs, the response contains the ecId and the cause so that the client can contact the admin for further details.|  |