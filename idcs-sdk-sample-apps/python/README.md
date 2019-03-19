
# Oracle Identity Cloud Service' SDK Python Sample Application

Oracle Identity Cloud Service provides a Software Development Kit (SDK) that you can use to integrate Python web applications with Oracle Identity Cloud Service.

The Python SDK is available as two python files **IdcsClient.py** and **Constants.py**, which must be included in the web application.

This Sample Code is used in the following tutorial: [Use Oracle Identity Cloud Service's SDK for Authentication in Python Web Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:22662)

**Important:** The sample web application isn't meant to be published to production and isn't concerned about the language’s specific best practices, such as data handling, patterns, security, and so on. The sole purpose of the sample web application is to address the recommended approach to integrate Oracle Identity Cloud Service and a custom application using the SDK.

## How to use the Sample Application:

The sample web application needs an application's Client ID and Secret to establish communication with Oracle Identity Cloud Service.  Follow the referenced tutorial to register an application.

Access the Oracle Identity Cloud Service console, and add a Confidential Application with the following information:
- Populate the Details pane as follows, and then click Next.
    Name: SDK Web Application
    Description: SDK Web Application

- In the Client pane, select Configure this application as a client now, and then populate the fields of this pane, as follows:
    Allowed Grant Types: Select **Client Credentials** and **Authorization Code**.
    Allow non-HTTPS URLs: Select this check box. The sample application works in non-HTTPS mode.
    Redirect URL: http://localhost:8000/callback
    Post Logout Redirect URL: http://localhost:8000

- In the Client pane, scroll down, select Grant the client access to Identity Cloud Service Admin APIs., enter **Me** and **Authenticator Client**.  
- Finish, make a note of the **Client ID** and **Client Secret** values, and activate the application.

Access the Oracle Identity Cloud Service console, download the SDK for Python, open the downloaded zip file, and extract the python files to your web application source folder.

Edit the **config.json** file, update the ClientId, ClientSecret, BaseUrl and AudienceServiceUrl variables with the correct values for your Oracle Identity Cloud Service environment, and then save the file.
```json
{
  "ClientId" : "123456789abcdefghij",
  "ClientSecret" : "abcde-12345-zyxvu-98765-qwerty",
  "BaseUrl" : "https://idcs-abcd1234.identity.oraclecloud.com",
  "AudienceServiceUrl" : "https://idcs-abcd1234.identity.oraclecloud.com",
  "scope" : "urn:opc:idm:t.user.me openid",
  "TokenIssuer" : "https://identity.oraclecloud.com/",
  "redirectURL": "http://localhost:8000/callback",
  "logoutSufix":"/oauth2/v1/userlogout",
  "LogLevel":"DEBUG",
  "ConsoleLog":"True"
}
```

Below is a brief explanation  for each of the required attributes for the SDK:
- **ClientId**: Client ID value generated after you register the web application in Oracle Identity Cloud Service console.
- **ClientSecret**: Client Secret value generated after you register the web application in Oracle Identity Cloud Service console.
- **BaseUrl**: The full qualified domain name URL of your Oracle Identity Cloud Service instance. 
- **AudienceServiceUrl**: The full qualified domain name URL of your Oracle Identity Cloud Service instance.
- **scope**: Scope contols what data the application can access/process on behalf of the user. Since the application uses the SDK for authentication purpose the scope is openid. The application also implements the get user's details use case. In this case you need to also use the scope urn:opc:idm:t.user.me.
- **TokenIssuer**: Oracle recomends to keep the value as presented here.

The **logoutSufix** and **redirectURL** are both used by the application, hence they are not required by the SDK.

The **auth** function definition uses the IDCS' SDK to generate the authorization code URL, and  redirects the browser to the generated URL.
Four important parameters are used to generate the authorization code URL:
- **redirectUrl**: After successfull sign in, Oracle Identity Cloud Service redirects the user browser to this URL. This URL must match the one configured in the trusted application in Oracle Identity Cloud Service console.
- **scope**: The OAuth/OpenID Connect scope of authentication. This application requires openid authentication to be handled by Oracle Identity Cloud Service.
- **state**: The state value is meant to be a code that the sample web application might use to check if the communication was made correctly to Oracle Identity Cloud Service. The state parameter is defined by the OAuth protocol.
- **response_type**: The value **code** is required by the authorization code grant type.

The **callback** function definition uses the authorization code parameter to request an access token and an identity token. The tokens are stored as session attributes, and the code fowards control to the home page.

The **/home** and the **/myProfile** URLs are protected resources. 

The **/myProfile** function definition accesses the identity token stored in the session, calls the **AuthenticationManager.verifyIdToken()** and **id_token_verified.getIdToken()** SDK's functions to get the JSON object, which represents the user profile, and forwards control to  the **sampleapp/myProfile.html** file to be rendered in the browser.

The **logout** function definition remove all tributes previously added to the user session and then redirects the user to Oracle Identity Cloud Service's log out URL.

## Run the Sample Web Application

- Open a command prompt, navigate to the sample web application source code's `<sample_app_sourcecode>\` folder, and enter `pip install Django`.
- Open the SDK zip file, extract both `README.txt` and `requirements.txt` to a temporary folder, and run the following command line to install the required third-party libraries
	```
	pip install -r requirements.txt
	```
- Extract the files under the `src` folder into the sample web application source code's `<sample_app_sourcecode>\sampleapp\` folder. 
- In the command prompt, navigate to the sample web application source code's folder, and enter `python.exe manage.py migrate` and then `python manage.py runserver`to start the sample application. 
- Open a browser window, access the http://localhost:8000 URL, click **Log in**, and then click the Oracle red icon.
- The Oracle Identity Cloud Service Sign In page appears.
- Sign in to Oracle Identity Cloud Service, and after the home page appear, click **My Profile** in the left menu.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.