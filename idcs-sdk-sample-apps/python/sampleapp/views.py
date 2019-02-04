from django.shortcuts import render
from django.http import HttpResponse, HttpResponseRedirect

#Loading the SDK Python file.
from . import IdcsClient
import simplejson as json

def index(request):
    return render(request, 'sampleapp/index.html')
	
def login(request):
	return render(request, 'sampleapp/login.html')

def about(request):
	return render(request, 'sampleapp/about.html')


# Definition of the /auth route
def auth(request):
    #Loading the configurations
    options = getOptions()
    #Authentication Manager loaded with the configurations.
    am = IdcsClient.AuthenticationManager(options)
    #Using Authentication Manager to generate the Authorization Code URL, passing the 
    #application's callback URL as parameter, along with code value and code parameter.
    url = am.getAuthorizationCodeUrl(options["redirectURL"], options["scope"], "1234", "code")
    #Redirecting the browser to the Oracle Identity Cloud Service Authorization URL.
    return HttpResponseRedirect(url)

# Definition of the /callback route
def callback(request):
    code = request.GET.get('code')
    #Authentication Manager loaded with the configurations.
    am = IdcsClient.AuthenticationManager(getOptions())
    #Using the Authentication Manager to exchange the Authorization Code to an Access Token.
    ar = am.authorizationCode(code)
    #Get the access token as a variable
    access_token = ar.getAccessToken()
    #User Manager loaded with the configurations.
    um = IdcsClient.UserManager(getOptions())
    #Using the access_token value to get an object instance representing the User Profile.
    u = um.getAuthenticatedUser(access_token)
    #Getting the user details in json object format.
    displayname = u.getDisplayName()
    #The application then adds these information to the User Session.
    request.session['access_token'] = access_token
    request.session['id_token'] = id_token
    request.session['displayname'] = displayname
    #Rendering the home page and adding displayname to be printed in the page.
    return render(request, 'sampleapp/home.html', {'displayname': displayname})

# Definition of the /home route
def home(request):
    access_token = request.session.get('access_token', 'none')
    if access_token ==  'none':
        return render(request, 'sampleapp/login.html') 
    else:
        displayname = request.session.get('displayname', 'displayname')
        return render(request, 'sampleapp/home.html', {'displayname': displayname})

# Definition of the /appDetails route
def appDetails(request):
    access_token = request.session.get('access_token', 'none')
    if access_token ==  'none':
        return render(request, 'sampleapp/login.html') 
    else:
        displayname = request.session.get('displayname', 'displayname')
        return render(request, 'sampleapp/appDetails.html', {'displayname': displayname})

# Definition of the /myProfile route
def myProfile(request):
    #Getting the Access Token value from the session
    access_token = request.session.get('access_token', 'none')
    if access_token ==  'none':
        #If the access token isn't present redirects to login page.
        return render(request, 'sampleapp/login.html') 
    else:
        #If the access token is present, then loads the User Manager with the configurations.
        am = IdcsClient.UserManager(getOptions())
        #Using the access_token value to get an object instance representing the User Profile.
        u = am.getAuthenticatedUser(access_token)
        #Getting the user details in json format.
        jsonProfile = json.dumps(u.getUser())
        #Getting User information to send to the My Profile page.
        displayname = request.session.get('displayname', 'displayname')
        #Rendering the content of the My Profile Page.
        return render(request, 'sampleapp/myProfile.html', {'displayname': displayname, 'jsonProfile':jsonProfile})
	
# Definition of the /logout route
def logout(request):
    #Getting the Access Token value from the session
    access_token = request.session.get('access_token', 'none')
    if access_token ==  'none':
        #If the access token isn't present redirects to login page.
        return render(request, 'sampleapp/login.html') 
    else:
        options = getOptions()
        url = options["BaseUrl"]
        url += options["logoutSufix"]
        url += '?post_logout_redirect_uri=http%3A//localhost%3A8000&id_token_hint='
        url += request.session.get('id_token', 'none')
        #Clear session attributes
        del request.session['access_token']
        del request.session['id_token']
        del request.session['displayname']
        #Redirect to Oracle Identity Cloud Service logout URL.
        return HttpResponseRedirect(url)

#Function used to load the configurations from the config.json file
def getOptions():
    fo = open("config.json", "r")
    config = fo.read()
    options = json.loads(config)
    return options
