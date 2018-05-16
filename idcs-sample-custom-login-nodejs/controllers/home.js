/**
 *
 * @author IJ <Indranil Jha>
 */

var secrets = require('../config/secrets');
var authController = require('./auth');

IDCSRestClient = require('node-rest-client').Client
var anonclient = new IDCSRestClient();

exports.index = function(req, res) {
  res.redirect('/login');
};

exports.welcome = function(req, res) {
  res.send('welcome');
};



