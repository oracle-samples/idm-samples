# Oracle Identity Cloud Service's Mobile Software Development Kit (SDK) for iOS

## Error Codes

The following table describes codes and descriptions for the error codes the Mobile SDK issues:

| Named Value/Symbolic Constant                       | Code Number    | Short Description                                             |
|-----------------------------------------------------|----------------|---------------------------------------------------------------|
|       COULD_NOT_CONNECT_TO_SERVER                   |       10001    |    Could not connect to   server                              |
|       UN_PWD_INVALID                                |       10003    |    Username or password   invalid                             |
|       COULD_NOT_PARSE_RESPONSE_FROM_SERVER          |       10005    |    Could not parse response   from server                     |
|       UN_PWD_TENANT_INVALID                         |       10011    |    Username, password or   tenant invalid                     |
|       INITIALIZATION_FAILED                         |       10025    |    Initialization failed                                      |
|       IDENTITY_DOMAIN_REQUIRED                      |       10037    |    Identity domain required                                   |
|       AUTHENTICATION_TIMED_OUT                      |       10042    |    Authentication timed out                                   |
|       KEY_IS_NIL                                    |       10501    |    Key for credential or for map nil                          |
|       INVALID_INPUT                                 |       10502    |    Input is not proper   ,invalid input or missing input      |
|       MEMORY_ALLOCATION_FAILURE                     |       10503    |    Out of memory in keychain                                  |
|       RANDOM_GENERATOR_SYSTEM_ERROR                 |       10504    |    Random generation failure                                  |
|       REQUESTED_LENGTH_TOO_SHORT                    |       10505    |    Salt length less then min length                           |
|       INPUT_TEXT_CANNOT_BE_EMPTY                    |       10506    |    Input text empty                                           |
|       UNKNOWN_OR_UNSUPPORTED_ALGORITHM              |       10507    |    Unsupported encrypt   algorithm                            |
|       KEY_SIZE_NOT_SUPPORTED_BY_ALGORITHM           |       10508    |    Key size not supported                                     |
|       IV_LENGTH_MUST_MATCH_ALGORITHM_BLOCK_SIZE     |       10509    |    Length not matching to block size                          |
|       PADDING_REQUIRED                              |       10510    |    padding missing error                                      |
|       ENCRYPTION_SYSTEM_ERROR                       |       10511    |    ENCRYPTION SYSTEM ERROR                                    |
|       REQUESTED_LENGTH_NOT_A_MULTIPLE_OF_4          |       10512    |    key length not multiple of 4                               |
|       SALT_REQUIRED_FOR_CHOSEN_ALGORITHM            |       10513    |    salt required error                                        |
|       SALT_NOT_SUPPORTED_FOR_CHOSEN_ALGORITHM       |       10514    |    salt not supported for algorithm                           |
|       CANNOT_PREFIX_SALT_IN_NON_SALTED_ALGORITHM    |       10515    |    cannot prefix salt in not supported salt algorithm         |
|       DENIED_ACTION                                 |       10030    |    user denied                                                |
|       INPUT_NOT_PREFIXED_WITH_ALGORITHM_NAME        |       10516    |    Algorithm name missing                                     |
|       INPUT_MUST_BE_NSSTRING_WHEN_BASE64_IS_ENABLED |       10517    |    input has to be NSString   type                            |
|       UNKNOWN_INPUT_TYPE                            |       10518    |    unknown input type                                         |
|       INPUT_LENGTH_MUST_BE_LESS_THAN_OR_EQUAL_TO    |       10519    |    input length error                                         |
|       KEYPAIR_GENERATION_SYSTEM_ERROR               |       10520    |    key-pair generation   system error                         |
|       TAG_REQUIRED_TO_IDENTIFY_KEY_IN_KEYCHAIN      |       10521    |    tag require to identify   key in key-chain error           |
|       KEYCHAIN_SYSTEM_ERROR                         |       10522    |    key-chain system   error                                   |
|       KEYCHAIN_ITEM_NOT_FOUND                       |       10523    |    key-chain item missing                                     |
|       SIGNING_SYSTEM_ERROR                          |       10524    |    signing missing   error                                    |
|       INPUT_SIGN_CANNOT_BE_EMPTY                    |       10525    |    sign cannot be empty                                       |
|       VERIFICATION_SYSTEM_ERROR                     |       10526    |    system verification   failed                               |
|       DECRYPTION_SYSTEM_ERROR                       |       10527    |    Decryption system error                                    |
|       KEYCHAIN_ITEM_ALREADY_FOUND                   |       10528    |    key-chain item already   there                             |
|       UNKNOWN_OR_UNSUPPORTED_KEY_TYPE               |       10529    |    Unsupported key type                                       |
|       INVALID_KEYCHAIN_DATA_PROTECTION_LEVEL        |       10530    |    invalid key chain   protection level                       |
|       PBKDF2_KEY_GENERATION_ERROR                   |       10531    |    PBKDF2 key generation   error                              |
|       DELEGATE_NOT_SET                              |       10532    |    delegate missing   error                                   |
|       RESOURCE_FILE_PATH                            |       10533    |    file not found at   resource path error                    |
|       INVALID_APP_NAME                              |       10100    |    Invalid app name                                           |
|       LOGIN_URL_IS_INVALID                          |       10101    |    Invalid login URL                                          |
|       LOGOUT_URL_IS_INVALID                         |       10102    |    Invalid logout URL                                         |
|       INVALID_SESSION_TIMEOUT_TIME                  |       10103    |    Invalid session timeout time                               |
|       INVALID_IDLE_SESSION_TIMEOUT_TIME             |       10104    |    Invalid idle session timeout time                          |
|       INVALID_IDLE_SESSION_DELTA                    |       10105    |    Invalid idle session timeout delta                         |
|       INVALID_RETRY_COUNTS                          |       10106    |    Invalid retry counts                                       |
|       OAUTH_UNSUPPORTED_RESPONSE_TYPE               |       40001    |    Unsupported response                                       |
|       OAUTH_UNAUTHORIZED_CLIENT                     |       40002    |    Unauthorized client                                        |
|       OAUTH_INVALID_REQUEST                         |       40230    |    Invalid request                                            |
|       OAUTH_ACCESS_DENIED                           |       40231    |    Access denied                                              |
|       OAUTH_INVALID_SCOPE                           |       40232    |    Invalid scope                                              |
|       OAUTH_SERVER_ERROR                            |       40233    |    Internal server error                                      |
|       OAUTH_TEMPORARILY_UNAVAILABLE                 |       40234    |    Oauth temporarily not available                            |
|       OAUTH_OTHER_ERROR                             |       40235    |    Unknown error                                              |
|       OAUTH_BAD_REQUEST                             |       40236    |    Bad request                                                |
|       OAUTH_CLIENT_ASSERTION_REVOKED                |       40237    |    Client assertion                                           |
|       OAUTH_CLIENT_SECRET_INVALID                   |       40241    |    Client secret can not be null or empty for this grant type |
|       INVALID_REQUIRED_TOKENS                       |       10107    |    Invalid required tokens format                             |
|       INVALID_IDENTITY_DOMAIN                       |       10108    |    Invalid identity domain format                             |
|       INVALID_COLLECT_IDENTITY_DOMAIN_PARM          |       10109    |    Invalid collect identity domain format                     |
|       INVALID_REMEMBER_CREDENTIALS_ENABLED_PARM     |       10110    |    Invalid remember credentials enabled parm                  |
|       INVALID_REMEMBER_USERNAME_DEFAULT_PARM        |       10111    |    Invalid remember username default parm                     |
|       INVALID_AUTOLOGIN_PARM                        |       10112    |    Invalid autologin parm                                     |
|       INVALID_REMEMBER_CREDENTIALS_PARM             |       10113    |    Invalid remember credentails parm                          |
|       INVALID_REMEMBER_USERNAME_PARM                |       10114    |    Invalid remember username parm                             |
|       INVALID_AUTH_SERVER_TYPE                      |       10115    |    Invalid auth server type                                   |
|       INVALID_OFFLINE_AUTH_ALLOWED_PARM             |       10116    |    INVALID_OFFLINE_AUTH_ALLOWED_PARM                          |
|       INVALID_CONNECTIVITY_MODE_PARM                |       10117    |    Invalid connectivity   mode                                |
|       FEDAUTH_LOGIN_SUCCESS_URL_IS_INVALID          |       50001    |    Fedauth invalid login successes url                        |
|       FEDAUTH_LOGIN_FAILURE_URL_IS_INVALID          |       50002    |    Fedauth invalid login failure url                          |

All errors generated by platform APIs not handled internally will be propagated as is.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.
