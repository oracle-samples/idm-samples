//Author: Felippe Oliveira
//Oracle Corporation

module.exports = function(app){

  var groups = require('../controllers/group.controller.js');

  //Get operation for /Groups endpoint
  app.get('/scimgate/Groups', groups.findAll);

  //Get operation for /Groups endpoint
  app.get('/scimgate/Groups/:id', groups.findOne);

  //Post operation for /Groups endpoint
  app.post('/scimgate/Groups', groups.create);

  //Put and Patch operation for /Groups endpoint
  app.put('/scimgate/Groups/:id', groups.update);
  app.patch('/scimgate/Groups/:id', groups.update);

  //Delete operation for /Groups endpoint
  app.delete('/scimgate/Groups/:id', groups.delete);

}
