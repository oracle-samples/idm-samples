# Oracle Identity Cloud Service REST Client Samples

This code contains a collection of sample REST API requests that can be used with clients such as [Postman](http://getpostman.com) to make test calls to Oracle Identity Cloud Service. 

This application is provided “AS IS” with no express or implied warranty for accuracy or accessibility. The sample code is intended for study purposes, doesn't represent the recommended approach, and isn't intended to be used in development or production environments.

The [Using the Oracle Identity Cloud Service REST APIs with Postman](https://apexapps.oracle.com/pls/apex/f?p=44785:112:13055075037206::::P112_CONTENT_ID,P112_PREV_PAGE:13484) tutorial is available to use with this REST API collection. 

## Requirements

- The Postman native app installed for Windows, Mac, or Linux [Postman Native App Download](https://www.getpostman.com/apps).
    **Note**: Currently, you can still use the Chrome Web Browser with [Postman Extension](https://chrome.google.com/webstore/detail/postman-rest-client-packa/fhbjgbiflinjbdggehcddcbncdddomop), but Google plans to end support for Chrome apps for Windows, Mac, and Linux users in late 2017. These steps are written from the perspective of the Postman native app.
- Register and activate a client application in Oracle Identity Cloud Service with the following characteristics, and then copy the application `client id` and `client secret`:

---
- **Application Type**: Trusted
- **Name**: REST Test
- **Description**: This client is used to test REST API calls
- **Authorization**: Select **Configure this application as client now**
- **Allowed Grant Types**: Select **Client Credentials**
- **Grant the client access to Oracle Identity Cloud Service Admin APIs**: Select this check box, and then in the box that appears, select **Identity Domain Administrator**
---

## Set Up
1. Open the Postman native app, and then click **Import.** The Import window appears.
2. Click **Import from Link**, paste the URL to the Oracle Identity Cloud Service example environment: `https://github.com/oracle/idm-samples/raw/master/idcs-rest-clients/example_environment.json`, and then click **Import**.
3. Click **Import,** **Import from Link,** paste the URL to the global variables file: `https://github.com/oracle/idm-samples/raw/master/idcs-rest-clients/oracle_identity_cloud_service_postman_globals.json`, and then click **Import.**
4. Click **Environment options** (gear icon), and then select **Manage Environments**.
5. Click the **Duplicate Environment** icon next to the **example.identity.oraclecloud.com** environment, and then click the **example.identity.oraclecloud.com copy** that appears.
6. Update the environment variables, and then click **Update:**

 - `HOST`: The Oracle Identity Cloud Service UI address, for example: **https://**example**.identity.oracle.com**
 - `CLIENT_ID` and `CLIENT_SECRET`: The client id and client secret that you obtained from your Oracle Identity Cloud Service application
 - `USER_LOGIN` and `USER_PW`: The user login and password

7. Click the **Environment** drop-down list in the upper-right corner, and then select **your environment.**

## Get Collections
After setting up Postman and obtaining an access_token, you can leverage our sample collection.

**Note:** See the OBE [Using the Oracle Identity Cloud Service REST APIs with Postman](https://apexapps.oracle.com/pls/apex/f?p=44785:112:13055075037206::::P112_CONTENT_ID,P112_PREV_PAGE:13484) for the steps on how to obtain the access token.

1. In Postman, click **Import,** and then click **Import from Link.**
2. Paste the following URL:

`https://github.com/oracle/idm-samples/raw/master/idcs-rest-clients/REST_API_for_Oracle_Identity_Cloud_Service.postman_collection.json`

## Make Requests
The Oracle Identity Cloud Service collection contains REST API calls with request **uris**, **headers**, and **body** parameters. To perform your calls, you need to modify the parameters according to your preferences. See the OBE [Using the Oracle Identity Cloud Service REST APIs with Postman](http://www.oracle.com/webfolder/technetwork/tutorials/obe/cloud/idcs/idcs_rest_postman_obe/rest_postman.html) for an example of how to create a user using the collection and the sample requests.

## License

Copyright (c) 2017, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the
Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at
https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and
limitations under the License.