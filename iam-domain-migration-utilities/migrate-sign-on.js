/*
 * Utility for inspecting a sign-on policy from the source, determining dependencies,
 * then creating the matching config in the target IAM instance.
 * 
 * This doesn't handles assigning the Policy to apps
 * 
 */
import log4js from 'log4js';
const logger = log4js.getLogger();
const consoleLogger = log4js.getLogger("console");

import { IamUtil, filterCreateBody} from './iam-util.js';

//The default values which are used for SignOn
const DEFAULT_SIGNON_POLICY = "Default Sign-On Policy";
const DEFAULT_SIGNON_CONDITION = "DefaultSignOnCondition";
const DEFAULT_SIGNON_RULE = "DefaultSignOnRule";


const CONDITION_TYPE = "Condition";
const CONDITIONGROUP_TYPE = "ConditionGroup";
const DEFAULT_FACTOR_SETTINGS = "AuthenticationFactorSettings";
const DEFAULT_ADAPTIVE_ACCESS = "AdaptiveAccessSettings";

const UUIDRegex = new RegExp("[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}");

//To confirm - Factor names for Yubico, Phone Call and FIDO in Policies...
const FACTOR_MAPPINGS = {
  "SECURITY_QUESTIONS": "securityQuestionsEnabled",
  "TOPT": "totpEnabled",
  "EMAIL": "emailEnabled",
  "SMS": "smsEnabled",
  "BYPASSCODE": "bypassCodeEnabled",
  "PUSH": "pushEnabled",
  "YUBICO": "yubicoOtpEnabled",
  "PHONE": "phoneCallEnabled",
  "FIDO": "fidoAuthenticatorEnabled"
}


async function migratePolicy(iam, policyName, dryRun, force, ignoreIssues){
  if(policyName == DEFAULT_SIGNON_POLICY){
    if(force){
      logger.warn("Migrating the Default Sign-On Policy has the potential to lock you out of an instance. "
      +"If this has unintented results, use the 'reset-default-policy' command to load a permissive "
      +"sign-on policy to restore access to your instance and reconfigure the policy.")
    }else{
      logger.warn("Migrating the Default Sign-On Policy has the potential to lock you out of an instance. "
       +"This is especially true if that policy depends upon specific MFA factors or similar configuration "
       +"which is not migrated by this utility. If you are sure that you want to push the Default "+
       "Sign-On Policy to the target, run this again with the '--force' option.");
       if(dryRun){
        logger.warn("Proceeding with the dry run to test for issues.")
       }else{
        return;
       }
    }
  }
  let policyId = await iam.getPolicyIdByName("source", policyName);
  if(!policyId){
    logger.error("No Policy with that name found in the source system.");
    return;
  }
  let policy = await iam.getPolicyInfo("source", policyId);
  let resourcesToCreate = await getPolicyDependencies(iam, "source", policy);
  resourcesToCreate = await removeDuplicatePerimeters(iam, "target", resourcesToCreate);
  resourcesToCreate = await relinkIdentityProviders(iam, resourcesToCreate);
  //Check preconditions in target (Adaptive, MFA)?
  let issues = await validatePolicyDependencies(iam, "target", resourcesToCreate);
  for(let issue of issues){
    logger.warn(issue);
  }
  if(issues.length > 0 && !ignoreIssues){
    logger.warn("Issues need to be resolved before migration, aborting.");
    return;
  }
  //Create our resources
  //Check if the policy already exists in the target, so we can do an update if needed.
  let targetPolicyId = await iam.getPolicyIdByName("target", policyName);
  let targetPolicy;
  if(targetPolicyId){
    targetPolicy = await iam.getPolicyInfo("target", targetPolicyId);
  }
  await createResources(iam, "target", resourcesToCreate, dryRun, targetPolicyId, targetPolicy);
}


async function getPolicyDependencies(iam, instance, policy){
  let resourcesToCreate = {
    policies:[policy],
    rules:[],
    conditions:[],
    conditionGroups:[],
    networkPerimeters:[]
  };
  if(policy.rules){
    for(let policyRule of policy.rules){
      let rule = await iam.getRuleInfo(instance, policyRule.value);
      resourcesToCreate.rules.push(rule);
      if(rule.conditionGroup){
        //ConditionGroup can be of type 'Condition' or 'ConditionGroup'
        if(rule.conditionGroup.type == CONDITION_TYPE){
          let condition = await iam.getConditionInfo(instance, rule.conditionGroup.value);
          resourcesToCreate.conditions.push(condition);
        }else{
          let conditionGroup = await iam.getConditionGroupInfo(instance, rule.conditionGroup.value);
          resourcesToCreate.conditionGroups.push(conditionGroup);
          for(let groupCondition of conditionGroup.conditions){
            let condition = await iam.getConditionInfo(instance, groupCondition.value);
            resourcesToCreate.conditions.push(condition);
          }
        }
      }
    }
    for(let condition of resourcesToCreate.conditions){
      //Network perimeters are based upon an inline function, with the form:
      //"#inIPRange(\"<perimeter-id>\")"
      let networkPerimeterId = condition.attributeValue.match(/#inIPRange\(\"([0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15})\"\)/);
      if(networkPerimeterId){
        let perimeter = await iam.getNetworkPerimeterInfo(instance, networkPerimeterId[1]);
        resourcesToCreate.networkPerimeters.push(perimeter);
      }
    }
  }
  return resourcesToCreate;
}

//Don't want to recreate existing things. 
//There isn't an easy way to catch perimeters, so we are going to
//use 'name' - but that isn't strictly unique.
async function removeDuplicatePerimeters(iam, instance, resources) {
  logger.debug("Checking if network perimeters already exist in " + instance + "...");
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
    logger.debug("No required Network Perimeters already exist in the target.");
    return resources;
  }
  //Otherwise we need to remove clashing perimeters and relink - there is probably 
  //a neater way to do this.
  logger.debug("Perimeters exist in the target, relinking...") 
  for (let targetPerimeter of perimetersInTarget.Resources) {
    for (let perimeterIndex in resources.networkPerimeters) {
      if (targetPerimeter.name == resources.networkPerimeters[perimeterIndex].name) {
        //Relink the conditions which use this
        for (let condition of resources.conditions) {
          let networkPerimeterId = condition.attributeValue.match(/#inIPRange\(\"([0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15})\"\)/);
          if(networkPerimeterId && resources.networkPerimeters[perimeterIndex].id == networkPerimeterId[1]){
            condition.attributeValue = "#inIPRange(\"" +targetPerimeter.id +"\")";
          }
        }
        resources.networkPerimeters.splice(perimeterIndex, 1);
      }
    }
  }
  return resources;
}

//Check two aspects of Policy Dependencies, MFA factors and Adaptive Access
async function validatePolicyDependencies(iam, instance, resources){
  let issues = [];
  //Check if there is an MFA dependency
  let usesMFA = false;
  let factors = [];
  for(let rule of resources.rules){
    if(rule.return){
      for(let result of rule.return){
        if(result.name == "authenticationFactor" && result.value.includes("2FA")){
          usesMFA = true;
        }else if(result.name == "2FAFactors"){
          try{
            factors = factors.concat(JSON.parse(result.value).filter((v)=>{return v != "ANY"}));
          }catch(err){
            logger.warn("Error parsing specific factors in rule " +rule.name +". "
            +"Proceeding, but ensure that the MFA configuration in the target is appropriate for this policy.");
            logger.debug(result.value);
          }
        }
      }
    }
  }
  if(usesMFA){
    //Get the MFA config from the target
    let authSettings = await iam.getAuthenticationSettingsInfo(instance, DEFAULT_FACTOR_SETTINGS);
    if(!authSettings){
      issues.push("Could not get Authentication settings from the " +instance +" instance. "+
      "Unable to validate that whether there will be issues.");
      return issues;
    }
    //If we don't have any Factors... well, that is an issue
    if(!authSettings.securityQuestionsEnabled && !authSettings.totpEnabled && !authSettings.emailEnabled &&
      !authSettings.smsEnabled && !authSettings.bypassCodeEnabled && !authSettings.pushEnabled &&
      !authSettings.yubicoOtpEnabled && !authSettings.phoneCallEnabled && !authSettings.fidoAuthenticatorEnabled){
      issues.push("No Multi-factor authentication mechanisms are enabled, yet the Sign-On Policy specifies it uses MFA. "
      +"Ensure that these are enabled or you may wish to migrate the MFA settings.");
    }
    //Check specific factors
    for(let specificFactor of factors){
      if(!authSettings[FACTOR_MAPPINGS[specificFactor]]){
        issues.push("Sign on rule requires a specific factor '" +specificFactor +"' which is not enabled in the "
        +instance +" instance. This may cause issues with sign-in. Ensure that the factor is enabled or migrate "
        +"the MFA settings.");
      }
    }
  }
  //Check adaptive access
  let usesAdaptive = false;
  let riskProviders = [];
  for(let condition of resources.conditions){
    if(condition.attributeName == "userRiskLevel"){
      usesAdaptive = true;
    }
    if(condition.attributeName.startsWith("user.urn:ietf:params:scim:schemas:oracle:idcs:extension:adaptive:User:riskScores")){
      usesAdaptive = true;
      //Get the risk provider, which is provided in 'name' 
      riskProviders.push(condition.name);
    }
  }
  if(usesAdaptive){
    //Get the Adaptive settings from the target
    let adaptiveSettings = await iam.getAdaptiveAccessSettingsInfo(instance, DEFAULT_ADAPTIVE_ACCESS);
    if(!adaptiveSettings){
      issues.push("Could not get Adaptive settings from the " +instance +" instance. "+
      "Unable to validate that whether there will be issues.");
      return issues;
    }
    if(!adaptiveSettings.adaptiveEnabled){
      issues.push("Adaptive Access is not enabled, yet the Sign-On Policy uses it as a condition. "
      +"Ensure that it is enabled.");
    }
    if(riskProviders.length > 0){
      let enabledRiskProviders = await iam.getRiskProviderInfo(instance);
      if(!enabledRiskProviders){
        issues.push("Could not get list of Adaptive providers from the " +instance +" instance. "+
        "Unable to validate that whether there will be issues.");
        return issues;
      }
      //Typical inefficient nm search...
      for(let provider of riskProviders){
        let providerPresent = false;
        for(let enabledProvider of enabledRiskProviders.Resources){
          if(provider == enabledProvider.id && enabledProvider.status == "ACTIVE"){
            providerPresent = true;
            break;
          }
        }
        if(!providerPresent){
          issues.push("Sign on rule specifies the Adaptive Provider '" +provider +"' which is not enabled in the "
          +instance +" instance. Ensure that the provider is enabled in the target.")
        }
      }
    }
  }
  return issues;
}

async function relinkIdentityProviders(iam, resources){
  logger.debug("Relinking IdPs in the Conditions...");
  //Little cache
  let idpMappings = {};
  let idpMappingsPopulated = false;
  let conditionsToDelete = [];
  for (let condition of resources.conditions) {
    if (condition.attributeName == "subject.authenticatedBy") {
      let idpId;
      try{
        idpId = JSON.parse(condition.attributeValue)[0];
        //Inbuilt IdPs are by name, i.e. "UserNamePassword", added IdPs are UUIDs
        if(!UUIDRegex.test(idpId)){
          break;
        }
      }catch{
        logger.warn("Error determining the specified IdP in a Condition- removing the Condition from the ConditionGroup.")
        idpId = "invalidId"
      }
      if(!idpMappingsPopulated){
        //Get the IdPs from the instances
        let idpFromSource = await iam.getIdentityProvidersList("source");
        let idpFromTarget = await iam.getIdentityProvidersList("target");
        //Put these in our mapping object, using a very inefficent cross-search
        //Filter out the inbuilt ones
        idpFromSource = idpFromSource.Resources.filter((idp) => {return UUIDRegex.test(idp.id)});
        idpFromTarget = idpFromTarget.Resources.filter((idp) => {return UUIDRegex.test(idp.id)});
        for (let idpInSource of idpFromSource) {
          for(let idpInTarget of idpFromTarget){
            if(idpInSource.partnerName == idpInTarget.partnerName){
              idpMappings[idpInSource.id] = idpInTarget.id;
              break;
            }
          }
        }
        idpMappingsPopulated = true;
      }
      //Map to the IdP in target, using the idp Mappings
      if(idpMappings[idpId]){
        condition.attributeValue = "[\\\"" +idpMappings[idpId] +"\\\"]";
      }else{
        //No mapping, so tag this condition for deletion
        logger.warn("Condition in Sign-On Policy specified an IdP which is not present in the target (mapped by name). "
         +"Ensure you re-add this condition to the policy after creating the IdP if it is required.");
        conditionsToDelete.push(condition.id);
      }
    }
  }
  //Delete the conditions that have been orphaned
  //Very inefficent.. yeah yeah...
  for(let conditionToDelete of conditionsToDelete){
    for(let condition in resources.conditions){
      if(resources.conditions[condition].id == conditionToDelete){
        resources.conditions.splice(condition, 1);
      }
    }
    for(let conditionGroup of resources.conditionGroups){
      for(let condition in conditionGroup.conditions){
        if(conditionGroup.conditions[condition].value == conditionToDelete){
          conditionGroup.conditions.splice(condition, 1);
          break;
        }
      }
    }
    for(let rule of resources.rules){
      if(rule.conditionGroup && rule.conditionGroup.type == CONDITION_TYPE 
        && rule.conditionGroup.value == conditionToDelete){
        delete rule.conditionGroup;
      }
    }
  }
  return resources;
}


async function createResources(iam, instance, resources, dryRun, existingPolicyId, existingPolicy) {
  logger.debug("Creating resources in " + instance + "...");
  if (existingPolicyId){
    logger.debug("Policy already exists in target, so updating it instead.")
  }
  if (resources.policies && Array.isArray(resources.policies)) {
    logger.debug("Policies to create:");
    for (let policyToCreate of resources.policies) {
      logger.debug(policyToCreate.id + " - " + policyToCreate.name);
    }
  }
  if (resources.networkPerimeters && Array.isArray(resources.networkPerimeters)) {
    logger.debug("Network Perimeters to create:");
    for (let perimeterToCreate of resources.networkPerimeters) {
      logger.debug(perimeterToCreate.id + " - " + perimeterToCreate.name);
    }
  }
  if (resources.rules && Array.isArray(resources.rules)) {
    logger.debug("Rules to create:");
    for (let ruleToCreate of resources.rules) {
      logger.debug(ruleToCreate.id+ " - " + ruleToCreate.name);
    }
  }
  if (resources.conditions && Array.isArray(resources.conditions)) {
    logger.debug("Conditions to create:");
    for (let conditionToCreate of resources.conditions) {
      logger.debug(conditionToCreate.id);
    }
  }
  if (resources.conditionGroups && Array.isArray(resources.conditionGroups)) {
    logger.debug("Condition Groups to create:");
    for (var conditionGroupToDelete of resources.conditionGroups) {
      logger.debug(conditionGroupToDelete.id);
    }
  }
  if(existingPolicyId){
    logger.debug("Deleting resources which would be orphaned by the update.");
    if (existingPolicy.rules && Array.isArray(existingPolicy.rules)) {
      logger.debug("Rules to delete:");
      for (let ruleToDelete of existingPolicy.rules) {
        if(ruleToDelete.value != DEFAULT_SIGNON_RULE){
          logger.debug(ruleToDelete.value);
        }        
      }
    }
  }  
  //Initial Bulk request for network perimeter creation
  var networkBulkRequest = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
    Operations: []
  };
  //Network perimeters
  for (let perimeter in resources.networkPerimeters){
    networkBulkRequest.Operations.push({
      method: "POST",
      path: "/NetworkPerimeters",
      bulkId: "perimId" + perimeter,
      data: filterCreateBody(resources.networkPerimeters[perimeter])
    });
  }
  //Bulk request for the sign-on Policies
  var bulkRequest = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
    Operations: []
  };
  //Conditions
  for (let condition in resources.conditions) {
    //Relink the conditions to the perimeters
    let networkPerimeterId = resources.conditions[condition].attributeValue.match(/#inIPRange\(\"([0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15})\"\)/);
    if(networkPerimeterId){
      for(let perimeter in resources.networkPerimeters){
        if(resources.networkPerimeters[perimeter].id == networkPerimeterId[1]){
          //Placeholder value to replace later
          resources.conditions[condition].attributeValue = "bulkId:perimId" +perimeter
          break;
        }
      }
    }
    if(resources.conditions[condition].id == DEFAULT_SIGNON_CONDITION){
      bulkRequest.Operations.push({
        method: "PUT",
        path: "/Conditions/" +DEFAULT_SIGNON_CONDITION,
        data: filterCreateBody(resources.conditions[condition])
      });
    }else{
      bulkRequest.Operations.push({
        method: "POST",
        path: "/Conditions",
        bulkId: "conditionId" + condition,
        data: filterCreateBody(resources.conditions[condition])
      });
    }    
  }
  //Condition Groups
  for (let conditionGroup in resources.conditionGroups) {
    for (let conditionGroupCondition of resources.conditionGroups[conditionGroup].conditions) {
      if(conditionGroupCondition.value != DEFAULT_SIGNON_CONDITION){
        //Link the conditions back in
        for (let condition in resources.conditions) {
          if (resources.conditions[condition].id == conditionGroupCondition.value) {
            conditionGroupCondition.value = "bulkId:conditionId" + condition;
            break;
          }
        }
      }
    }
    bulkRequest.Operations.push({
      method: "POST",
      path: "/ConditionGroups",
      bulkId: "cgId" + conditionGroup,
      data: filterCreateBody(resources.conditionGroups[conditionGroup])
    });
  }
  //Rules
  for (let rule in resources.rules) {
    //Need to link the ConditionGroups to the Rule.
    if (resources.rules[rule].conditionGroup && resources.rules[rule].conditionGroup.type == CONDITIONGROUP_TYPE) {
      for (let conditionGroup in resources.conditionGroups) {
        if(resources.rules[rule].conditionGroup.value == resources.conditionGroups[conditionGroup].id){
          resources.rules[rule].conditionGroup.value = "bulkId:cgId" +conditionGroup;
          break;
        }
      }
    }else if(resources.rules[rule].conditionGroup && resources.rules[rule].conditionGroup.type == CONDITION_TYPE){
      if(resources.rules[rule].conditionGroup.value != DEFAULT_SIGNON_CONDITION){
        for(let condition in resources.conditions){
          if(resources.rules[rule].conditionGroup.value == resources.conditions[condition].id){
            resources.rules[rule].conditionGroup.value = "bulkId:conditionId" +condition;
            break;
          }
        }
      }      
    }
    if(resources.rules[rule].id == DEFAULT_SIGNON_RULE){
      bulkRequest.Operations.push({
        method: "PUT",
        path: "/Rules/" +DEFAULT_SIGNON_RULE,
        data: filterCreateBody(resources.rules[rule])
      });
    }else{
      bulkRequest.Operations.push({
        method: "POST",
        path: "/Rules",
        bulkId: "ruleId" + rule,
        data: filterCreateBody(resources.rules[rule])
      });
    }
    
  }
  //Policies
  for (let policy in resources.policies) {
    //Rule mappings
    for(let rule of resources.policies[policy].rules){
      if(rule.value != DEFAULT_SIGNON_RULE){
        for (let createdRule in resources.rules) {
          if (resources.rules[createdRule].id == rule.value) {
            rule.value = "bulkId:ruleId" + createdRule
          }
        }
      }      
    }
    if(existingPolicyId){
      bulkRequest.Operations.push({
        method: "PUT",
        path: "/Policies/" +existingPolicyId,
        data: filterCreateBody(resources.policies[policy])
      });
    }else{
      bulkRequest.Operations.push({
        method: "POST",
        path: "/Policies",
        bulkId: "policyId" + policy,
        data: filterCreateBody(resources.policies[policy])
      });
    }    
  }
  //Resource Deletion to avoid orphaned objects - 
  //only need to clean up Rules, since dependencies are cleaned up automatically.
  if(existingPolicyId){
    //Rules
    for (let rule of existingPolicy.rules) {
      if(rule.value != DEFAULT_SIGNON_RULE){
        bulkRequest.Operations.push({
          method: "DELETE",
          path: "/Rules/" +rule.value
        });
      }      
    }
  }
  //Network perimeter creation first, so we can remap them afterwards
  let perimeterOptions = {
    url: '/admin/v1/Bulk',
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: networkBulkRequest
  };
  if (dryRun) {
    consoleLogger.info("Running in Dryrun mode, so not creating any resources in the target.");
    if(networkBulkRequest.Operations.length > 0){
      consoleLogger.info("The following request would have been made to create the network perimeters:");
      consoleLogger.info("------- START REQUEST -------");
      consoleLogger.info(JSON.stringify(perimeterOptions, null, 2));
      consoleLogger.info("------- END REQUEST -------");
    }
    let bulkOptions = {
      url: '/admin/v1/Bulk',
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: bulkRequest
    };
    consoleLogger.info("This followup request would have Created the Sign-on policy:")
    consoleLogger.info("------- START REQUEST -------");
    consoleLogger.info(JSON.stringify(bulkOptions, null, 2));
    consoleLogger.info("------- END REQUEST -------");
    return;
  }
  if(networkBulkRequest.Operations.length > 0){
    logger.debug("Preparing to send Bulk request to " + instance + "...");
    perimeterOptions.body = JSON.stringify(perimeterOptions.body);
    let bulkResult = iam.callBulkEndpoint(instance, perimeterOptions);
    logger.debug("Created Network Perimeters in " + instance + " instance.");
    logger.trace(JSON.stringify(bulkResult, null, 2));
    //Extract the ids from the response in order to populate the PATCH request
    let idMapping = {};
    if (bulkResult.Operations && bulkResult.Operations.length > 0) {
      for (let operation of bulkResult.Operations) {
        if (operation.bulkId && operation.status.startsWith("2")) {
          //Take advantage of fixed ID formats...
          idMapping[operation.bulkId] = operation.location.slice(-32);
        }
      }
    }
    //Update the Conditions to reference the created network perimeters
    if (bulkRequest.Operations && bulkRequest.Operations.length > 0) {
      for (let operation of bulkRequest.Operations) {
        if(operation.path == "/Conditions" && operation.data.attributeValue.startsWith("bulkId:perimId")){
          operation.data.attributeValue = "#inIPRange(\\\"" +idMapping[operation.data.attributeValue] +"\\\")";
        }
      }
    }
  }
  //Now send the patch request
  let bulkOptions = {
    url: '/admin/v1/Bulk',
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bulkRequest)
  };
  logger.debug("Preparing to send Bulk request to " + instance + " to create the policy...");
  logger.trace(JSON.stringify(bulkOptions, null, 2));
  let patchResult = await iam.callBulkEndpoint(instance, bulkOptions);
  logger.debug("Created policy in " + instance + " instance.");
  logger.trace(JSON.stringify(patchResult, null, 2));
  return;
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
  await migratePolicy(iamUtil, argv["policy-name"], argv["dry-run"], argv["force"], argv["ignore-issues"]);
}

//Yargs wrapper for CLI use
const migratePolicyCommand = {
  command: "migrate-sign-on <policy-name> [options]",
  describe: "Create a copy of a Sign-On Policy and its dependencies in the target",
  builder: {
    "force": {
      default: false,
      type: 'boolean',
      describe: "Force migration of the Default Sign-On Policy"
    },
    "ignore-issues": {
      default: false,
      type: 'boolean',
      describe: "Continue with migration, even if issues are reported"
    }
  },
  handler: cliHandler
}

export { migratePolicyCommand };