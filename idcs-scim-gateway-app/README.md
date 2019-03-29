

# Sample SCIM Gateway Application

The System for Cross-domain Identity Management (SCIM) specification is designed to make managing user identities in cloud-based applications and services easier.

Oracle Identity Cloud Service provides Generic SCIM Templates to facilitate the integration of your custom application with Oracle Identity Cloud Service for user provisioning and synchronization purposes. To use one of the Generic SCIM Templates your application must expose a SCIM-based interface.

If your custom application doesn't provide a SCIM-based interface, then you can develop a custom SCIM gateway to act as an interface between Oracle Identity Cloud Service and your custom application. This gateway exposes your application's identity store as SCIM-based REST APIs, and then you can use one of the Generic SCIM Templates to integrate Oracle Identity Cloud Service with your application for user provisioning and synchronization purposes.

## Before You Begin:

Before developing your custom SCIM gateway, if you're a new developer who isn’t familiar with the SCIM standard, then you must first understand the SCIM protocol and:

- Define which programming language or framework you use to develop your custom SCIM Gateway.
- Understand which identity attributes are available for your custom application and model them as SCIM-based attributes. 
- Utilize open-standard libraries to expose your custom application’s APIs as SCIM APIs. 
- Familiarize yourself with the CRUD operations that you want your custom SCIM gateway to perform.
- Read [System for Cross-domain Identity Management (SCIM): Protocol](https://tools.ietf.org/html/rfc7644)


## Supported Operations:

User is a type of resource within the SCIM specification. To manage this resource, the SCIM gateway must expose well-known endpoints and HTTP methods to enable operations such as searching, creating, updating, and deleting users. The HTTP request for the operation that you want to perform and the HTTP response from that operation must be in a JSON format.

You can implement the following user operations:

**Search Users**: Obtain a list of all users with their attributes that are in your custom application. GET HTTP operation in [https://app.example.com/scimgate/Users](https://app.example.com/scimgate/Users)

**Search a User**: Retrieve information about a specific user and their attributes in your custom application. GET HTTP operation in [https://app.example.com/scimgate/Users/id](https://app.example.com/scimgate/Users/id)

**Create a User**: Create a user account in your custom application. POST HTTP operation in [https://app.example.com/scimgate/Users](https://app.example.com/scimgate/Users)

**Update a User Attribute**: Update attribute values of a user account in your custom application. PUT HTTP operation in [https://scimgate.example.com/Users/id](https://scimgate.example.com/Users/id)

**Delete a User**: Remove a user account from your custom application. DELETE HTTP operation in  [https://scimgate.example.com/Users/id](https://scimgate.example.com/Users/id)


## How Do You Secure the Custom SCIM Gateway?

Because you don't want unauthorized users or clients to access your custom SCIM gateway, you must secure it. To do this, you must use an authorization headers such as basic, client credentials, bearer token, or resource owner password to protect the HTTP(S) endpoints of your gateway. If proper authentication or authorization data isn't present or is invalid, then the endpoints will return a 401 HTTP response code.

Oracle also recommends you to deploy your custom SCIM Gateway to accept only HTTPs calls.

## How Does the Custom SCIM Gateway Works?

Oracle provides a sample Node.js application that conforms to SCIM specifications, and which you can use to help you develop your own custom SCIM gateway to integrate it with your application.

This custom SCIM gateway application exposes HTTP endpoints to enable operations such as searching, creating, updating, and deleting users. The custom gateway stores information about the users locally in the userdb.json file. This file uses the JSON format, and contain an array of users.

**Important:** The sample web application isn't meant to be published to production and isn't concerned about the language’s specific best practices, such as data handling, patterns, security, and so on. The sole purpose of the sample application is to address the recommended approach to integrate Oracle Identity Cloud Service and a custom application using the SCIM standard.

The sample application uses express and body-parser packages. The **server.js** file implements a route for users' endpoints:
```javascript
// Import packages
var express = require('express')
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());
var config = require('./config.js');

require('./routes/users.js')(app);
```
The **routes/users.js** file defines the SCIM REST API endpoints, and maps each endpoint to the corresponding JavaScript function:
```javascript
  //Get operation for /Users endpoint
  app.get('/scimgate/Users', users.findAll);
  //Get operation for /Users endpoint
  app.get('/scimgate/Users/:id', users.findOne);
  //Post operation for /Users endpoint
  app.post('/scimgate/Users', users.create);
  //Put operation for /Users endpoint
  app.put('/scimgate/Users/:id', users.update);
  //Delete operation for /Users endpoint
  app.delete('/scimgate/Users/:id', users.delete);
```
The **user.controller.js** file implements JavaScript functions to create, read, update, and delete users in the local user store, represented by the **userdb.json** file:
```javascript
exports.findAll = function(req, res)
exports.findOne = function(req, res)
exports.create = function(req, res)
exports.update = function(req, res)
exports.delete = function(req, res)
```
The **userdb.json** file contains an array of users, and the structure of each user entry follows the SCIM specification standard, using a subset of the user attributes:
```javascript
{  
  "resources": [  
   {  
     "schemas": ["urn:scim:schemas:core:1.0"],  
     "id": 1,  
     "userName": "User1",  
     "name": {  
        "formatted": "User 1 Name",  
        "familyName": "Name",  
        "givenName": "User 1"  
     },  
     "displayName": "User Name 1",  
     "userType": "Employee",  
     "title": "User1 Title",  
     "active": true,  
     "password": "Password123",  
     "email": "user1@[email.com](http://email.com/)"  
   } 
  ]  
}
```
To authorize the client to make HTTP requests, the sample SCIM gateway application makes use of two environment variables that you must set before running the application: _ADMINUSER_  and _ADMINPASS_. These variables represent the administrator's user name and password for your API authentication service, and are used for basic authentication grant type.

You provide values for these two environment variables by setting up the run.sh shell script for Unix or Mac environments, or the run.bat batch script for Windows environments.  

Oracle Identity Cloud Service sends these credentials in the form of **Authorization Basic** header for all requests to authenticate and then access the custom SCIM gateway.  

You can modify the sample application's source code and implement other types of authentication methods to match your requirements.  

You can also change the sample application's source code so that instead of contacting the local user store (represented by the userdb.json file), the new sample application contacts your application's identity store to create, read, update, and delete users.

## Configure and Run the Custom SCIM Gateway Sample Application

### Update and Run the Custom SCIM Gateway Sample Application

1. Edit the run script file in the  **root**  folder of the sample SCIM gateway application, update the file with the following values, and then save the file.
**Note:** If you're running this application in a Unix or Mac environment, use the `run.sh` script. If you're using Windows, then use `run.bat`.
```script
export ADMINUSER=admin  
export ADMINPASS=Welcome1  
export PORT=6355
```
2. Open a command prompt or terminal, navigate to the **root** folder of the sample application, execute the run script for your operating system environment. You'll see log information that helps you understand what the sample application is doing.
Make sure the hostname of this sample application is reachable through the Internet, so that Oracle Identity Cloud Service can contact the application

### Register the Custom SCIM Gateway Sample Application

**Note**: If you can't find Generic SCIM Templates in your Oracle Identity Cloud Service, contact your identity domain administrator.

1. In the Identity Cloud Service console, expand the **Navigation Drawer**, click **Applications**, click **Add**, and then select **App Catalog**.
2. In the **Type of Integration** section, click **Provisioning**, locate the **GenericScim - Basic**, and then click **Add**.  
3. In the **Details** pane of the **Add GenericScim - Basic** page, enter `SCIM Gateway Application` for both the name and description of your application, and then click **Next**.  
4. In the **Provisioning** pane, turn on the **Enable Provisioning** switch.  
5. In the **Grant consent** dialog box, click **Continue**.  
6. Use the following table to populate the fields of the **Configure Connectivity** section of the **Provisioning** tab, and then click **Finish**.

| Parameter              | Value                                                                                                                    |
|------------------------|--------------------------------------------------------------------------------------------------------------------------|
| Host Name              | Type the hostname of the server where you run your SCIM gateway                                                          |
| Base URI               | /scimgate                                                                                                                |
| Administrator Username | Type the administrator username you provided as environment variable for your SCIM gateway (value of ADMINUSER variable) |
| Administrator Password | Type the password you provided as environment variable for your SCIM gateway (value of ADMINPASS variable )              |
| HTTP Operation Types   | \_\_ACCOUNT\_\_.Update=PUT                                                                                                   |

**Note**: You need to use Oracle Identity Cloud Service's API to change the Port, SSL Enabled, Content-Type and Response-Type parameter to be able to use this Sample Application integrated with Oracle Identity Cloud Service.

**Note**: Use the parameter table below to update the fields with the corresponding values using REST API:

|  Parameter    | Value             |
|---------------|-------------------|
| Port          | 6355              |
| SSLEnabled    | false             |
| Content-Type  | application/json  |
| Response-Type | application/json  |

After you update these parameters you can test connectivity between the application and Oracle Identity Cloud Service and then activate the application.

1. In the Identity Cloud Service console, expand the **Navigation Drawer**, click **Applications**, click your application, and then click **Provisioning** tab.
2. Click  **Test Connectivity**  to verify that a connection can be established between Oracle Identity Cloud Service and your sample SCIM gateway application.
**Note**: Make sure you run the SCIM gateway sample application before testing the connectivity.
3. In the **Provisioning** pane, click **Finish**, and then click **Activate** to activate the application.  

### Test Your SCIM Gateway Sample Application

You can now start assigning users to the application using Oracle Identity Cloud Service console. Once the user is assigned to the application, Oracle Identity Cloud Service provision a user account to the target system. You can then manage the life cicle of this user account by disabling, enabling, modifing, and revoking the user access to the application.

1. In the **Applications** page, select your application, and then click it to open the  **Users** tab.  
2. In the **Users**  tab, click **Assign**.  
3. In the  **Assign Users** window, choose a user, and then click  **Assign**.
4. In the  **Assign Application**  window, populate the **Full Name**,  **Family Name**,  **Given Name**,  **Display Name**,  **Email**,  **UserName**, and  **Password**form fields with values, and then click  **Save**.  
Oracle Identity Cloud Service creates a user account in the  _userdb.json_ file of your application.  
5. Open the  _userdb.json_  file and verify that a user account has been created. Then, close the file.  
6. In the  **Users**  tab, click the  **Action**  menu (graphic) to the right side of the user, and then select **Deactivate**.  
7. After one minute, open the  _userdb.json_  file and verify that the corresponding user account has a  **false**  value for the  **active**  attribute. Then, close the file.  
8. In the **Users**  tab, click the **Action** menu (graphic) to the right side of the user, and then select **Activate**.  
9. After one minute, open the _userdb.json_  file and verify that the corresponding user account has a  **true** value for the **active** attribute. Then, close the file.  
10. In the **Users** tab, select the user, and then click  **Revoke.  
11. In the  **Revoke User?** window, click **Revoke User**.  
12. After the **Revoke User?** window closes, open the  _userdb.json_ file and verify that the corresponding user account has been removed. Then, close the file.

## License

Copyright (c) 2019, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL.

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.
