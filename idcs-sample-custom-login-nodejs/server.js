/**
 *
 * @author IJ <Indranil Jha>
 */

global.idcstoken = null;

var express = require('express');
var path = require('path');
var fs = require('fs');
//var https = require('https');
var http = require('http');
var session = require('express-session');
var bodyParser = require("body-parser");

var secrets = require('./config/secrets');
var homeController = require('./controllers/home');
var authController = require('./controllers/auth');


process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var PORT = process.env.PORT || 9088;
var app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

var router = express.Router();

router.get('/', homeController.index);
router.get('/welcome', homeController.welcome);
router.get('/getConfigData', authController.getConfigData);
router.get('/getLoginContext', authController.getLoginContext);
router.get('/getGlobalToken', authController.getGlobalToken);
router.get('/getCurrentAuthnToken', authController.getCurrentAuthnToken);
router.post('/signin', authController.dologin);
router.post('/signinerror', authController.handleSigninError);


app.use('/api', router);

authController.idcsanon();

var server = http.createServer(app).listen(PORT, function () {
  console.log('Example app listening at http://%s:%s',
    server.address().address, server.address().port);
});
