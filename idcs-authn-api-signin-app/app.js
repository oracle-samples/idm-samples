
if ( (!process.env.IDCS_URL) ||
     (!process.env.IDCS_CLIENT_ID) ||
     (!process.env.IDCS_CLIENT_SECRET)) {
       console.error();
       console.error("ERROR!");
       console.error();
       console.error( "This app requires IDCS_URL, IDCS_CLIENT_ID, and IDCS_CLIENT_SECRET be set in the environment.");
       console.error( "HINT: If you're starting this from the command line use the run.sh or run.bat script.");
       console.error();
       
       process.exit(1);
}

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
// By including this up here we go get an AT as soon as we're started
// and if there's an exception (e.g. the hostname, client ID or secret are bad)
// then it will throw an exception and we'll shutdown gracefully.
var oauth = require('./helpers/oauth');

var indexRouter = require('./routes/index');

var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

module.exports = app;
