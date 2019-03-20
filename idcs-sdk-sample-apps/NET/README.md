# Oracle Identity Cloud Service' SDK .NET Sample Application

Oracle Identity Cloud Service provides a Software Development Kit (SDK) that you can use to integrate ASP.NET web applications with Oracle Identity Cloud Service.

The .NET SDK is available as a dynamic link library (dll) file, called IdcsClient.dll, and other complimentary dll files in IdcsClient/bin/Release/ folder, which must all be included in your .NET web application library.

This Sample Code is used in the following tutorial: [Use Oracle Identity Cloud Service's SDK for Authentication in .NET Web Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:23065)

**Important:** The sample web application isn't meant to be published to production and isn't concerned about the language’s specific best practices, such as data handling, patterns, security, and so on. The sole purpose of the sample web application is to address the recommended approach to integrate Oracle Identity Cloud Service and a custom application using the SDK.

**Note:** The sample application is built with Maven which automatically downloads the appropriate libraries and builds the war file.

**Note:** Before deploying or using this sample application, it need to be updated following the instruction below:

## How to use the Sample Application:

The sample web application needs an application's Client ID and Secret to establish communication with Oracle Identity Cloud Service.  Follow the referenced tutorial to register an application.

Access the Oracle Identity Cloud Service console and download the SDK for NET. Inside the downloaded zip file there is a folder called **IdcsClient**. Extract the contents of the SDK zip file into the sample web application package folder (`<sampleapp_source_folder>\SampleApp\packages\`).

Access the Oracle Identity Cloud Service console, and add a trusted application with the following information:
- Populate the Details pane as follows, and then click Next.
    Name: SDK Web Application
    Description: SDK Web Application

- In the Client pane, select Configure this application as a client now, and then populate the fields of this pane, as follows:
    Allowed Grant Types: Select **Client Credentials** and **Authorization Code**.
    Allow non-HTTPS URLs: Select this check box. The sample application works in non-HTTPS mode.
    Redirect URL: http://localhost:3001/Home/Callback
    Post Logout Redirect URL: http://localhost:3001

- In the Client pane, scroll down, select Grant the client access to Identity Cloud Service Admin APIs., enter **Me** and **Authenticator Client**.
- Finish, make a note of the **Client ID** and **Client Secret** values, and activate the application.

Edit the **ConnectionOptions.cs** file and update the ClientId, ClientSecret, BaseUrl, and AudienceServiceUrl variables with the correct values for your Oracle Identity Cloud Service environment.
```java
public Dictionary<string, string> GetOptions()
        {
            this.options = new System.Collections.Generic.Dictionary<String, String>
            {
                { "ClientId", "123456789abcdefghij" },
                { "ClientSecret", "abcde-12345-zyxvu-98765-qwerty" },
                { "BaseUrl", "https://idcs-abcd1234.identity.oraclecloud.com" },
                { "AudienceServiceUrl", "https://idcs-abcd1234.identity.oraclecloud.com" },
                { "TokenIssuer", "https://identity.oraclecloud.com/" },
                { "scope", "urn:opc:idm:t.user.me openid" },
                { "redirectURL", "http://localhost:3001/Home/Callback" },
                { "logoutSufix", "/oauth2/v1/userlogout"},
                { "LogLevel", "0" },
                { "ConsoleLog", "True" }
            };
            return this.options;
        }
```

Below is a brief explanation  for each of the required attributes for the SDK:
- **ClientId**: Client ID value generated after you register the web application in Oracle Identity Cloud Service console.
- **ClientSecret**: Client Secret value generated after you register the web application in Oracle Identity Cloud Service console.
- **BaseUrl**: The full qualified domain name URL of your Oracle Identity Cloud Service instance.
- **AudienceServiceUrl**: The full qualified domain name URL of your Oracle Identity Cloud Service instance.
- **TokenIssuer**: Oracle recomends to keep the value as presented here.
- **scope**: Scope contols what data the application can access/process on behalf of the user. Since the application uses the SDK for authentication purpose the scope is openid. The application also implements the get user's details use case. In this case you need to also use the scope urn:opc:idm:t.user.me.

The **redirectURL** and **logoutSufix** are both used by the application, hence they are not required by the SDK.

The **HomeController** class maps the public URLs of the application. In the **Oracle()** method, it uses the SDK to generate the authorization code URL, and redirects the browser to the generated URL.
Four important parameters are used to generate the authorization code URL:
- **redirectUrl**: After successfull sign in, Oracle Identity Cloud Service redirects the user browser to this URL. This URL must match the one configured in the trusted application in Oracle Identity Cloud Service console.
- **scope**: The OAuth/OpenID Connect scope of authentication. This application requires only openid authentication to be handled by Oracle Identity Cloud Service.
- **state**: The state value is meant to be a code that the sample web application might use to check if the communication was made correctly to Oracle Identity Cloud Service. The state parameter is defined by the OAuth protocol.
- **response_type**: The value **code** is required by the authorization code grant type.

Tthe **Callback** method maps to the **/Home/Callback** URL, and uses the authorization code parameter to request an access token and an id token. These tokens are then stored in the user session. Then, the method forwards the request to the **Private** controller,  **Home()** method, which maps to the **/Private/Home** URL.

In the **Private** controller, the **MyProfile()** method accesses the user's IdToken object previously set in the session, and retrieve the user's information to print to the screen.

n the **Private** controller, the **Logout()** method invalidates the user session and then redirects the user to Oracle Identity Cloud Service's log out URL.

## Run the Sample Web Application

- Run the Visual Studio 2017 IDE. Click **File**, click **Open**, and then click **Project/Solution**.
- Navigate to the  `<sampleapp_source_folder>\SampleApp`  folder, and open the  `SampleApp.sln`  file.
- In the right side of the Visual Studio 2017, in the **Solution Explorer**, right click the **References** folder, and click **Manage NuGet Packages**.
- In  **NuGet:SampleApp**  tab, click  **Restore**  at the top right to restore the packages the sample application need, and then close the tab.
- Click **Build**, and then click **Build Solution**.
- To run the application, press the **CTRL** + **F5** keys, and a new browser window automatically opens the `http://localhost:3001` URL.
- In the browser window that opened, click  **Log In**.
- In the **Login** page, click the **Oracle** red icon.
- In the Oracle Identity Cloud Service **Sign In** page, sign in using your Oracle Identity Cloud Service credentials.
  After you sign in to Oracle Identity Cloud Service successfully, the browser is redirected to the  **/Private/Home**  page. The name of the logged-in user appears at the top-right side of the page.

## License

Copyright (c) 2019, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.