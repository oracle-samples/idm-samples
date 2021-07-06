#   Copyright (c) 2000, 2021, Oracle and/or its affiliates.
#
#    Licensed under the Universal Permissive License v 1.0 as shown at
#    http://oss.oracle.com/licenses/upl.

from django.conf.urls import url
from . import views

urlpatterns = [
	url(r'^$', views.index, name='index'),
	url(r'^login/', views.login, name='login'),
	url(r'^about/', views.about, name='about'),
	url(r'^logout/', views.logout, name='logout'),

	url(r'^auth/', views.auth, name='auth'),
	url(r'^callback/', views.callback, name='callback'),

	url(r'^home/', views.home, name='home'),
	url(r'^myProfile/', views.myProfile, name='myProfile'),
	
]