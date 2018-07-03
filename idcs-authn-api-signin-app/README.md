# Customize Oracle Identity Cloud Service's Sign-In Page Using the Authentication API

If you need to personalize the look-and-feel of the **Sign-In** page provided by Oracle Identity Cloud Service beyond what the **Branding** feature supports, Oracle Identity Cloud Service provides an Authentication API that enables you to develop your own customized sign-in page.

This tutorial uses a sample sign-in application as a reference to understand how to use the Authentication API. This sample sign-in application is a single-page application, which consists mainly of a JavaScript file that wraps the necessary calls to the Authentication API endpoints. You can use this application to customize your Oracle Identity Cloud Service sign-in experience.

The application implements the following Oracle Identity Cloud Service use cases:

1.  Basic User Name and Password Authentication
2.  Muti-Factor Authentication Enrollment
3.  2nd-Factor Authentication
	- Security Question
	- OTP via Email
	- OTP via SMS
	- TOTP
	- Push Notification
4.  Social Log In
5.  Self Registration
6. I Forgot My Password

The sample sign-in application is localized to support multiple languages such as:

- English
- Brazilian Portuguese
- Spanish
- German
- Italian
- Danish
- Hindi
- Norwegian

## What Do You Need?
To accomplish the tasks described in this tutorial, make sure that you have the following:
- Access to an instance of Oracle Identity Cloud Service and rights to register applications.
- A basic knowledge of Node.js framework and the JavaScript programming language to understand the sample sign-in application code logic.
- The [Current Node.js binaries](https://nodejs.org/) installed on your desktop.
- Download or git clone the is `idcs-authn-api-signin-app` to a temporary folder on your computer.

**Note**: For cloud customers to access the Oracle Identity Cloud Service console, click the **Users** link from the top menu of the Oracle Cloud My Services dashboard, and then click **Identity Console**. You must have a Oracle Cloud Account with Identity Cloud Service.

## Register a Client Credentials Application
Register a client credentials application in Oracle Identity Cloud Service so that the custom sign-in application can perform calls to the Oracle Identity Cloud Service's Authentication REST API.

1. In the Identity Cloud Service console, register a new **Trusted Application.**
2. Populate the **Details** pane as follows, and then click **Next.**
	**Name:** `My Sign-In Application`
	**Description:** `My Sign-In Application`
3. On the **Client** page, select **Configure this application as a client now,** and then select **Client Credentials** as the **Allowed Grant Types.**
4. In the **Client** pane, scroll down, click the **Add** button below **Grant the client access to Identity Cloud Service Admin APIs.**
5. In the **Client** pane, scroll down, select **Grant the client access to Identity Cloud Service Admin APIs.**, enter `Signin`, `Verify Email`, `Reset Password`, `Forgot Password`, `Self Registration` in the field below, and then click **Next.**
6. On the following pages, click **Next** until you reach the last page, and then click **Finish.**
7. In the **Application Added** dialog box, make note of the **Client ID** and the **Client Secret** values, and then click **Close.**
8. Activate the application, click **Activate**.


## Configure an Application to Use the Custom Sign-In Page
You can configure one of your existing applications to use the custom sign-in page instead of Oracle Identity Cloud Service default sign-in page.

1. In the Identity Cloud Service console, expand the **Navigation Drawer,** ![](./img/navdrawer.png) and then click **Applications.**
2. Click on your application to access the **Details** tab, then update the **Custom Login URL** field with the following value: `http://localhost:3000`
3. In the **Details** tab, also update the **Custom Error URL** field with the following value: `http://localhost:3000/ui/v1/error`
    
    **Note**: The Social Log In flow relies on the **Custom Error URL** field as a callback URL. Configure this value if you use the **Social Log In** use case.
    
4. Click **Save.**
5. Your application is now ready to use the custom sign-in application.

**Note**: This tutorial uses `localhost:3000` to host the sample custom sign-in application. If you deploy this application to another location, update the **Custom Login URL** and the **Custom Error URL** fields with the corresponding URL for the sign-in sample application.

**Note**: Oracle recommends you to use a secure communication protocol (HTTPS) for the custom sign-in application

If you don't have an application previously registered in Oracle Identity Cloud Service, use the following steps to register the Oracle Identity Cloud Service **My Apps** page for testing purpose.

1. In the Identity Cloud Service console, register a new **Trusted Application.**
2. Enter the following information in the **Details** pane, and then click **Next**.
	**Name:** `My App`
	**Description:** `My App`
	**Custom Login URL:** `http://localhost:3000`
	**Custom Error URL:** `http://localhost:3000/ui/v1/error`
3. In the **Client** pane, select **Configure this application as a client now,** and then enter the following information:
	**Allowed Grant Types:** Select **Authorization Code.**
	**Allow non-HTTPS URLs:** Select this check box so that the sample application works in non-HTTPS mode.
	**Redirect URL:** `/ui/v1/myconsole`
4. Click **Next** in the Client pane and in the following panes until you reach the last pane. Then click **Finish**.
5. In the **Application Added** dialog box, make note of the **Client ID** and the **Client Secret** values, and then click **Close**.
6. Activate the application, click **Activate**.

## Configure Cross-Origin Resource Sharing (CORS)
Configure the Cross-Origin Resource Sharing (CORS) feature because the sample web application and Oracle Identity Cloud Service are in different domains. CORS allows the sample sign-in application to make REST calls to Oracle Identity Cloud Service using the user browser.
1. In the Identity Cloud Service console, expand the **Navigation Drawer**, click **Settings,** and then click **Session Settings**.
2. On the **Session Settings** page, select **Allow Cross-Origin Resource Sharing (CORS)**, add the value `localhost:3000` to the **Allowed CORS Domain Names**, and then click **Save**.

## Set Up the Custom Sign-In Application to Work with Oracle Identity Cloud Service

Configure and run the sample web application. Replace the following parameter values with the corresponding values for your environment.

1. Edit the run script file that is present in the root folder of the sample sign-in application, update the IDCS_URL, IDCS_CLIENT_ID, and IDCS_CLIENT_SECRET values, and then save the file.
    ```
    set IDCS_URL=https://MYTENNANT.identity.oraclecloud.com
    set IDCS_CLIENT_ID=mysigninapp_client_id
    set IDCS_CLIENT_SECRET=mysigninapp_client_secret
    ```
	**Note:** If you are running this application in a Linux or Mac environment, use `run.sh` script. If you are using Windows use `run.bat` instead.
    
2. Open a command prompt or terminal, navigate to the root folder of the sample sign-in application, and then enter `npm install` to install all of the necessary modules, which are specified in the `package.json` file.
    
    **Note:** If you're behind a proxy, then set up the npm's proxy before running the `npm install` command.
    
3. In the same command prompt or terminal window, execute the run script by typing the name of the file, and then press **Enter** to start the sample sign-in application. 

In the command prompt or terminal window, you see log information that helps you to understand what the sample application is doing.

## Test the Customized Sign-In Page

In the previous sections you configured one of your applications to use the custom sign-in page. To test the custom sign-in page, access a resource of your application that is protected by Oracle Identity Cloud Service using a fresh new browser session. This tutorial uses your Oracle Identity Cloud Service **My Apps** page (`/ui/v1/myconsole`) for the purpose of this testing.

1. Open a browser window and access the following URL to request an authorization code for the My App application:
    ```
    https://idcs-abcd1234.identity.oraclecloud.com/oauth2/v1/authorize?client_id=myapp_client_id&response_type=code&redirect_uri=%2Fui%2Fv1%2Fmyconsole&scope=openid&state=1234
    ```
	**Note**: You need to update the 'idcs-abcd1234.identity.oraclecloud.com' and 'myapp_client_id' values in this URL with the corresponding ones for your environment.
	
    The browser is redirected to the  `http://localhost:3000/signin.html`  URL and the custom sign-in application appears.
    
2. Enter a valid Oracle Identity Cloud Service user's credentials in the  **USERNAME**  and  **PASSWORD**  fields, and then click  **SIGN IN.**

After Oracle Identity Cloud Service validates the user credentials, the web browser is redirected to the URL passed as a parameter in `redirect_uri.` In this example, your Oracle Identity Cloud Service **My Apps** page (`/ui/v1/myconsole`).


## Understand the REST API calls

As seen in the example above, your application needs to be configured to use the  **Custom Login URL.**

The demonstration presented in the previous section is a typical OpenID Connect flow: Before presenting content of any protected resource, your application needs to query Oracle Identity Cloud Service for an authorization code.

Oracle Identity Cloud Service receives the request for an authorization code, and instead of presenting its default sign-in page, Oracle Identity Cloud Service responds to the user browser with a POST request to the configured  **Custom Login URL.**  The sample sign-in application receives the POST and then it starts a sequence of Authentication API calls.

The sample sign-in application works independently from the integration method used between your application and Oracle Identity Cloud Service (SAML Federation, OpenID Connect, or OAuth).

### The Authentication Flow

The following sequence diagram explains the authentication flow between the custom sign-in application and Oracle Identity Cloud Service using the Authentication API endpoints.

![Overview Diagram](http://www.oracle.com/webfolder/technetwork/tutorials/obe/cloud/idcs/idcs_authn_api_obe/img/AuthNAPIflow.png)

When you start the sample sign-in application, it calls Oracle Identity Cloud Service to request an access token. The sample sign-in application stores the access token, so that the token can be used as a bearer authorization header during the subsequent Authentication API calls.

The basic username/password Authentication API log in flow consists of the following REST calls:
1. Instead of presenting the default sign-in page, Oracle Identity Cloud Service responds to the authorization code URL request with an HTML code that contains hidden HTML form with two parameters:  **signature**  and  **loginCtx.**
2. The browser receives the HTML code, which contains JavaScript to automatically submits the form to the sample sign-in application.
3. The sample sign-in application decrypts the  **loginCtx**  parameter. This parameter contains some important attributes:  
	- **requestState:**  Defines the state of the authentication process. It needs to be used in future POSTs and GETs to Oracle Identity Cloud Service's Authentication API endpoints.
	- **nextOp:**  Defines the next operation the custom sign-in application must perform.
	- **nextAuthFactors:**  Lists the possible authentication factors the sign-in page must present.
   
	The values of these attributes decides which authentication factor, identity providers, and social providers must be presented on the page.
    
4. The browser displays the sign-in page and presents the authentication factors. The sign-in page includes JavaScript code that is used to perform AJAX calls to Oracle Identity Cloud Service.
5. After the user enters the  **USERNAME**  and  **PASSWORD,**  and clicks  **SIGN IN,**  the browser sends a POST request to the  `/sso/v1/sdk/authenticate`  endpoint with the following payload:
    
    -   **requestState**: The value received in a previous response.
    -   **op**: The operation being executed. In this example,  `credSubmit`.
    -   **authFactor**: The authentication factor being used. In this example,  `USERNAME_PASSWORD`.
    -   The user credentials. In this example, as value for the  `username`  and  `password`  parameters.
    
    The access token that was retrieved at the application's startup is sent as a Bearer Authorization header.
    
    **Note**: Before posting the data to Oracle Identity Cloud Service via AJAX, the browser sends an OPTIONS request to the  `/sso/v1/sdk/authenticate`  endpoint to verify if the browser is authorized to post data to Oracle Identity Cloud Service.
6. The application receives a status code of 200 and an  **authnToken** from the previous post.
7. The application then sends a POST request to the  `/sso/v1/sdk/session`  endpoint to create the user session in Oracle Identity Cloud Service.
8. The application receives a 302 or 303 status code and a  `Location`  response header that contains the callback URL with a valid authorization code.
9. The browser then redirects to the specified location, so that the application can finish its authentication process with Oracle Identity Cloud Service.  
By this time, the OpenID Connect flow is finished, and the application can exchange the authorization code for an ID token.

To learn more about the Authentication API, visit the  [Postman Collection repository](https://github.com/oracle/idm-samples/tree/master/idcs-authn-api-rest-clients "Authentication API REST Clients").

## Credit

This sample sign-in application was developed by Oracle's A-Team.

The A-Team is a central, outbound, highly technical team comprised of Enterprise Architects, Solution Specialists and Software Engineers within the Oracle Product Development Organization. The team works closely with customers and partners, world wide, providing guidance on architecture, best practices, troubleshooting and how best to use Oracle Cloud Services and products to solve customer business needs.

The A-Team provides this type of support by working with Oracle Consulting, Support and Sales – engaging in the toughest of situations, solving the hardest problems and the greatest of challenges.

The A-Team is lead from Oracle Headquarters in Redwood Shores, CA, but A-Team members are located and positioned globally, so that we are better prepared to respond quickly, and within an appropriate timezone for our Global customers.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.
