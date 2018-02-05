# Oracle Identity Cloud Service' SDK Python Sample Application

Oracle Identity Cloud Service provides a Software Development Kit (SDK) that you can use to integrate Python web applications with Oracle Identity Cloud Service.

The Python SDK is available as two python files **IdcsClient.py** and **Constants.py**, which must be included in the web application.

This Sample Code is used in the following tutorial: [Use Oracle Identity Cloud Service's SDK for Authentication in Python Web Applications](https://apexapps.oracle.com/pls/apex/f?p=44785:112:0::::P112_CONTENT_ID:22662)

**Important:** The sample web application isn't meant to be published to production and isn't concerned about the language’s specific best practices, such as data handling, patterns, security, and so on. The sole purpose of the sample web application is to address the recommended approach to integrate Oracle Identity Cloud Service and a custom application using the SDK.

## How to use the Sample Application:

The sample web application needs an application's Client ID and Secret to establish communication with Oracle Identity Cloud Service.  Follow the referenced tutorial to register an application.

Edit the **config.json** file, update the ClientId, ClientSecret, BaseUrl and AudienceServiceUrl variables, and then save the file.
```json
{
  "ClientId" : "1234567890",
  "ClientSecret" : "abcdefghij",
  "BaseUrl" : "https://example.idcs.oracle.com:443",
  "AudienceServiceUrl" : "https://example.idcs.oracle.com:443",
  "scope" : "urn:opc:idm:t.user.me openid",
  "TokenIssuer" : "https://identity.oraclecloud.com",
  "redirectURL": "http://localhost:8000/callback",
  "logoutSufix":"/sso/v1/user/logout"
}
```

Edit the **views.py** file include the definition of the **/auth** route:
```python
def auth(request):
    options = getOptions()
    am = IdcsClient.AuthenticationManager(options)
    url = am.getAuthorizationCodeUrl(options["redirectURL"], options["scope"], "1234", "code")
    return HttpResponseRedirect(url)
```
The auth function uses the IDCS' SDK to generate the authorization code URL, and  redirects the browser to the generated URL.

The parameter value (1234) of the getAuthorizationCodeUrl SDK's function is meant to be a code that the sample web application might use to check if the communication was made correctly to Oracle Identity Cloud Service. The sample web application does not use it.

Edit the **views.py** file include the definition of the **/callback** route:
```python
def callback(request):
    code = request.GET.get('code')
    am = IdcsClient.AuthenticationManager(getOptions())
    ar = am.authorizationCode(code)
    access_token = ar.getAccessToken()
    um = IdcsClient.UserManager(getOptions())
    u = um.getAuthenticatedUser(access_token)
    displayname = u.getDisplayName()
    request.session['access_token'] = access_token
    request.session['displayname'] = displayname
    return render(request, 'sampleapp/home.html', {'displayname': displayname})
```
The callback function uses the authorization code parameter to request an access token. The access token is stored as a cookie, and then sent to the browser for future use.

Edit the **views.py** file and include the definition of the **/auth** route:
```python
app.get('/auth', passport.authenticate(config.IDCS_STRATEGY_NAME, {}), function(req, res) {
    res.redirect('/home');
});
```

Edit the **views.py** file and include the definition of the **/myProfile** route:
```python
def myProfile(request):
    access_token = request.session.get('access_token', 'none')
    if access_token ==  'none':
        return render(request, 'sampleapp/login.html') 
    else:
        am = IdcsClient.UserManager(getOptions())
        u = am.getAuthenticatedUser(access_token)
        jsonProfile = json.dumps(u.getUser())
        displayname = request.session.get('displayname', 'displayname')
        return render(request, 'sampleapp/myProfile.html', {'displayname': displayname, 'jsonProfile':jsonProfile})
```
The **/home**, **/appDetails**, and **/userInfo** URLs are protected resources. The sample web application uses the ensureAuthenticated function to handle these protected resources. 

Edit the **views.py** file and include the definition of the **/logout** route:
```python
def logout(request):
    options = getOptions()
    url = options["BaseUrl"]
    url += options["logoutSufix"]
    del request.session['access_token']
    del request.session['displayname']
    return HttpResponseRedirect(url)
```
The logout function invalidates the user session and then redirects the user to Oracle Identity Cloud Service's log out URL.

## Run the Sample Web Application

- Open a command prompt, navigate to the **python folder**, and enter `pip install Django`.

- Install the required libraries, by running the following command line 
```
pip install simplejson==3.8.2
pip install cryptography==2.0.3
pip install PyJWT==1.5.2
pip install requests==2.18.4
pip install six==1.10.0
pip install py_lru_cache==0.1.4
```

- Extract the contents of the SDK zip file into the sample web application source code folder. 

- In the command prompt, navigate to the **python folder**, and enter `python.exe manage.py migrate` and then `python manage.py runserver`to start the sample application. 

- Open a browser window, access the http://localhost:8000 URL, click **Log in**, and then click the Oracle red icon.

- The Oracle Identity Cloud Service Sign In page appears.

## License

Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved.

You may not use the identified files except in compliance with the Universal Permissive License (UPL), Version 1.0 (the "License.")

You may obtain a copy of the License at https://opensource.org/licenses/UPL. 

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

See the License for the specific language governing permissions and limitations under the License.