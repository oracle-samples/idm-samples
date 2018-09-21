
# Oracle Identity Cloud Service's Mobile Software Development Kit (SDK) for Android

Oracle Identity Cloud Service provides a Mobile Software Development Kit (SDK) that you can use to integrate Android applications with Oracle Identity Cloud Service.

The Mobile Android SDK is available as a Android Archive Library (AAR) (`IDCS-SDK-for-Android.aar`) file, which must be loaded appropriately as a library in the Android application.

To help you understand how to use the SDK, this tutorial uses a sample mobile Android application as a reference.

**Important**: Do not publish the sample mobile application to production. The sample mobile application does not adhere to the Android-specific best practices, such as data handling, patterns, security, and so on. The sole purpose of this sample application is to address the recommended approach to integrate Oracle Identity Cloud Service with a custom application by using the SDK.

### What Do You Need?

- Familiarity with Java programming language to understand the code logic presented in this tutorial.
- [Android Studio](https://developer.android.com/studio/ "Android Studio")  installed, with API Level 24 and at least SDK Build-Tools 27.0.3.
- The  [Android sample mobile application](https://github.com/oracle/idm-samples/tree/master/idcs-sdk-sample-apps/android "Oracle's official repository for Identity Management (IDM) code samples and snippets")  zip file downloaded and extracted to a folder in your local desktop.
- Access to an instance of Oracle Identity Cloud Service, privileges to download the SDK from the console, and to register a confidential application.

## Dependent Third-party libraries

The sample application built with Gradle that automatically downloads the appropriate libraries and builds the war file. Below is the list of libraries the SDK needs:  
    1.  slf4j-api 1.7.25
    2.  nimbus-jose-jwt 4.26
    3.  json-smart 2.3
    4.  okhttp 3.8.0

## How to use the Sample Application:

### Download the SDK
1.  In the Identity Cloud Service console, expand the  **Navigation Drawer**, click  **Settings**, and then click  **Downloads**. The list of files to download appears.
2.  Click  **Download**  to download the  **SDK for Android Applications**  zip file.
3.  Open the  **SDK for Android Applications**  zip file, locate the  `IDCS-SDK-for-Android.aar`  file, and then extract this  file into the sample mobile application library folder (`[SAMPLE_APP_FOLDER]\app\libs`).

### Register the Mobile Application

1.  In the Identity Cloud Service console, expand the  **Navigation Drawer**, click  **Applications**.
2.  In the  **Applications**  page, click  **Add**.
3.  In the  **Add Application**  dialog box, click  **Mobile Application**.
4.  Enter the  **Details** as shown below, and then click  **Next**.
    -   **Name**:  `SDK Mobile Application`
    -   **Description**:  `SDK` `` `Mobile` Application``
5.  In the  **Client** screen, select  **Configure this application as a client now,**  and then select the field values as shown below:
    -   **Allowed Grant Types**: Select **Authorization Code** and then deselect **Implicit**.
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

1.  Start Android Studio. The  **Welcome to Android Studio**  dialog window appears.

**Note**: To ensure that your Android Studio installation has Android  **API Level**  24 installed, click  **Configure**, and then click  **SDK Manager**. The  **Default Settings**  window opens.The  **SDK Platforms**  tab lists the Android API Levels available for installation and the  **SDK Tools**  tab shows the version of the  **SDK Build-Tools**  installed.

2.  Click  **Open an existing Android Studio project**, select the sample application folder, and then click  **OK**.
3.  In  **Project**  pane, expand  **java**  >  **com.oracle.idm.mobile.idcssampleapp**  >  **wrapper**  and double-click the  `Const`class.
4. In the  `Const.java`  tab, update the following entries:
- **OPEN_ID_DISCOVERY_URL**: Update the value with the domain name of your Oracle Identity Cloud Service.
-   **OPEN_ID_CLIENT_ID**: Update the value of the  **Client ID**  of the application you added in the previous section.
-   **OAUTH_AUTHZ_CODE_RESOURCE_URL**: Update the value of the domain name of your Oracle Identity Cloud Service.
**Note**: Replace **MYTENANT** with the name of your Oracle Identity Cloud Service tenant
5. Select  **IDCSSampleApp**  application in  **Project**  pane, click  **Build**  in the top menu, and then click  **Rebuild Project**.
Android Studio starts to download all necessary components to build the application.

**Note**: If you're behind a proxy, then set up  **HTTP Proxy** in  **File** >  **Settings** menu.

## Run the Sample Web Application

1.  In Android Studio, click  **Run**  in the top menu, and then click  **Run 'app'**.
2.  In the  **Select Deployment Target**  window, select an available device to run the sample application.
**Note**: If you don't have any connected nor available devices, you can create on by clicking the  **Create New Virtual Device**  button. See  [Create and manage virtual devices](https://developer.android.com/studio/run/managing-avds).
3. In the Android virtual device home screen, click  **My ID**.
4. Oracle Identity Cloud Service Sign-in page appears.
5. Enter a valid  **User Name**  and  **Password**, and click  **Sign In**.
6.  After Oracle Identity Cloud Service successfully authenticates the user, the sample mobile application presents the home page and the list of Oracle Identity Cloud Service Apps the user is assigned to.
7. Optionally, click  **My Groups**  and the mobile application shows the list of groups the user is assigned to.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.
