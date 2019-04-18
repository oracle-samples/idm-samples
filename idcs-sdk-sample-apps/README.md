# Oracle Identity Cloud Service's Software Development Kit (SDK)

## Overview

Use software development kits (SDKs) when developing applications, allowing them to connect to Oracle Identity Cloud Service to authenticate and get an access token to identify registered users in Oracle Identity Cloud Service.

![Overview Diagram](images/SDK_Header.png)

The SDK wraps some Oracle Identity Cloud Service calls that are made by the applications, simplifying the development.

The SDKs can be downloaded from the **Downloads** page of the Identity Cloud Service console, as zip files, for the following languages:
- **Java**: The file you download contains a *jar* library file.

## Tutorials and Sample Applications

To understand how to use the SDKs, Oracle provides sample web applications for each of the supported languages listed above. Use these sample applications for learning purposes.

Learn how to configure SSO between Oracle Identity Cloud Service and the sample applications by using one of the following tutorials:

- [Use Oracle Identity Cloud Service's Software Development Kit (SDK) for Authentication in Java Web Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:22663)
- [Use Oracle Identity Cloud Service's Software Development Kit (SDK) for Authentication in Node.js Web Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:24165)
- [Use Oracle Identity Cloud Service's Software Development Kit (SDK) for Authentication in Python Web Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:24164)
- [Use Oracle Identity Cloud Service's Software Development Kit (SDK) for Authentication in .NET Web Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:23065)
- [Use Oracle Identity Cloud Service's Software Development Kit (SDK) for Authentication in Android Mobile Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:24247)
- [Use Oracle Identity Cloud Service's Software Development Kit (SDK) for Authentication in iOS Mobile Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:24248)

The sample applications implement two use cases: one for user authentication and the other for  accessing detailed information from the logged-in user.

#### Use Case #1: User Authentication

This graphical overview explains the flow of events, calls, and responses between the web browser, the web application, and Oracle Identity Cloud Service for authenticating users.

![Authentication Sequence Diagram](images/SDK_SequenceDiagramAuthN.png)

**Detailed flow:**
1. The user requests an authenticated resource.
2. The authentication module generates a request-authorization-code URL for Oracle Identity Cloud Service and sends a redirect response to the web browser.
3. The web browser calls the URL.
4. The Oracle Identity Cloud Service Sign In page appears.
5. The user submits their Oracle Identity Cloud Service login credentials.
6. Oracle Identity Cloud Service issues an authorization code.
7. The web application calls Oracle Identity Cloud Service to exchange the authorization code for a user access token.
8. Oracle Identity Cloud Service issues the access token.
9. A session is established, and the user is redirected to the Home page.
10. The Home page of the web application appears.


#### Use Case #2: Get User Details

The image illustrates the get user details flow between the user’s web browser, the sample application, and Oracle Identity Cloud Service when using the user authentication SDKs.


![Get User Details Sequence Diagram](images/SDK_SequenceDiagramGetDetails.png)

**Detailed flow:**
1. The user requests the /myProfile resource.
2. The web application calls Oracle Identity Cloud Service using the SDK, which uses the access token stored in the user session as a parameter.
3. The user's details are sent to the web application as a JSON object.
4. The My Profile page renders the JSON object as HTML content.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.
