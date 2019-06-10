//Oracle Corporation

//Reference
const fs = require('graceful-fs');
const config = require('../config.js');
var users = require('./user.controller.js');
// let jwt = require('jsonwebtoken');

//Logs information.
var logger = require('../logging.js');
//basic-auth is used to validate basic authentication
var auth = require('basic-auth');

//This variable is used to generate the ID and externalId for a new user entry in
// the userdb.json file.
var sequenceNumber = 10;

//This function returns a list of all users for the target system.
//The list is in JSON format and contains the attribute "resources" with the
// value of an array of JSON objects representing each user and their attributes.
exports.findAll = function(req, res){
  res.setHeader("content-type", "application/scim+json");
  logger.log('-----------------');
  logger.log('Entering users findAll function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('----');
  //Check credentials
  if(users.authenticate(req, res)){
    userIDStore = JSON.parse(fs.readFileSync('./userdb.json', 'utf8'));
    logger.log('Found '+ userIDStore.resources.length +' users.');
    res.status(200).json(userIDStore);
  }
};

//This function returns one user. The user ID is present in the URL, and the
// function searchs in the application identity store for that user ID.
//Once found, the user information is send back as JSON message, containing
// all attributes and their values.
exports.findOne = function(req, res) {
  res.setHeader("content-type", "application/scim+json");
  logger.log('-----------------');
  logger.log('Entering users findOne function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('--');
  if(users.authenticate(req, res)){
    userIDStore = JSON.parse(fs.readFileSync('./userdb.json', 'utf8'));
    userIDStore.resources.forEach(function(user, index) {
      if (user.id == req.params.id){
        logger.log('--Found user \''+ user.displayName +'\'');
        result = user;
        return user;
      }
    });
    res.status(200).json(result);
  }
};

//This function creates the user sent as JSON message in the request body.
//The user ID is generated and added to the JSON message before saving it
// in the identity store.
exports.create = function(req, res){
  res.setHeader("content-type", "application/scim+json");
  logger.log('-----------------');
  logger.log('Entering users create function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('--');
  if(users.authenticate(req, res)){
    userIDStore = JSON.parse(fs.readFileSync('./userdb.json', 'utf8'));
    logger.log('--Base contains '+ userIDStore.resources.length +' users.');
    newUser = req.body;
    if(!users.userExistsByUserName(userIDStore.resources, newUser.userName)){
      logger.log('--This user doesn\'t exist in ID Store.');
      id = sequenceNumber++;
      newUser.id = ''+id
      newUser.externalId = ''+id;
      logger.log('---------------------NEW USER JSON------------------');
      logger.log(newUser);
      userIDStore.resources[userIDStore.resources.length] = newUser;
      logger.log('---------------------NEW ID STORE JSON------------------');
      logger.log(userIDStore);
      fs.writeFileSync('./userdb.json', JSON.stringify(userIDStore, null, 2));
      logger.log('--User \''+ newUser.userName  +'\' created.');
      res.status(201).json(newUser);
    }else{
      logger.log('User exists in ID Store.');
      res.status(400).json({'status':'User '+ newUser.userName +' already exists.'});
    }
  }
}

//This function updates a user entry. The user ID is present in the URL, and the
// function searchs in the application identity store for that user ID.
//Once found, the attributes that appear in the JSON request body have their values
// updated in the identity store.
exports.update = function(req, res){
  res.setHeader("content-type", "application/scim+json");
  logger.log('-----------------');
  logger.log('Entering users update function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('--');
  if(users.authenticate(req, res)){
    userIDStore = JSON.parse(fs.readFileSync('./userdb.json', 'utf8'));
    toUpdateUser = req.body;
    if(users.userExistsByID(userIDStore.resources, req.params.id)){
      userIDStore.resources.forEach(function(user, index){
        if (user.id == req.params.id){
          logger.log('--Found user \''+ user.displayName +'\'');
          for(var myKey in toUpdateUser){
            user[myKey]=toUpdateUser[myKey];
          }
          fs.writeFileSync('./userdb.json', JSON.stringify(userIDStore, null, 2));
          logger.log('--User \''+ user.userName  +'\' updated.');
        }
      });
    }else{
      res.status(400).json({'status':'User id '+ req.params.id +' doesn\'t exists.'});
    }
    res.status(200).json(toUpdateUser);
  }
}

//This function updates a user entry. The user ID is present in the URL, and the
// function searchs in the application identity store for that user ID.
//Once found, the entry is removed from the identity store.
exports.delete = function(req, res){
  res.setHeader("content-type", "application/scim+json");
  logger.log('-----------------');
  logger.log('Entering users delete function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('--');
  //Entering delete function.
  if(users.authenticate(req, res)){
    userIDStore = JSON.parse(fs.readFileSync('./userdb.json', 'utf8'));//require('../FullUserJSONRepresentation.json');
    if(users.userExistsByID(userIDStore.resources, req.params.id)){
      userIDStore.resources.forEach(function(user, index) {
        if (user.id == req.params.id){
          logger.log('--Found user \''+ user.displayName +'\'');
          for(var i in userIDStore) {
            var userEntry = userIDStore[i];
            for(var j in userEntry) {
              if (userEntry[j].id == req.params.id){
                deletedUser = userEntry.splice(j,1);
                newUserIDStore = {"resources": userEntry}
                fs.writeFileSync('./userdb.json', JSON.stringify(newUserIDStore, null, 2));
                logger.log('--Deleted user \''+ deletedUser[0].displayName +'\'');
                fs.close
                break;
              }
            }
          }
          res.status(200).json(deletedUser[0]);
        }
      });
    }else{
      res.status(400).json({'status':'User id '+ req.params.id +' doesn\'t exists.'});
    }
  }
}

//Internal function to search for a user by userName.
exports.userExistsByUserName = function(array, username){
  logger.log('users userExistsByUserName() function');
  result = false;
  array.forEach(function(user, index) {
    if (user.userName == username){
      result = true;
    }
  });
  return result;
}

//Internal function to search for a users by ID.
exports.userExistsByID = function(array, id){
  logger.log('users userExistsByID() function');
  result = false;
  array.forEach(function(user, index) {
    if (user.id == id){
      result = true;
    }
  });
  return result;
}

//Internal function that validates username and password against ADMINUSER and
// ADMINPASS environment variables.
exports.validateBasic = function(req, res) {
  logger.log('users.validateBasic() function');
  var credentials = auth(req);
  if (!credentials || !(process.env.ADMINUSER===credentials.name && process.env.ADMINPASS===credentials.pass)){
    logger.log('  Credentials not valid. Access denied.');
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="example"');
    res.json({ message: 'Credentials not valid. Access denied' });
    return false;
  }else{
    logger.log('  Credentials valid.');
    return true;
  }
}

  exports.validateToken = function(req, res) {
    logger.log('users.validateToken() function');
    var token = req.headers['authorization'];
    logger.log('  Header authorization: '+ token);
    if (token.startsWith('Bearer ')) {
      // Remove Bearer from string
      token = token.slice(7, token.length);
      logger.log('  Token value '+ token);
      if (token && process.env.BEARER_TOKEN === token) {
        logger.log('  Token valid.');
        return true;
      }else {
        logger.log('  Authorization bearer token invalid.');
        res.json({ message: 'Token not valid. Access denied' });
        return false;
      }
    }
  }

  exports.validateClientCredentials = function(req, res) {
    logger.log('users validateClientCredentials() function');
    return users.validateBasic(req, res);
  }

  exports.validateResourceOwner = function(req, res) {
    logger.log('users validateResourceOwner() function');
    return users.validateBasic(req, res);
  }

  exports.authenticate = function(req, res) {
	logger.log('users authenticate() function');
	var mode = process.env.MODE || 'basic';
	if (mode == 'basic'){
	 return users.validateBasic(req, res);
	}else if (mode == 'bearer') {
	return users.validateToken(req, res);
	}else if (mode == 'client_credentials') {
	 return users.validateClientCredentials(req, res);
	}else if (mode == 'resource_owner') {
	 return users.validateResourceOwner(req, res);
	}else {
	 return users.validateBasic(req, res);
	}
  }
