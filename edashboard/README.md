# Employee Dashboard

Employee Dashboard is a sample JAAS/JAZN web application used to demonstrate Java security integrations.

This application is provided “AS IS” with no express or implied warranty for accuracy or accessibility. The sample code is intended to demonstrate sample integrations and does not represent, by any means, the recommended approach or is intended to be used in development or productions environments.

## <a name="setup"></a> Setup
### Prerequisites:
- WebLogic 12c domain or Java Cloud Service instance available
- A **Java EE IDE**. In the instructions, we use **[Netbeans 8.1](https://netbeans.org/downloads/)**.
- An Identity Store to host users and groups. In the instructions, we use the default identity store embedded with WebLogic Server.

### Instructions:

#### Download the application
 1. Clone or download the [idm-samples](https://github.com/oracle/idm-samples) repository.
 
#### **Optional:** Modify code and build the application
 1. Launch NetBeans and open the **edashboard** project.
 2. Modify the source code according to your preferences.
 3. To generate a build with your changes, click the **Files** tab (located on the top-left corner), expand **edashboard**, right-click **build.xml**, and then select **Run Target** > **dist-ear**.
 4. In the output window, confirm that the `APP_HOME/dist/edashboard.war` file is created and the confirmation message is displayed.

#### Deploy and launch the application in Weblogic
 1. Access the Weblogic Administration Console as administrator.
 2. Click **Lock & Edit** (if your weblogic is not deployed in production mode, skip this step).
 3. Click **Deployments**.
 4. Click **Install**
 5. Click **Upload your file(s)**
 6. Click **Choose File** next to **Deployment Archive**, and open the the `APP_HOME/dist/edashboard.war` file.
 7. Continue with the installation selecting the default options provided by WebLogic.
 8. In **Select deployment targets**, select the managed servers or clusters where you want the application to be hosted.
 9. Click **Activate Changes**
 10. Click **Deployments**, select **edashboard**, and then click **Start** > **Servicing all requests**. In the confirmation window, click **Yes**.
 11. The application will be running under `<MANAGED_SERVER_URL>/edashboard`

#### Create users and roles for the application
 1. In WebLogic, click **Security Realms**.
 2. Click **myrealm**.
 3. Click **Users and Groups** > **Groups** > **New**.
 4. Create the groups according to the table: 

| Name     | Description               |
|----------|---------------------------|
| employee | Regular employee          |
| manager  | Manage employees          |
| security | Manage employee security  |

 5. Click **Users and Groups** > **Users** > **New**.
 6. Create the users according to the table, using the password of your preference (for example, `Welcome1`): 

| Name                 |
|----------------------|
| csaladna@example.com |
| tsemmens@example.com |
| faon@example.com     |

7. Click **Users and Groups** > **Users** > *user name*, and then click **groups**.
8. Associate each user and group as follows:

| User Name            | Group    |
|----------------------|----------|
| csaladna@example.com | employee |
| tsemmens@example.com | manager  |
| faon@example.com     | security |

#### Test the access
 1. Open a new browser session and access `<MANAGED_SERVER_URL>/edashboard`. A basic authentication login prompt should appear.
 2. Log in as `csaladna@example.com`.
 3. Navigate through the application. This user should see all pages, except *Management Watch* and *Security Report*.
 4. Repeat the previous steps to test `tsemmens@example.com` and confirm that this user can see all pages except *Security Report*.
 5. Repeat the previous steps to test `faon@example.com` and confirm that this user can see all pages except *Management Watch*.

### What's next? Use this Sample Code in the following tutorial(s):
- [Oracle Identity Cloud Service: Integrating with WebLogic Server](http://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:13483). In this tutorial, you integrate Oracle Identity Cloud Service with WebLogic Server, where Employee Dashboard is deployed.

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
