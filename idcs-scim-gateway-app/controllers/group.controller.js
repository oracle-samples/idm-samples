//Author: Felippe Oliveira
//Oracle Corporation

//Reference
const fs = require('graceful-fs');
const config = require('../config.js');

//Logs information.
var logger = require('../logging.js');
//basic-auth is used to validate basic authentication
var auth = require('basic-auth');
var users = require('./user.controller.js');
var groups = require('./group.controller.js');

//This variable is used to generate the ID for a new group entry in
// the groupdb.json file.
var sequenceNumber = 100;

//This function returns a list of all groups for the target system.
//The list is in JSON format and contains the attribute "resources" with the
// value of an array of JSON objects representing each group and their attributes.
exports.findAll = function(req, res){
  logger.log('-----------------');
  logger.log('Entering groups findAll function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('----');
  //Check credentials
  if(users.validateAdminCredentials(req, res)){
    groupIDStore = JSON.parse(fs.readFileSync('./groupdb.json', 'utf8'));
    logger.log('Found '+ groupIDStore.groups.length +' groups.');
    res.status(200).json(groupIDStore);
  }
}

//This function returns one group. The group ID is present in the URL, and the
// function searchs in the application group store for that group ID.
//Once found, the group information is send back as JSON message, containing
// all attributes and their values.
exports.findOne = function(req, res){
  logger.log('-----------------');
  logger.log('Entering groups findOne function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('--');
  if(users.validateAdminCredentials(req, res)){
    groupIDStore = JSON.parse(fs.readFileSync('./groupdb.json', 'utf8'));
    groupIDStore.groups.forEach(function(group, index) {
      if (group.id == req.params.id){
        logger.log('--Found group \''+ group.displayName +'\'');
        result = group;
        return group;
      }
    });
    res.status(200).json(result);
  }
}

//This function creates the group sent as JSON message in the request body.
//The user ID is generated and added to the JSON message before saving it
// in the identity store.
exports.create = function(req, res){
  logger.log('-----------------');
  logger.log('Entering groups create function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('--');
  if(users.validateAdminCredentials(req, res)){
    groupIDStore = JSON.parse(fs.readFileSync('./groupdb.json', 'utf8'));
    logger.log('--Base contains '+ groupIDStore.groups.length +' groups.');
    newGroup = req.body;
    if(!groups.groupExistsByUserName(groupIDStore.groups, newGroup.displayName)){
      logger.log('--This group doesn\'t exist in group ID Store.');
      id = sequenceNumber++;
      newGroup.id = ''+id
      newGroup.externalId = ''+id;
      groupIDStore.groups[groupIDStore.groups.length] = newGroup;
      fs.writeFileSync('./groupdb.json', JSON.stringify(groupIDStore, null, 2));
      logger.log('--Group \''+ newGroup.displayName  +'\' created.');
      res.status(201).json(newGroup);
    }else{
      logger.log('Group exists in ID Store.');
      res.status(400).json({'status':'Group '+ newGroup.displayName +' already exists.'});
    }
  }
}

//This function updates a group entry. The group ID is present in the URL, and the
// function searchs in the application group store for that group ID.
//Once found, the attributes that appear in the JSON request body have their values
// updated in the group store.
exports.update = function(req, res){
  logger.log('-----------------');
  logger.log('Entering groups update function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('--');
  if(users.validateAdminCredentials(req, res)){
    groupIDStore = JSON.parse(fs.readFileSync('./groupdb.json', 'utf8'));
    toUpdateGroup = req.body;
    if(groups.groupExistsByID(groupIDStore.groups, req.params.id)){
      groupIDStore.groups.forEach(function(group, index){
        if (group.id == req.params.id){
          logger.log('--Found group \''+ group.displayName +'\'');
          for(var myKey in toUpdateGroup){
            group[myKey]=toUpdateGroup[myKey];
          }
          fs.writeFileSync('./groupdb.json', JSON.stringify(groupIDStore, null, 2));
          logger.log('--Group \''+ group.displayName  +'\' updated.');
        }
      });
    }else{
      res.status(400).json({'status':'Group id '+ req.params.id +' doesn\'t exists.'});
    }
    res.status(200).json(toUpdateGroup);
  }
}

//This function updates a group entry. The user ID is present in the URL, and the
// function searchs in the application group store for that group ID.
//Once found, the entry is removed from the group store.
exports.delete = function(req, res){
  logger.log('-----------------');
  logger.log('Entering groups delete function.');
  logger.log('Body:');
  logger.log(req.body);
  logger.log('--');
  //Entering delete function.
  if(users.validateAdminCredentials(req, res)){
    groupIDStore = JSON.parse(fs.readFileSync('./groupdb.json', 'utf8'));
    if(groups.groupExistsByID(groupIDStore.groups, req.params.id)){
      groupIDStore.groups.forEach(function(group, index) {
        if (group.id == req.params.id){
          logger.log('--Found group \''+ group.displayName +'\'');
          for(var i in groupIDStore) {
            var groupEntry = groupIDStore[i];
            for(var j in groupEntry) {
              if (groupEntry[j].id == req.params.id){
                deletedGroup = groupEntry.splice(j,1);
                newGroupIDStore = {"groups": groupEntry}
                fs.writeFileSync('./groupdb.json', JSON.stringify(newGroupIDStore, null, 2));
                logger.log('--Deleted group \''+ deletedGroup[0].displayName +'\'');
                fs.close
                break;
              }
            }
          }
          res.status(200).json(deletedGroup[0]);
        }
      });
    }else{
      res.status(400).json({'status':'Group id '+ req.params.id +' doesn\'t exists.'});
    }
  }
}

//Internal function to search for a user by userName.
exports.groupExistsByUserName = function(array, displayName){
  logger.log('groups groupExistsByUserName() function');
  result = false;
  array.forEach(function(group, index) {
    if (group.displayName == displayName){
      result = true;
    }
  });
  return result;
}

//Internal function to search for a users by ID.
exports.groupExistsByID = function(array, id){
  logger.log('groups groupExistsByID() function');
  result = false;
  array.forEach(function(group, index) {
    if (group.id == id){
      result = true;
    }
  });
  return result;
}
