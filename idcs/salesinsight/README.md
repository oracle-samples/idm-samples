# Sales Insight

Sales Insight is a sample web application used to test the Oracle Identity Cloud Service integration with OAuth2 as a resource server application.

This application is provided “AS IS” with no express or implied warranty for accuracy or accessibility. The sample code is intended to demonstrate the basic integration between Oracle Identity Cloud Service and custom applications and does not represent, by any means, the recommended approach or is intended to be used in development or productions environments.

### This Sample Code is used in the following tutorial:
- [Oracle Identity Cloud Service: Integrating a Resource Server Application](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13428). In this tutorial, you integrate the Sales Insight with Oracle Identity Cloud Service as a resource server application. This application will be able to integrate with other Client Applications, such as the [`Customer Quotes`](../cquotes) app.

## <a name="setup"></a> Setup
### Prerequisites:
- Complete the [Oracle Identity Cloud Service: Integrating a Custom Client Application](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13427). tutorial.

### Instructions:

#### Register the Application in Identity Cloud Service
 1. Create a **Web Application** in Oracle Identity Cloud Service.
 2. In Authorization, select only the **Client Credentials** grant type.
 2. In the Resources, select **Register Resources** and enter `http://localhost:8080/salesinsight/` as primary audience.
 3. Register the scopes `quote`, `pipeline`, `insight`, and `report`.
 4. Save and Activate the application.
 2. Copy the application **client id** and **client secret**.

#### Download, configure, and run the Sales Insight application
 1. Download and extract the **salesinsight** application.
 2. Rebuild and Launch the application.
 3. Access the report request (in Glassfish `http://localhost:8080/salesinsight/report`) and confirm that the app is able to return data.
 4. Stop the application.
 5. In **`ResourceServerConfig.java`**, update the `CLIENT_ID`, the `CLIENT_SECRET`, and the `IDCS_URL` with values according to your Oracle Identity Cloud Service instance.
 6. In the **`web.xml`**, uncomment the AccessTokenValidator snippet.
 7. Rebuild and Launch the salesinsight application. In the Server Logs, you should see the message `Signing Key from IDCS successfully loaded!`
 8. Access the application. Sales Insight should return the message `Error While Validating Token: No access token provided`.

#### Update the Customer Quotes application to consume the Sales Insight APIs
 1. In Oracle Identity Cloud Service, edit the Customer Quotes's application to include all scopes from the `Sales Insight` application.
 2. In the cquotes application, open the **`ClientConfig.java`** file and change the `IS_RESOURCE_SERVER_ACTIVE` value to `true`.
 2. Rebuild and Launch the cquotes application.
 3. Access the application (in Glassfish: `https://localhost:8181/cquotes`).
 4. After login, you should see few buttons. Each button, explores an API endpoint provided by the Sales Insight app.

### <a name="license"></a> License

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