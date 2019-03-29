//Author: Felippe Oliveira
//Oracle Corporation

module.exports = function(app) {

  var users = require('../controllers/user.controller.js');

  //Get operation for /Users endpoint
  app.get('/scimgate/Users', users.findAll);

  //Get operation for /Users endpoint
  app.get('/scimgate/Users/:id', users.findOne);

  //Post operation for /Users endpoint
  app.post('/scimgate/Users', users.create);

  //Put and Patch operation for /Users endpoint
  app.put('/scimgate/Users/:id', users.update);
  app.patch('/scimgate/Users/:id', users.update);

  //Delete operation for /Users endpoint
  app.delete('/scimgate/Users/:id', users.delete);

}
