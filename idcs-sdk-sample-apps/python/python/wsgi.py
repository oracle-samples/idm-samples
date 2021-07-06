"""
WSGI config for python project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/1.11/howto/deployment/wsgi/
"""

#   Copyright (c) 2000, 2021, Oracle and/or its affiliates.
#
#    Licensed under the Universal Permissive License v 1.0 as shown at
#    http://oss.oracle.com/licenses/upl.

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "python.settings")

application = get_wsgi_application()
