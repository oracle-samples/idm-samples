# Oracle Identity Cloud Service REST Client Samples

This code contains a collection of sample REST API requests that can be used with clients such as [Postman](http://getpostman.com) to make test calls to Oracle Identity Cloud Service. 

This application is provided “AS IS” with no express or implied warranty for accuracy or accessibility. The sample code is intended for study purposes and doesn't represent the recommended approach or is intended to be used in development or productions environments.

## Requirements

- Postman native app installed for Windows, Mac, or Linux [Postman Native App Download](https://www.getpostman.com/apps).
    **Note**: Currently, you can still use the Chrome Web Browser with [Postman Extension](https://chrome.google.com/webstore/detail/postman-rest-client-packa/fhbjgbiflinjbdggehcddcbncdddomop), but Google plans to end support for Chrome apps for Windows, Mac, and Linux users in 2017. These steps are written from the perspective of the Postman native app.
- Register and activate a client application in Identity Cloud Service with the following characteristics, and then copy the application `client id` and `client secret`:

---
- **Application Type**: Trusted
- **Name**: REST Test
- **Description**: This client will be used to test REST API calls
- **Authorization**: Select *Configure this application as client now*
- **Allowed Grant Types**: Select *Resource Owner* and *Client Credentials*
- **Grant the client access to Identity Cloud Service Admin APIs**: Select, and then in the box that appears, select **Identity Domain Administrator**
---

## Set Up
1. Open your Postman native app.
2. Click **Import**. The Import window appears.
3. Click **Import from Link**, paste the Identity Cloud Service [environment template](idcs_postman_environment.json) url, and then paste the Identity Cloud Service [global variables](idcs_postman_globals.json) url.
5. Click **Settings** (gear icon), and then select **Manage environments**.
6. Click the **Duplicate environment** next to **EXAMPLE_IDCS**.
7. Click **EXAMPLE_IDCS copy**.
8. Update the environment variables, and then click **Update**:

 - `HOST`: The Identity Cloud Service UI address. For example: *https://**example**.identity.oraclecorp.com*
 - `CLIENT_ID` and `CLIENT_SECRET`: The client id and secret obtained from your Identity Cloud Service application.
 - `USER_LOGIN` and `USER_PW`: The user login and password (in case you want to use *password_grant* or *authorization_code*).

9. Click the **Environment combo box** (top-right corner), and then select `your environment`.

## Get Collections
After setting up Postman and obtaining an access_token, you can leverage our sample collections.
1. In Postman, click **Import**.
2. Select the **From URL** tab, and then import the following URLs:

- [User](idcs_user_postman_collection.json)
- [Group](idcs_group_postman_collection.json)
- [Applications](idcs_app_postman_collection.json)
- [Bulk](idcs_bulk_postman_collection.json)
- [Report](idcs_report_postman_collection.json)
- [Self](idcs_self_postman_collection.json)
- [OAuth](idcs_oauth_postman_collection.json)

## Make Requests
Each Identity Cloud Service collection contains REST API calls with request **uris**, **headers**, and **body** parameters. To perform your calls, you need to modify these parameters according to your preferences.

For a general example on how to take advantage of the sample requests, see the [Testing Oracle Identity Cloud Service REST APIs with Postman](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13484) tutorial. For high-level instructions on how to use each collection, see the associated readme file.

- [User](idcs_user_postman_collection.md)
- [Group](idcs_group_postman_collection.md)
- [Applications](idcs_app_postman_collection.md)
- [Bulk](idcs_bulk_postman_collection.md)
- [Report](idcs_report_postman_collection.md)
- [Self](idcs_self_postman_collection.md)
- [OAuth](idcs_oauth_postman_collection.md)

## License

Copyright (c) 2016, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the
Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at
https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and
limitations under the License.
