
# Oracle Identity Cloud Service's Mobile Software Development Kit (SDK) for iOS

Oracle Identity Cloud Service provides a Mobile Software Development Kit (SDK) that you can use to integrate iOS applications with Oracle Identity Cloud Service.

The **SDK for iOS Applications** is available as both framework or library file.Choose between one of the options and load it appropriately.

To help you understand how to use the SDK, this tutorial uses a sample iOS application as a reference. This sample application is based on swift and uses the framework version of the **SDK for iOS Applications**.

**Important**: Do not publish the sample mobile application to production. The sample mobile application does not adhere to the Android-specific best practices, such as data handling, patterns, security, and so on. The sole purpose of this sample application is to address the recommended approach to integrate Oracle Identity Cloud Service with a custom application by using the SDK.

### What Do You Need?

-   Familiarity with the iOS platform and Xcode to understand the code logic presented in this tutorial.
-   A MacOS based desktop and Xcode 9.2 or higher version installed.
-   The [iOS sample application](https://github.com/oracle/idm-samples/tree/master/idcs-sdk-sample-apps "Oracle's official repository for Identity Management (IDM) code samples and snippets") zip file downloaded and extracted to a folder on your local desktop.
-   Access to an instance of Oracle Identity Cloud Service, and privileges to download the SDK from the console and to register a confidential application.

## How to Use the Sample Application:

### Download the SDK
-   In the Identity Cloud Service console, expand the **Navigation Drawer** ![](./img/navdrawer.png), click **Settings,** and then click **Downloads.** The list of files to download appears.
-   Click **Download** for the SDK for iOS Applications, and save the zip file on your local desktop.
-   Open the **SDK for iOS Applications** zip file, and extract it to a temporary folder.

    **Note:** The **SDK for iOS Applications** zip file contains two versions of the SDK: The framework version (`oamms_sdk_for_ios_headless.zip`) and the library version (`oamms_sdk_for_ios_headless_library.zip`). This sample application use the framework version. You can choose to use the library version in your iOS application instead. Make sure to load it properly.

-   Open the **oamms_sdk_for_ios_headless.zip** file, locate the `IDMMobileSDKv2.framework` folder, and then extract this folder into the sample application main folder (`[SAMPLE_APP_FOLDER]\...`).

### Register a Mobile Application in Oracle Identity Cloud Service

1.  In the Identity Cloud Service console, expand the  **Navigation Drawer**  ![](./img/navdrawer.png), click  **Applications**.
2.  In the  **Applications**  page, click  **Add**.
3.  In the  **Add Application**  dialog box, click  **Mobile Application**.
4.  Enter the  **Details** as shown below, and then click  **Next**.
    -   **Name**:  `SDK Mobile Application`
    -   **Description**:  `SDK` `` `Mobile` Application``
5.  In the  **Client** screen, select  **Configure this application as a client now,**  and then select the field values as shown below:
    -   **Allowed Grant Types**: Select  **Authorization Code**, and deselect **Implicit**.
    -   **Allow non-HTTPS URLs**: Select this check box. The sample application works in non-HTTPS mode.
    -   **Redirect URL**:  `idcsmobileapp://nodata`
    -   **Post Logout Redirect URL**:  `idcsmobileapp://nodata`
6.  Scroll down to the bottom of the screen and click the  **Add** button below  **Grant the client access to Identity Cloud Service Admin APIs.**
7. In the **Add App Role** dialog window, select **Me** in the list, and then click **Add.**
8. In the  **Client**  screen, click  **Next**  until you reach the last screen. Then click  **Finish**.
9.  From the  **Application Added** dialog box, save  **Client ID**  value onto a notepad, and then click  **Close**.
10.  To activate the application, click  **Activate**.
11.  In the  **Activate Application?**  dialog box, click  **Activate Application**.
    The success message  **The** ****SDK** Web Application application has been activated.**  appears.
 12.  In the Identity Cloud Service console, click the user name at the top-right of the screen, and click  **Sign Out**.

### Update the Sample Mobile Application


1.  Open the `[SAMPLE_APP_FOLDER]/IDCSSample/ViewControllers/LoginViewController.swift` file in any text editor, update the following parameters, and save the file.

    * **OM_PROP_OPENID_CONNECT_CONFIGURATION_URL**: Enter the configuration URL of your Oracle Identity Cloud Service. Example:
https://MYTENANT.identity.oraclecloud.com/.well-known/idcs-configuration

    * **OM_PROP_OAUTH_CLIENT_ID**: Enter the **Client ID** of the application that you added in the previous section.

## Run the Sample Web Application

1. In the file manager, double-click the `IDCSSample.xcodeproj`, so that Xcode opens the sample application.
   **Note**: Make sure you have copied the SDK framework folder into the sample application folder.

2. In Xcode, make sure **iPhone 8 Plus (11.2)** is selected as simulator, and then click the Play button to build and run the sample application.

3. On the iOS virtual device home screen, click **My ID**, if the device doesn't launch the app automatically.

4. Wait to the Oracle Identity Cloud Service sign-in page to appear, enter a valid **User Name** and **Password**, and then click **Sign In.**

5. After Oracle Identity Cloud Service successfully authenticates the user, the sample iOS application presents the home page and the list of Oracle Identity Cloud Service Apps that the user is assigned to.

6. Optionally, click **My Groups** and the sample application displays the list of groups that the user is assigned to. **Note**: Make sure the user is assigned to applications and groups in Oracle Identity Cloud Service.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.
