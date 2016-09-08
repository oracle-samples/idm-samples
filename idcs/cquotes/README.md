# Customer Quotes

Customer Quotes is a sample web application used to test the Oracle Identity Cloud Service integration with OpenID Connect and OAuth2.

This application is provided “AS IS” with no express or implied warranty for accuracy or accessibility. The sample code is intended to demonstrate the basic integration between Oracle Identity Cloud Service and custom applications and does not represent, by any means, the recommended approach or is intended to be used in development or productions environments.

### This Sample Code is used in the following tutorials:
- [Oracle Identity Cloud Service: Integrating a Custom Client Application](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13427). In this tutorial, you experiment the **OpenID Connect** and **OAuth2** integrations.
- [Oracle Identity Cloud Service: Integrating a Resource Server Application](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13428). In this tutorial, you extend the Customer Quote's **OAuth2** integration to integrate with [`Sales Insights`](../salesinsight), another sample application.

## <a name="setup"></a> Setup
### Prerequisites:
- Experience as Java Developer
- Java JDK 8 installed and available via your Operating System ``PATH``.
- A **Java EE IDE** with **Maven**. In our tutorials, we use **[Netbeans 8.1](https://netbeans.org/downloads/)** for Windows.
- A **Java EE Application Server**. In our tutorials, we use the **Glassfish 4.1.1** server (embedded with Netbeans).
- Access to Oracle Identity Cloud Service with authorization rights to manage Applications (Identity Domain Administrator, Security Administrator, or Application Administrator)

### Instructions:

#### Register the Application in Identity Cloud Service
 1. Create and activate a **Web Application** in Oracle Identity Cloud Service with the **Authorization code** grant type.
 2. Copy the application **client id** and **client secret**.

#### Include Oracle Identity Cloud Service in your Application Server trust store
 1. Access the **Oracle Identity Cloud Service UI**.
 2. Export the HTTPS certificate as **Base-64 encoded X.509 (.CER)**.
 3. Import the certificate into your Application Server trust keystore. To import a certificate to the default keystore in Glassfish, you can use the `keytool` command as follows:
```bash
cd "C:\Users\adm\AppData\Roaming\NetBeans\8.1\config\GF_4.1.1\domain1\config"
keytool -import -keystore cacerts.jks -trustcacerts -file "C:\temp\idcs.cer" -storepass changeit
```

#### Download, configure, and run the Customer Quotes application
 1. Download and extract the **cquotes** application.
 2. In **`ClientConfig.java`**, update the `CLIENT_ID`, the `CLIENT_SECRET`, and the `IDCS_URL` with values according to your Oracle Identity Cloud Service instance.
 3. Rebuild and Launch the cquotes application.
 4. Access the application (in Glassfish: `https://localhost:8181/cquotes`)

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