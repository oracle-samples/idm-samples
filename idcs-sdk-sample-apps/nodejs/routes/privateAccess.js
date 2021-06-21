/*
 *  Copyright (c) 2000, 2021, Oracle and/or its affiliates.
 *
 *   Licensed under the Universal Permissive License v 1.0 as shown at
 *   http://oss.oracle.com/licenses/upl.
 */

var express = require('express');
var router = express.Router();

// Get Homepage
router.get('/home', function(req, res){
	res.render('home');
});

// Get Homepage
router.get('/myProfile', function(req, res){
	res.render('myProfile');
});

// Get Homepage
router.get('/appDetails', function(req, res){
	res.render('appDetails');
});

module.exports = router;
