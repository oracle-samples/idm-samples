from django.shortcuts import render
from django.http import HttpResponse, HttpResponseRedirect

from . import IdcsClient
import simplejson as json

def index(request):
    return render(request, 'sampleapp/index.html')
	
def login(request):
	return render(request, 'sampleapp/login.html')

def about(request):
	return render(request, 'sampleapp/about.html')


# Definition of the /auth route


# Definition of the /callback route


# Definition of the /home route
def home(request):
    access_token = request.session.get('access_token', 'none')
    if access_token ==  'none':
        return render(request, 'sampleapp/login.html') 
    else:
        displayname = request.session.get('displayname', 'displayname')
        return render(request, 'sampleapp/home.html', {'displayname': displayname})

# Definition of the /myProfile route

	
# Definition of the /appDetails route
def appDetails(request):
    access_token = request.session.get('access_token', 'none')
    if access_token ==  'none':
        return render(request, 'sampleapp/login.html') 
    else:
        displayname = request.session.get('displayname', 'displayname')
        return render(request, 'sampleapp/appDetails.html', {'displayname': displayname})

# Definition of the /logout route


def getOptions():
    fo = open("config.json", "r")
    config = fo.read()
    options = json.loads(config)
    return options
