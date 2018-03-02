# Use an External Customized Sign-in Page with Oracle Identity Cloud Service

By default, Oracle Identity Cloud Service comes with an embedded Sign In page that you can customize using the Branding feature (in the console, expand the Navigation Drawer , click Settings, and then click Branding).

If you need to personalize the look-and-feel of the Sign In page provided by Oracle Identity Cloud Service beyond what the Branding feature supports, you can create you own sign-in page deploy, it to an application server and configure Oracle Identity Cloud Service to use this external sign-in page.

You can configure custom login pages globally so that all applications using Oracle Identity Cloud Service use it, or individually for specific applications.

Oracle provides a sample sign-in application to be used in this tutorial. This sample application layout can be modified to meet customer requirements. The application acts as both the sign-in application and a trusted application (the application using Oracle Identity Cloud Service Single Sign-On) and  supports the following features:

- Sign In and Sign Out.
- Multi Factor Authentication.
- Show Access Token and Identity Token content details.
    
This Sample Code is used in the following tutorial: [Use an External Customized Sign-in Page with Oracle Identity Cloud Service](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:)

**Important:** The sample web application isn't meant to be published to production and isn't concerned about the language’s specific best practices, such as data handling, patterns, security, and so on. The sole purpose of the sample web application is to demonstrate how to use an external custom sign in page with Oracle Identity Cloud Service.

#### Requirements
- Access to an instance of Oracle Identity Cloud Service and rights to register trusted applications and configure settings.
- A Java SDK 8 compliant application server. This tutorial uses Oracle WebLogic Server 12c (12.2.1) and Java SDK 8.
- To download the Custom Sign-In page project from the Repository. Use a Git Client or download the repository content as zip file, and then decompress it.
- NetBeans 8.2 with Maven plugin installed.
- Your web browser must be set to allow third-party cookies, otherwise the sample application fails.

## Build and Deploy the Custom Sign-In Application:

The custom sign in application is built with Maven which automatically downloads the appropriate libraries and builds the war file. This tutorial uses NetBeans to run the Maven goals and build the war file.

1. Open the project using NetBeans, and build the application.
2. NetBeans generates the idcscustomlogin-1.0.war file in the target/ sub folder where the sign in application is.

**Note**: The Name of the file may vary.

**Note**: NetBeans needs to communicate with the internet to download the necessary libraries before generating the war file.

Use the local WebLogic Server instance to deploy and run the idcscustomlogin-1.0.war file.

1. Access your local WebLogic Server Console and log in as an administrator.
2. Deploy the application to the AdminServer.
3. Access the application using the following URL: http://localhost:7001/idcscustomlogin/

## Register an Trusted Application to Use with the Custom Sign-In Page

You need to register a trusted web application in Oracle Identity Cloud Service and configure the Login URL parameter. In this tutorial, you use the same idcscustomlogin-1.0.war as a trusted application with **Authorization Code** grant type.

1. Add a trusted application in Oracle Identity Cloud Service: 
        **Name**: My App
        **Description**: My App
        **Application URL**: http://localhost:7001/idcscustomlogin/
        **Login URL**: http://localhost:7001/idcscustomlogin/signin/
        **Logout Page URL**: http://localhost:7001/idcscustomlogin/logout
        **Allowed Grant Types**: Select **Authorization Code**.
        **Allow non-HTTPS URLs**: Select this check box so that the sample application works in non-HTTPS mode.
        **Redirect URL**: http://localhost:7001/idcscustomlogin/atreturn/
        **Logout URL**: http://localhost:7001/idcscustomlogin/logout/
        **Post Logout Redirect URL**: http://localhost:7001/idcscustomlogin/

    **Note**: Don't forget to add the / at the end of the above URLs.

2. Select **Grant the client access to Identity Cloud Service Admin APIs**, enter **Signin** in the box below, and then click Next.
    
3. Copy the application's **Client ID** and the **Client Secret** values, and then activate the application.

## Register the Custom Sign-In Application
You need to register the custom sign-in application as a **Client Credentials** application so that it can perform calls to the Oracle Identity Cloud Service REST API.

1. Add a trusted application in Oracle Identity Cloud Service: 
**Name**: My Sign In Application
**Description**: My Sign In Application
 **Allowed Grant Types**: Select **Client Credentials**.

2. Select **Grant the client access to Identity Cloud Service Admin APIs**, enter **Signin** in the box below, and then click Next.

3. Copy the application's **Client ID** and the **Client Secret** values, and then activate the application.

## Set Up the Custom Sign-In Application to Work with Oracle Identity Cloud Service

1. Open a new browser window and enter the following URL: http://localhost:7001/idcscustomlogin/config.jsp
2. In the Select / change currently active domain name section, type the name of your Oracle Identity Cloud Service domain, and then click Save.
3. Enter the following information, and then click Save at the bottom of the screen
**IDCS Url**: <Provide the URL of your Oracle Identity Cloud Service instance>
**Client ID**: <Provide the value of the Client ID of the Authorization Code Application>
**Client Secret**: <Provide the value of the Client Secret of the Authorization Code Application>
**App ID**: <Provide the value of the Client ID of the Client Credentials Application>
**App Secret**: <Provide the value of the Client Secret of the Client Credentials Application>

## Allow Cross-Origin Resource Sharing (CORS)

Enable CORS in Oracle Identity Cloud Service for the custom sign in application hosted in another domain (in this example localhost) to work.

1. Open the Session Settings page.
2. Enable **Allow Cross-Origin Resource Sharing (CORS)** by clicking the slider.
3. Enter localhost in **Allowed CORS Domain Names** and then click Save.

## Test the Custom Sign-In Page
1. Open a new browser window and enter the following URL: https://localhost:7001/idcscustomlogin/
2. Click Configuration and click the existing Domain name . After the configuration loads in the fields below, click Return home, at the bottom of the screen.
3. Click Login, and after the idcscustomlogin-1.0.war custom layout sign-in page appears, enter your Username and Password on the page, and then click SignIn.
4. If your name appears in the middle of the page, then you have successfully logged in to Oracle Identity Cloud Service without using the default sign-in page.

**Note**: You can click Access Token content to get more detailed information on the access token that was issued to you, and you can click Logout to see Oracle Identity Cloud Service log out.

**Note**: Every time time you re-start the WebLogic Server, before using the application you need to click Configuration and click the existing Domain name.

**Note**: The current implementation of custom login for Oracle Identity Cloud Service relies upon third-party cookies. If you click Submit and nothing happens check your browser to insure that they are enabled.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.