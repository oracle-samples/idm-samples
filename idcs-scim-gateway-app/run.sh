#!/bin/sh

export ADMINUSER=admin
export ADMINPASS=Welcome1
export PORT=6355

# setting DEBUG_LOGIN to true will enable logging both in node.js and
# in your web browser's JavaScript console.
# this setting is intended for development and debugging purposes and shouldn't
# be turned on in production
export DEBUG_LOGIN=true

_test_npm=`which npm`
if [ "x${_test_npm}" == 'x' ]; then
    echo "ERROR: Node.js not installed"
    exit 1
fi

if [ ! -e node_modules ]; then
    echo "INFO: Required node.js modules are missing! Installing them now..."
    npm install
    if [ $? -eq 1 ]; then
      rm -rf node_modules
      echo "ERROR: npm cannot get the required node.js modules!"
      echo "ERROR: If you need a proxy to reach the internet configure npm to use it with:"
      echo "ERROR:   npm config set proxy='<proxy_url>'"
      echo "ERROR:   npm config set https-proxy='<proxy_url>'"
      exit 1
    fi
fi

npm start
