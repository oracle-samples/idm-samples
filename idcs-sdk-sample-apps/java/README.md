# Oracle Identity Cloud Service' SDK Java Sample Application

Oracle Identity Cloud Service provides a Software Development Kit (SDK) that you can use to integrate Java web applications with Oracle Identity Cloud Service.

The Java SDK is available as a Java Archive (JAR) (idcs-assert.jar) file, which must be loaded as a web application library.

This Sample Code is used in the following tutorial: [Use Oracle Identity Cloud Service's SDK for Authentication in Java Web Applications]( https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:22663)

**Important:** The sample web application isn't meant to be published to production and isn't concerned about the language’s specific best practices, such as data handling, patterns, security, and so on. The sole purpose of the sample web application is to address the recommended approach to integrate Oracle Identity Cloud Service and a custom application using the SDK.

## Dependent Third-party libraries
The Oracle Identity Cloud Service SDK for Java is depedent of the following libraries and version:
- [ASM Helper Minidev 1.0.2](https://mvnrepository.com/artifact/net.minidev/asm)
- [Apache Commons Lang 3.6](https://mvnrepository.com/artifact/org.apache.commons/commons-lang3)
- [JSON Small And Fast Parser](https://mvnrepository.com/artifact/net.minidev/json-smart)
- [Nimbus LangTag](https://mvnrepository.com/artifact/com.nimbusds/lang-tag)
- [Nimbus JOSE+JWT](https://mvnrepository.com/artifact/com.nimbusds/nimbus-jose-jwt)
- [OAuth 2.0 SDK With OpenID Connect Extensions](https://mvnrepository.com/artifact/com.nimbusds/oauth2-oidc-sdk)
- [Apache Commons Collections](https://mvnrepository.com/artifact/org.apache.commons/commons-collections4)

**Note:** Before deploying or using this sample application, it need to be updated following the instruction below:

## How to use the Sample Application:

The sample web application needs an application's Client ID and Secret to establish communication with Oracle Identity Cloud Service.  Follow the referenced tutorial to register an application.

Access the Oracle Identity Cloud Service console and download the SDK for Java. Inside the downloaded zip file there is a file called **idcs-asserter.jar**. The name of the java sdk jar file may vary.
Copy the file to the location pointed in the pom.xml file below.

Edit the **pom.xml** file, update the JAR file name in the following statement, and then save the file.
```xml
<!-- Add here the Oracle Identity Cloud Service SDK dependency entry -->
        <dependency>
                <groupId>oracle.security.jps.idcsbinding</groupId>
                <artifactId>sdk</artifactId>
                <version>1.0</version>
                <scope>system</scope>
                <systemPath>${basedir}/src/main/webapp/WEB-INF/lib/idcs-asserter.jar</systemPath>
        </dependency>
```
**Note:** make sure the name of the idcs-asserter.jar file matches the name of the java SDK jar file downloaded from the Oracle Identity Cloud Service console.

Edit the **ConnectionOptions.java** file and update the IDCS_HOST, IDCS_PORT, IDCS_CLIENT_ID, IDCS_CLIENT_SECRET,  IDCS_CLIENT_TENANT and AUDIENCE_SERVICE_URL variables.
```java
public Map<String,Object> getOptions(){
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_HOST, "identity.oraclecloud.com");
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_PORT, "443");
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_CLIENT_ID, "123456789abcdefghij");
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_CLIENT_SECRET, "abcde-12345-zyxvu-98765-qwerty");
        this.options.put(IDCSTokenAssertionConfiguration.IDCS_CLIENT_TENANT, "idcs-abcd1234");
        this.options.put(Constants.AUDIENCE_SERVICE_URL, "https://idcs-abcd1234.identity.oraclecloud.com");
        this.options.put(Constants.TOKEN_ISSUER, "https://identity.oraclecloud.com");
        this.options.put(Constants.TOKEN_CLAIM_SCOPE, "urn:opc:idm:t.user.me openid");
        this.options.put("SSLEnabled", "true");
        this.options.put("redirectURL", "http://localhost:8080/callback");
        this.options.put("logoutSufix", "/sso/v1/user/logout");
	return this.options;
}
```

Edit the **AuthSevlet.java** file and update the **processRequest** method:
```java
protected void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {   
    Map options = new ConnectionOptions().getOptions();
    String redirectUrl = (String)options.get("redirectURL");
    String scope = (String)options.get("scope");
    IDCSTokenAssertionConfiguration config = new IDCSTokenAssertionConfiguration(options);
    AuthenticationManager am = new AuthenticationManagerImpl(config);
    String authzURL = am.getAuthorizationCodeUrl(redirectUrl, scope, "1234", "code");
    response.sendRedirect(authzURL);
}
```
The AuthSevlet class maps to the **/auth** URL. It uses the SDK to generate the authorization code URL, and redirects the browser to the generated URL.

The parameter value (1234) of the getAuthorizationCodeUrl method is meant to be a code that the sample web application might use to check if the communication was made correctly to Oracle Identity Cloud Service. The sample web application does not use it.

Edit the **CallbackServlet.java** file and update the **processRequest** method:
```java
protected void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
	Map<String, Object> options = new ConnectionOptions().getOptions();
        IDCSTokenAssertionConfiguration config = new IDCSTokenAssertionConfiguration(options);
        AuthenticationManager am = new AuthenticationManagerImpl(config); 
        String authzCode = request.getParameter("code");
        AuthenticationResult ar = am.authorizationCode(authzCode);
        String access_token = ar.getAccessToken();
        
        IDCSUserManager um = new IDCSUserManagerImpl(config);
        IDCSUser user = um.getAuthenticatedUser(access_token);
        user = um.getUser(user.getId());
        net.minidev.json.JSONObject json = user.getUser();
        
        HttpSession session=request.getSession();
        session.setAttribute("access_token", access_token);
        session.setAttribute("userId", user.getId());

        String displayName = json.getAsString("displayName");
        session.setAttribute("displayName", displayName);

        request.getRequestDispatcher("private/home.jsp").forward(request, response);
}
```
The CallbackServlet maps to the **/callback** URL, and uses the authorization code parameter to request an access token. The access token is then stored in the user session, along with the userId and displayName values. Then, the servlet forwards the request to the **private/home.jsp** page.

Edit the **myProfile.jsp** file and add the following content at the beginning of the file:
```java
<%
  java.util.Map<String, Object> options = new sampleapp.util.ConnectionOptions().getOptions();
  oracle.security.jps.idcsbinding.shared.IDCSTokenAssertionConfiguration configuration = new oracle.security.jps.idcsbinding.shared.IDCSTokenAssertionConfiguration(options);

  String access_token = session.getAttribute("access_token").toString();
  oracle.security.jps.idcsbinding.shared.IDCSUserManager um = new oracle.security.jps.idcsbinding.shared.IDCSUserManagerImpl(configuration);
  oracle.security.jps.idcsbinding.api.IDCSUser user = um.getAuthenticatedUser(access_token);
  net.minidev.json.JSONObject json = user.getUser();
  String jsonString = json.toString();
%>
```
The **/private/myProfile.jsp** page accesses the user's access token previously set in the session, calls the getAuthenticatedUser method to retrieve the user's information, and then formats it as HTML.

Edit the **LogoutServlet.java** file and update the **processRequest** method:
```java
protected void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
  HttpSession session=request.getSession();
  session.invalidate();
  Map options = new ConnectionOptions().getOptions();
  String logoutURL = (String)options.get(Constants.AUDIENCE_SERVICE_URL) +"/sso/v1/user/logout";
  response.sendRedirect(logoutURL);
}
```
The LogoutServlet class invalidates the user session and then redirects the user to Oracle Identity Cloud Service's log out URL.

## Run the Sample Web Application

- Open the java project in [NetBeans](https://netbeans.org/). Make sure to use [Java SDK 8](http://www.oracle.com/technetwork/pt/java/javase/downloads/jdk8-downloads-2133151.html). 

- Build and Run the application.
 
- Open a browser window, access the http://localhost:8080 URL, click **Log in**, and then click the Oracle red icon.

- The Oracle Identity Cloud Service Sign In page appears.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.