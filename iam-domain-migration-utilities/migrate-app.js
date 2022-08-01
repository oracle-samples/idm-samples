/*
 * Utility for inspecting an app from the source, determining dependencies,
 * then creating the matching config in the target IAM instance.
 * 
 * Assumptions: Users and Groups will already have been created in the
 * target IAM Domain. Also that the client has App Admin + User Admin 
 * permissions.
 * 
 * This utility works for OAuth Client apps and SAML Apps. Enterprise Apps 
 * using App Gateways could probably be handled, but given additional gateway
 * deployments would be required, a straight migration is difficult.
 * 
 * This handles dependencies between apps, and also network perimeters. It 
 * doesn't associate the apps with sign-on policies though.
 * 
 */
import log4js from 'log4js';
const logger = log4js.getLogger();
const consoleLogger = log4js.getLogger("console");

import { filterCreateBody, IamUtil } from './iam-util.js';

//Magic number definitons (though I am not sure who I am kidding,
//there are magic attributes based on the IAM Schema all through this)
const IDCSAPPID = "IDCSAppId";
const SAMLSCHEMA = "urn:ietf:params:scim:schemas:oracle:idcs:extension:samlServiceProvider:App";
const DEFAULTTOU = "DefaultTermsOfUse";

const INVALIDAPP = "AppTypeInvalid";
const OAUTHAPP = "AppTypeOAuth";
const SAMLAPP = "AppTypeSAML";


//On dryrun, just document, don't actually create
async function migrateApp(iam, appId, dryRun, newIds, setInactive) {
  if (typeof appId != 'string') {
    //Being treated as a number?
    appId = "" + appId;
  }
  appId = appId.trim();
  //Valdate the parameters
  //App IDs are type 4 UUID with no spaces in lower case
  //^[0-9a-f]{12}-4[0-9a-f]{3}[89ab][0-9a-f]{15}$
  if (!appId.match(/^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/)) {
    logger.error("Invalid AppId provided.");
    return;
  }
  //Get the app information
  var sourceApp = await iam.getAppInfo("source", appId);
  //Initialise the list of objects to migrate (doesn't need to be done here,
  //but it helps to visualise)
  var resourcesToMigrate = {
    apps: [sourceApp],
    networkPerimeters: [],
    mappingAttributes: [],
    grants: [],
    tou: [],
    touStatements: []
  };
  //Validate the App is supported
  switch (getMigrationType(sourceApp)) {
    case OAUTHAPP:
      resourcesToMigrate = await getOAuthAppResources(iam, resourcesToMigrate, newIds);
      break;
    case SAMLAPP:
      resourcesToMigrate = await getSAMLAppResouces(iam, resourcesToMigrate);
      break;
    case INVALIDAPP:
    default:
      logger.error("App is currently unsupported for migration.");
      return;
  }
  if (setInactive) {
    resourcesToMigrate = setAppsInactive(resourcesToMigrate);
  }
  //Handle common resources - Terms of Use/Grants
  resourcesToMigrate = await getTermsOfUse(iam, resourcesToMigrate);
  //Handle Grants to the app - just groups, but we need to map by display name
  resourcesToMigrate = await getGrantResources(iam, resourcesToMigrate);
  //Once we have the list of resources - create them!
  var newAppId = await createResources(iam, "target", resourcesToMigrate, dryRun);
  return newAppId;
}

//OAuth Apps have resource apps and network perimeters
async function getOAuthAppResources(iam, resourcesToCreate, newIds, setInactive) {
  //Determine app resource dependencies
  resourcesToCreate = await getOAuthAppDependencies(iam, "source", resourcesToCreate.apps[0], resourcesToCreate);
  //Clear out the app Client Ids so they get regenerated in the target
  if (newIds) {
    resourcesToCreate = removeClientIds(resourcesToCreate);
  }
  //Check if the resources already exist on the other side
  resourcesToCreate = await removeDuplicateApps(iam, "target", resourcesToCreate);
  resourcesToCreate = await removeDuplicatePerimeters(iam, "target", resourcesToCreate);
  return await relinkGrantedAppRoles(iam, "target", resourcesToCreate);
}

//SAML apps have an 'outboundAssertionAttributes' which includes the mapping
async function getSAMLAppResouces(iam, resourcesToCreate, setInactive) {
  if (resourcesToCreate.apps[0][SAMLSCHEMA].outboundAssertionAttributes?.value) {
    resourcesToCreate.mappingAttributes.push(
      await iam.getAssertionAttributeInfo("source", resourcesToCreate.apps[0][SAMLSCHEMA].outboundAssertionAttributes.value)
    );
  }
  return resourcesToCreate;
}

async function getGrantResources(iam, resourcesToCreate) {
  if (!resourcesToCreate.apps) {
    return resourcesToCreate;
  }
  //Initialise if needed (this may be populated due to Admin Roles)
  resourcesToCreate.grants = resourcesToCreate.grants || [];
  for (let app of resourcesToCreate.apps) {
    let groupsForApp = await getGroupsGrantedToApp(iam, "source", app.id);
    let grantsToCreate = await getGrantResourcesFromGroups(iam, "target", app.id, groupsForApp);
    resourcesToCreate.grants = resourcesToCreate.grants.concat(grantsToCreate);
  }
  return resourcesToCreate;
}

async function getTermsOfUse(iam, resourcesToCreate) {
  if (!resourcesToCreate.apps) {
    return resourcesToCreate;
  }
  resourcesToCreate.tou = [];
  resourcesToCreate.touStatements = [];
  //Little cache for terms of use to prevent multiple calls
  var touInTarget = {};
  for (let app of resourcesToCreate.apps) {
    //If Default, then we don't need to create anything
    if (!app.termsOfUse || app.termsOfUse.value == DEFAULTTOU) {
      continue;
    }
    //Check if we are already creating it...
    let newTou = true;
    for (var tou of resourcesToCreate.tou) {
      if (app.termsOfUse.value == tou.id) {
        newTou = false;
        break;
      }
    }
    if (!newTou) {
      continue;
    }
    let termsOfUse = await iam.getTermsOfUseInfo("source", app.termsOfUse.value);
    //Check if the TOU exists in the target - I guess match on Name?
    //Check our saved reference.
    if (touInTarget[termsOfUse.name]) {
      app.termsOfUse.value = touInTarget[termsOfUse.name];
      continue;
    }
    let termOfUseInTarget = await iam.getTermsOfUseByName("target", termsOfUse.name);
    if (termOfUseInTarget) {
      //Relink the term of use in the app
      app.termsOfUse.value = termOfUseInTarget.id;
      //Cache the ID, incase this in other apps
      touInTarget[termsOfUse.name] = termOfUseInTarget.id;
      continue;
    }
    //Add the TOU to our resources to create
    resourcesToCreate.tou.push(termsOfUse);
    //Get the statements from this ToU
    for (let statement of termsOfUse.statements) {
      let newStatement = true;
      for (let toCreateStatement of resourcesToCreate.touStatements) {
        if (statement.value == toCreateStatement.id) {
          newStatement = false;
          break;
        }
      }
      if (newStatement) {
        resourcesToCreate.touStatements.push(await iam.getTermsOfUseStatementInfo("source", statement.value));
      }
    }
  }
  return resourcesToCreate;
}



//Check if we currently support the app type - need to tweak this as the
//utility is enhanced. 
//Just supporting OAuth Clients for now (Resources should be based upon 
//the consuming client), SAML is probably TODO.
function getMigrationType(sourceApp) {
  if (!sourceApp) {
    logger.error("App is null, likely no app returned from IAM.")
    return INVALIDAPP;
  }
  //OPC Apps are out for now. That isn't how they work.
  if (sourceApp.isOPCService != undefined && sourceApp.isOPCService) {
    logger.error("OPC Apps aren't supported for migration, as they have external dependencies.");
    return INVALIDAPP;
  }
  //SAML Apps need a different approach
  if (sourceApp.isSamlServiceProvider != undefined && sourceApp.isSamlServiceProvider) {
    return SAMLAPP;
  }
  //Make sure this is a client
  if (sourceApp.isOAuthClient != undefined && !sourceApp.isOAuthClient) {
    logger.error("OAuth Clients are the only app type currently supported for migration.");
    return INVALIDAPP;
  }
  //More checks...
  return OAUTHAPP;
}

//Check the 'allowedScopes' of the app and add the ids to apps to be created
//Recurse if needed.
async function getOAuthAppDependencies(iam, instance, app, resourcesToCreate) {
  logger.debug("Getting Dependencies based upon resources for app " + app.displayName + " from source...");
  let appDependencies = resourcesToCreate;
  //Resources are in the App body - 'allowedScopes'  
  if (app.allowedScopes && app.allowedScopes.length > 0) {
    //Allowed scopes includes the 'idOfDefiningApp', so we can grab the other
    //app from the source. Need to check for self-reference though.
    let invalidScopes = [];
    for (let scope of app.allowedScopes) {
      let newApp = true;
      for (let resourceApp of appDependencies.apps) {
        //Are we already planning ot create this app?
        if (resourceApp.id == scope.idOfDefiningApp) {
          newApp = false;
          break;
        }
      }
      if (newApp) {
        let dependentApp = await iam.getAppInfo(instance, scope.idOfDefiningApp);
        //Check if the resource app is an OPC app, since we can't migrate those.
        if (dependentApp.isOPCService) {
          logger.warn("App " + app.id + " includes a scope from an OPC service. "
            + "OPC Services cannot be migrated using this utility. The scope will not be "
            + "migrated to the target IAM instance. The App will need to be configured to "
            + "use the OPC Service scope registered with the target IAM instance after creation.");
          invalidScopes.push(scope.fqs);
        } else {
          //Recurse to get the dependencies of this app
          let recurseResources = { apps: appDependencies.apps.concat([dependentApp]), networkPerimeters: appDependencies.networkPerimeters };
          appDependencies = await getOAuthAppDependencies(iam, instance, dependentApp, recurseResources);
        }
      }
    }
    //Remove the invalid scopes
    for (let invalidScope of invalidScopes) {
      for (let appScope in app.allowedScopes) {
        if (app.allowedScopes[appScope].fqs == invalidScope) {
          app.allowedScopes.splice(appScope, 1);
          break;
        }
      }
    }
  }
  //Network Sources are in 'appsNetworkPerimeters'
  if (app.appsNetworkPerimeters && app.appsNetworkPerimeters.length > 0) {
    for (let perimeter of app.appsNetworkPerimeters) {
      let newPerimeter = true;
      for (let existingPerimeter of appDependencies.networkPerimeters) {
        //Are we already planning to create this perimeter?
        if (existingPerimeter.id == perimeter.value) {
          newPerimeter = false;
          break;
        }
      }
      if (newPerimeter) {
        let perimeterInfo = await iam.getNetworkPerimeterInfo(instance, perimeter.value);
        appDependencies.networkPerimeters.push(perimeterInfo);
      }
    }
  }
  return appDependencies;
}

//Don't want to recreate existing things.
//FQS is unique in the Domain, so good option to match on.
//Doesn't catch the client, but shouldn't need to, since that is the
//app being migrated.
async function removeDuplicateApps(iam, instance, resources) {
  logger.debug("Checking if apps already exist in " + instance + "...");
  //Get a list of fqs, one per app. This could have issues if existing apps
  //in the target have a subset of fqs. Don't do that.
  let fqs = [];
  for (let app of resources.apps) {
    if (app.scopes && app.scopes.length > 0) {
      fqs.push(app.scopes[0].fqs);
    }
  }
  if (fqs.length == 0) {
    logger.debug("No resource apps to be created.")
    return resources;
  }
  //Check for whether the scopes exist in the target.
  let filter = fqs.map(scope => { return "scopes[fqs eq \"" + scope + "\"]" }).join(" or ");
  let options = {
    url: '/admin/v1/Apps?attributes=audience&count=1000&filter=' + filter,
    method: "GET"
  };
  logger.trace("Invoking IAM to get existing resources using request:");
  logger.trace(JSON.stringify(options, null, 2));
  let appsInTarget = await iam.callIamEndpoint(instance, options)
  logger.trace("Apps with matching scopes...");
  logger.trace(JSON.stringify(appsInTarget, null, 2));
  //If no clash, all good, we can just create the apps passed in
  if (appsInTarget.totalResults == 0) {
    logger.debug("No resource apps already exist in the target.")
    return resources;
  }
  //Otherwise we need to remove clashing apps - there is probably a neater
  //way to do this. We will match on audience
  for (let clashingApp of appsInTarget.Resources) {
    for (let appIndex in resources.apps) {
      if (clashingApp.audience == resources.apps[appIndex].audience) {
        resources.apps.splice(appIndex, 1);
      }
    }
  }
  return resources;
}

//Don't want to recreate existing things. 
//There isn't an easy way to catch perimeters, so we are going to
//use 'name' - but that isn't strictly unique.
async function removeDuplicatePerimeters(iam, instance, resources) {
  logger.debug("Checking if network perimeters already exist in " + instance + "...");
  //Get a list of fqs, one per app. This could have issues if existing apps
  //in the target have a subset of fqs. Don't do that.
  let perimetersNames = [];
  for (let perimeter of resources.networkPerimeters) {
    if (perimeter.name) {
      perimetersNames.push(perimeter.name);
    }
  }
  if (perimetersNames.length == 0) {
    logger.debug("No Network Perimeters to be created.")
    return resources;
  }
  //Check for whether the scopes exist in the target.
  let filter = perimetersNames.map(name => { return "name eq \"" + name + "\"" }).join(" or ");
  let options = {
    url: '/admin/v1/NetworkPerimeters?attributes=name&count=1000&filter=' + filter,
    method: "GET"
  };
  logger.trace("Invoking IAM to get existing resources using request:");
  logger.trace(JSON.stringify(options, null, 2));
  let perimetersInTarget = await iam.callIamEndpoint(instance, options);
  logger.trace("Perimeters with matching names...");
  logger.trace(JSON.stringify(perimetersInTarget, null, 2));
  //If no clash, all good, we can just create the apps passed in
  if (perimetersInTarget.totalResults == 0) {
    logger.debug("No required Network Perimeters already exist in the target.")
    return resources;
  }
  //Otherwise we need to remove clashing perimeters and relink - there is probably 
  //a neater way to do this. 
  for (let targetPerimeter of perimetersInTarget.Resources) {
    for (let perimeterIndex in resources.networkPerimeters) {
      if (targetPerimeter.name == resources.networkPerimeters[perimeterIndex].name) {
        //Relink the apps which use this
        for (let app of resources.apps) {
          if (app.appsNetworkPerimeters) {
            for (let appPerimeter of app.appsNetworkPerimeters) {
              if (appPerimeter.value == resources.networkPerimeters[perimeterIndex].id) {
                appPerimeter.value = targetPerimeter.id;
              }
            }
          }
        }
        resources.networkPerimeters.splice(perimeterIndex, 1);
      }
    }
  }
  return resources;
}

async function getGroupsGrantedToApp(iam, instance, appId) {
  logger.debug("Getting Grants associated with app " + appId + " from instance " + instance + "...");
  //Get the grants to groups associated with the app
  let options = {
    url: '/admin/v1/Grants?filter=app.value eq "' + appId +
      '" and grantMechanism eq "ADMINISTRATOR_TO_GROUP"' +
      '&attributes=grantee.value',
    method: "GET"
  };
  logger.trace("Invoking IAM to get Grants for: " + appId + " with request:");
  logger.trace(JSON.stringify(options, null, 2));
  let grants = await iam.callIamEndpoint(instance, options);
  logger.debug("Got grants info for " + appId + ".");
  logger.trace(JSON.stringify(grants, null, 2));
  //Get the names of the group from the source
  let groupIds = [];
  if (!grants.Resources || grants.Resources.length == 0) {
    return groupIds;
  }
  for (let grant of grants.Resources) {
    groupIds.push(grant.grantee.value);
  }
  let filter = groupIds.map(id => { return "id eq \"" + id + "\"" }).join(" or ");
  options = {
    url: '/admin/v1/Groups?filter=' + filter + '&attributes=displayName',
    method: "GET"
  };
  logger.trace("Invoking IAM to get Groups associated with: " + appId + " with request:");
  logger.trace(JSON.stringify(options, null, 2));
  let groupJSON = await iam.callIamEndpoint(instance, options);
  logger.debug("Got groups info for " + appId + ".");
  logger.trace(JSON.stringify(groupJSON, null, 2));
  return groupJSON.Resources.map(group => { return group.displayName });
}

async function getGrantResourcesFromGroups(iam, instance, appId, groupNames) {
  logger.debug("Assembling grants for app " + appId + " to create in " + instance + " instance...");
  if (!groupNames || groupNames.length == 0) {
    logger.debug("No Groups assigned to app. No Grants required.");
    return [];
  }
  //Get the ids of the groups in the target based upon the displayNames in the sources
  let filter = groupNames.map(name => { return "displayName eq \"" + name + "\"" }).join(" or ");
  let options = {
    url: '/admin/v1/Groups?filter=' + filter + '&attributes=id',
    method: "GET"
  };
  logger.trace("Invoking IAM to get Groups by display name with request:");
  logger.trace(JSON.stringify(options, null, 2));
  let groupJSON = await iam.callIamEndpoint(instance, options);
  logger.debug("Got groups info from " + instance + ".");
  logger.trace(JSON.stringify(groupJSON, null, 2));
  return groupJSON.Resources.map(group => {
    return {
      app: {
        value: appId
      },
      grantMechanism: "ADMINISTRATOR_TO_GROUP",
      schemas: ["urn:ietf:params:scim:schemas:oracle:idcs:Grant"],
      grantee: {
        value: group.id,
        type: "Group",
      }
    };
  });
}


//Check the granted app roles for the to-be-created apps
async function relinkGrantedAppRoles(iam, instance, resources) {
  logger.debug("Relinking IDCS Admin roles using the " + instance + " role ids...");
  //Little cache
  var roleMappings = {};
  var roleMappingsPopulated = false;
  for (let app of resources.apps) {
    if (app.grantedAppRoles && app.grantedAppRoles.length > 0) {
      let newRoles = [];
      for (let role of app.grantedAppRoles) {
        //Ignore non-IAM Admin roles, using the magic IDCS ID
        if (role.appId != "IDCSAppId") {
          continue;
        }
        if (roleMappings[role.display]) {
          newRoles.push(roleMappings[role.display]);
        } else {
          if (roleMappingsPopulated) {
            //Cache miss, so we are going to skip this...
            continue;
          }
          //Get the role ids from the target IAM
          let options = {
            url: '/admin/v1/AppRoles?attributes=displayName&filter=app.value eq "' + IDCSAPPID + '"',
            method: "GET"
          };
          let rolesFromTarget = await iam.callIamEndpoint(instance, options);
          logger.debug("Got Admin roles from " + instance + " instance.");
          logger.trace(JSON.stringify(rolesFromTarget, null, 2));
          //Put these in our object
          for (let roleFromTarget of rolesFromTarget.Resources) {
            roleMappings[roleFromTarget.displayName] = roleFromTarget.id;
          }
          roleMappingsPopulated = true;
          if (roleMappings[role.display]) {
            newRoles.push(roleMappings[role.display]);
          }
        }
      }
      //Iterate through newRoles and create Grants
      if (!resources.grants) {
        resources.grants = [];
      }
      resources.grants = resources.grants.concat(newRoles.map(roleId => {
        return {
          app: {
            value: IDCSAPPID
          },
          grantMechanism: "ADMINISTRATOR_TO_APP",
          schemas: ["urn:ietf:params:scim:schemas:oracle:idcs:Grant"],
          grantee: {
            value: app.id,
            type: "App",
          },
          entitlement: {
            attributeName: "appRoles",
            attributeValue: roleId
          }
        };
      }));
    }
  }
  return resources;
}

//Strip out the client id from the OAuth apps
function removeClientIds(resources) {
  logger.debug("Removing Client Ids from OAuth Apps...");
  for (let app of resources.apps) {
    if (app.isOAuthClient) {
      delete app.name;
    }
  }
  return resources;
}

//Set all apps to be created as 'Inactive'
function setAppsInactive(resources) {
  logger.debug("Setting Apps as Inactive...");
  for (let app of resources.apps) {
    app.active = false;
  }
  return resources;
}

async function createResources(iam, instance, resources, dryRun) {
  logger.debug("Creating resources in " + instance + "...");
  if (resources.apps && Array.isArray(resources.apps)) {
    logger.debug("Apps to create:");
    for (var appToCreate of resources.apps) {
      logger.debug(appToCreate.id + " - " + appToCreate.displayName);
    }
  }
  if (resources.networkPerimeters && Array.isArray(resources.networkPerimeters)) {
    logger.debug("Network Perimeters to create:");
    for (var perimeterToCreate of resources.networkPerimeters) {
      logger.debug(perimeterToCreate.id + " - " + perimeterToCreate.name);
    }
  }
  if (resources.mappingAttributes && Array.isArray(resources.mappingAttributes)) {
    logger.debug("Mapped Attributes to create:");
    for (var mappingToCreate of resources.mappingAttributes) {
      logger.debug(mappingToCreate.id);
    }
  }
  if (resources.grants && Array.isArray(resources.grants)) {
    logger.debug("Grants to create: " + resources.grants?.length);
  }
  if (resources.tou && Array.isArray(resources.tou)) {
    logger.debug("Terms of Use to create:");
    for (var touToCreate of resources.tou) {
      logger.debug(touToCreate.id);
    }
  }
  if (resources.touStatements && Array.isArray(resources.touStatements)) {
    logger.debug("Terms of Use Statements to create:");
    for (var statementToCreate of resources.touStatements) {
      logger.debug(statementToCreate.id);
    }
  }
  //Assemble Bulk request
  var bulkRequest = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
    Operations: []
  };
  var patchBulkRequest = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
    Operations: []
  };
  //ToU Statements
  for (let statement in resources.touStatements) {
    bulkRequest.Operations.push({
      method: "POST",
      path: "/TermsOfUseStatements",
      bulkId: "statementId" + statement,
      data: filterCreateBody(resources.touStatements[statement])
    });
  }
  //Terms of Use
  for (let tou in resources.tou) {
    for (let statement of resources.tou[tou].statements) {
      //Link to the statement creation bulkId
      for (let touStatement in resources.touStatements) {
        if (resources.touStatements[touStatement].id == statement.value) {
          statement.value = "bulkId:statementId" + touStatement;
          break;
        }
      }
    }
    bulkRequest.Operations.push({
      method: "POST",
      path: "/TermsOfUses",
      bulkId: "touId" + tou,
      data: filterCreateBody(resources.tou[tou])
    });
  }
  //Network Perimeters
  for (let perimeter in resources.networkPerimeters) {
    bulkRequest.Operations.push({
      method: "POST",
      path: "/NetworkPerimeters",
      bulkId: "perimId" + perimeter,
      data: filterCreateBody(resources.networkPerimeters[perimeter])
    });
  }
  //Apps
  for (let app in resources.apps) {
    //Need to link the Network perimeter to the BulkId.
    if (resources.apps[app].appsNetworkPerimeters && resources.apps[app].appsNetworkPerimeters.length > 0) {
      for (var appPerimeter of resources.apps[app].appsNetworkPerimeters) {
        for (var perimeter in resources.networkPerimeters) {
          if (appPerimeter.value == resources.networkPerimeters[perimeter].id) {
            appPerimeter.value = "bulkId:perimId" + perimeter;
            break;
          }
        }
      }
    }
    //Need to link the Terms of Use to the app
    if (resources.apps[app].termsOfUse) {
      for (let tou in resources.tou) {
        if (resources.apps[app].termsOfUse.value == resources.tou[tou].id) {
          resources.apps[app].termsOfUse.value = "bulkId:touId" + tou;
          break;
        }
      }
    }
    //Need to grab the allowedScopes use BulkId to patch them in.
    if (resources.apps[app].allowedScopes && resources.apps[app].allowedScopes.length > 0) {
      let scopes = [];
      for (let scope of resources.apps[app].allowedScopes) {
        let scopeAdded = false;
        for (let resourceApp in resources.apps) {
          if (resources.apps[resourceApp].id == scope.idOfDefiningApp) {
            //Need to check if self-referential resources cause issues...
            scope.idOfDefiningApp = "bulkId:appId" + resourceApp;
            scopes.push(scope);
            scopeAdded = true;
            break;
          }
        }
        if (!scopeAdded) {
          scopes.push(scope);
        }
      }
      //Looks like this needs to be split out into a second call?
      patchBulkRequest.Operations.push({
        method: "PATCH",
        path: "/Apps/bulkId:appId" + app,
        data: {
          schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
          Operations: [
            {
              "op": "add",
              "path": "allowedScopes",
              "value": scopes
            }
          ]
        }
      });
    }
    //Grab any mapped attributes (for SAML apps to patch in)
    if (resources.apps[app][SAMLSCHEMA]?.outboundAssertionAttributes?.value) {
      for (var mappingAttribute of resources.mappingAttributes) {
        if (mappingAttribute.id == resources.apps[app][SAMLSCHEMA].outboundAssertionAttributes.value) {
          patchBulkRequest.Operations.push({
            method: "PATCH",
            path: "/MappedAttributes/bulkId:appId" + app,
            data: {
              schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
              Operations: [
                {
                  "op": "replace",
                  "path": "attributeMappings",
                  "value": mappingAttribute.attributeMappings
                }
              ]
            }
          });
        }
      }
    }
    bulkRequest.Operations.push({
      method: "POST",
      path: "/Apps",
      bulkId: "appId" + app,
      data: filterCreateBody(resources.apps[app])
    });
  }
  //Grants
  for (let grant in resources.grants) {
    //Need to relink the assigned app by bulkId, again, there are probably
    //nicer data structures, but I doubt there is ever going to be more than
    //4-odd apps.
    if (resources.grants[grant].grantee.type == 'App') {
      //Admin role mapping
      for (let app in resources.apps) {
        if (resources.apps[app].id == resources.grants[grant].grantee.value) {
          resources.grants[grant].grantee.value = "bulkId:appId" + app
        }
      }
    } else {
      //Group mappings
      for (let app in resources.apps) {
        if (resources.apps[app].id == resources.grants[grant].app.value) {
          resources.grants[grant].app.value = "bulkId:appId" + app
        }
      }
    }

    bulkRequest.Operations.push({
      method: "POST",
      path: "/Grants",
      bulkId: "grantId" + grant,
      data: filterCreateBody(resources.grants[grant])
    });
  }
  let options = {
    url: '/admin/v1/Bulk',
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bulkRequest)
  };
  if (dryRun) {
    //Pretty up for display
    options.body = bulkRequest;
    options.headers["Authorization"] = "Bearer ...";
    consoleLogger.info("Running in Dryrun mode, so not creating any resources in the target.");
    consoleLogger.info("The following request would have been made to create the app and dependencies:");
    consoleLogger.info("------- START REQUEST -------");
    consoleLogger.info(JSON.stringify(options, null, 2));
    consoleLogger.info("------- END REQUEST -------");
    let patchBulkoptions = {
      url: '/admin/v1/Bulk',
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ...'
      },
      body: patchBulkRequest
    };
    consoleLogger.info("This followup request would have linked together the resources across the apps:")
    consoleLogger.info("------- START REQUEST -------");
    consoleLogger.info(JSON.stringify(patchBulkoptions, null, 2));
    consoleLogger.info("------- END REQUEST -------");
    return "new-app-id";
  } else {
    logger.debug("Preparing to send Bulk request to " + instance + "...");
    logger.trace(JSON.stringify(options, null, 2));
    let bulkResult = await iam.callBulkEndpoint(instance, options);
    //Extract the ids from the response in order to populate the PATCH request
    let idMapping = {};
    if (bulkResult && bulkResult.Operations && bulkResult.Operations.length > 0) {
      for (let operation of bulkResult.Operations) {
        if (operation.bulkId && operation.status.startsWith("2")) {
          //Take advantage of fixed ID formats...
          idMapping[operation.bulkId] = operation.location.slice(-32);
        }
      }
    }
    if (patchBulkRequest.Operations && patchBulkRequest.Operations.length > 0) {
      for (let operation of patchBulkRequest.Operations) {
        if(!operation.path.startsWith("/MappedAttributes")){
          //Replace the path
          let bulkId = operation.path.match(/bulkId:[^\/]*/g);
          if (bulkId) {
            operation.path = operation.path.replace(bulkId[0], idMapping[bulkId[0].slice(7)]);
          }
          //Replace the allowed scopes
          for (let scopeOp of operation.data.Operations[0].value) {
            if (scopeOp.idOfDefiningApp?.startsWith("bulkId:")) {
              scopeOp.idOfDefiningApp = idMapping[scopeOp.idOfDefiningApp];
            }
          }
        }
      }
      //Handle Outbound Assertion Attributes, which are really annoying for some reason...
      for (let operation of patchBulkRequest.Operations) {
        if(operation.path.startsWith("/MappedAttributes")){
          //Get the new appId
          let appId = idMapping[operation.path.slice(25)]
          //Get the newly created app to obtain the new Mapping Attribute reference
          let options = {
            url: '/admin/v1/Apps/' +appId +"?attributes=" +SAMLSCHEMA +":outboundAssertionAttributes.value",
            method: "GET"
          }
          logger.default("Getting newly created app from " +instance +" in order to configure attribute mappings...")
          let appInfo = await iam.callIamEndpoint(instance, options);
          operation.path = "/MappedAttributes/" +appInfo[SAMLSCHEMA].outboundAssertionAttributes.value;
        }
      }
    }
    
    //Now send the patch request
    let patchBulkoptions = {
      url: '/admin/v1/Bulk',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchBulkRequest)
    };
    logger.debug("Preparing to send Bulk request to " + instance + " to relink created objects...");
    logger.trace(JSON.stringify(patchBulkoptions, null, 2));
    await iam.callBulkEndpoint(instance, patchBulkoptions);
    logger.debug("Objects relinked - App Migrated!");
    return idMapping["bulkId:appId0"];
  }
}

async function cliHandler(argv) {
  //Set logging levels
  switch (argv.verbose) {
    case 0:
      //Defer to envrionment, or default 'warn'
      logger.level = process.env.log_level || "warn";
      break;
    case 1:
      logger.level = 'debug';
      break;
    case 2:
      logger.level = 'trace';
      break;
    default:
      //So many 'verbose' flags!
      logger.level = 'trace';
      break;
  }
  let iamUtil = new IamUtil(argv["config"]);
  await iamUtil.initialise();
  await migrateApp(iamUtil, argv["app-id"], argv["dry-run"], !argv["preserve-ids"], argv["set-inactive"]);
}

//Yargs wrapper for CLI use
const migrateAppCommand = {
  command: "migrate-app <app-id> [options]",
  describe: "Create a copy of an app and dependencies in the target",
  builder: {
    "preserve-ids": {
      default: false,
      type: 'boolean',
      describe: "Don't generate a new client id for the apps"
    },
    "set-inactive": {
      default: false,
      type: 'boolean',
      describe: "Create the App(s) in an inactive state"
    }
  },
  handler: cliHandler
}

export { migrateAppCommand };