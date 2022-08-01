import fetch from 'node-fetch';
import log4js from 'log4js';
const logger = log4js.getLogger();


import { readFile } from 'node:fs/promises';
import path, { isAbsolute, join as joinPaths } from 'node:path';


const SAMLSCHEMA = "urn:ietf:params:scim:schemas:oracle:idcs:extension:samlServiceProvider:App";


class IamUtil {
  constructor(configPath) {
    if(!isAbsolute(configPath)){
      configPath = joinPaths(process.cwd(), configPath);
    }
    this.configPath = configPath; 
    this.tokens = {};
  }

  async initialise(){
    this.config = JSON.parse(await readFile(this.configPath));
  }

  //Grab an access token, just using global config
  //instance should be one of "source", "target"
  async #getAccessToken(instance){
    logger.debug("Getting Token from " +instance +"...");
    if(typeof instance != 'string' || !this.config || !this.config[instance]){
      logger.error("No configuration provided for the instance type");
      return null;
    }
    var form = {
      'grant_type': 'client_credentials',
      'scope': 'urn:opc:idm:__myscopes__'
    };
    var options = {
      url: this.config[instance].base_url + '/oauth2/v1/token',
      method: "POST",
      headers: {
        'Authorization': 'Basic ' + Buffer.from(this.config[instance].client_id + ':' + this.config[instance].client_secret, 'utf8').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: Object.entries(form).map(v => v.join('=')).join('&')
    };
    try{
      let tokenRes = await fetch(options.url, options);
      let tokenJSON = await tokenRes.json();
      logger.debug("Got access token for " +instance +".");
      return tokenJSON["access_token"];
    }catch(err){
      logger.error(err);
      return null;
    }
  }

  //Helper function to wrap up the fetch call and inject tokens
  //Could be used to provide alternative Auth approaches in future
  async callIamEndpoint(instance, options){
    if(typeof instance != 'string' || !this.config || !this.config[instance]){
      logger.error("No configuration provided for the instance type (or config not initialised...).");
      return null;
    }
    //Potentially handle non-token approaches (OCI Signing, whatever)
    if(!this.tokens[instance]){
      this.tokens[instance] = await this.#getAccessToken(instance);
      if(!this.tokens[instance]){
        throw new Error("Could not obtain token for instance " +instance);
      }
    }
    if(!options.headers){
      options.headers = {};
    }
    options.headers["Authorization"] = "Bearer " +this.tokens[instance];
    try{
      let response = await fetch(this.config[instance].base_url + options.url, options);
      if(response.ok){
        let responseJSON = await response.json();
        return responseJSON;
      }    
      logger.error(await response.text());
      return null;
    }catch(err){
      logger.error(err);
      return null;
    }
  }

  //Alternative wrapper for bulk to better handle individual errors.
  async callBulkEndpoint(instance, options){
    if(typeof instance != 'string' || !this.config || !this.config[instance]){
      logger.error("No configuration provided for the instance type (or config not intialised...).");
      return null;
    }
    //Potentially handle non-token approaches (OCI Signing, whatever)
    if(!this.tokens[instance]){
      this.tokens[instance] = await this.#getAccessToken(instance);
      if(!this.tokens[instance]){
        throw new Error("Could not obtain token for instance " +instance);
      }
    }
    if(!options.headers){
      options.headers = {};
    }
    options.headers["Authorization"] = "Bearer " +this.tokens[instance];
    try{
      let response = await fetch(this.config[instance].base_url + options.url, options);
      if(response.ok){
        let bulkResult = await response.json();
        for(let operation of bulkResult.Operations){
          if(!operation.status.startsWith("20")){
            logger.error("Error within Bulk Operations:");
            logger.error(JSON.stringify(operation, null, 2));
          }
        }
        return bulkResult;
      }
      logger.error("Bulk request returned an invalid status.");
      logger.error(await response.text());
      return null;
    }catch(err){
      logger.error(err);
      return null;
    }
  }

  //Get an App
  async getAppInfo(instance, appId){
    logger.debug("Getting App Details for app " +appId +"from " +instance +"...");
    let options = {
      url: '/admin/v1/Apps/' +appId,
      method: "GET",
    };
    logger.trace("Invoking IAM to get App: " +appId +" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let app = this.callIamEndpoint(instance, options);
    logger.debug("Got app info for app " +appId +".");
    logger.trace(JSON.stringify(app, null, 2));
    return app;
  }

  async getNetworkPerimeterInfo(instance, perimeterId){
    logger.debug("Getting Network Perimeter Details for " +perimeterId +"from " +instance +"...");
    let options = {
      url: '/admin/v1/NetworkPerimeters/' +perimeterId,
      method: "GET",
    };
    logger.trace("Invoking IAM to get Network Perimeter: " +perimeterId +" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let perimeter = await this.callIamEndpoint(instance, options);
    logger.debug("Got info for Network Perimeter " +perimeterId +".");
    logger.trace(JSON.stringify(perimeter, null, 2));
    return perimeter;
  }

  //Get TOS from an instance
  //instance should be one of "source", "target"
  async getTermsOfUseInfo(instance, touId){
    logger.debug("Getting Terms Of Use Details for " +touId +"from " +instance +"...");
    let options = {
      url: '/admin/v1/TermsOfUses/' +touId,
      method: "GET"
    };
    logger.trace("Invoking IAM to get TOU: " +touId +" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let tou = await this.callIamEndpoint(instance, options);
    logger.debug("Got TOU info for " +touId +".");
    logger.trace(JSON.stringify(tou, null, 2));
    return tou;
  }

  //Lookup TOS ids from an instance by name
  async getTermsOfUseByName(instance, name){
    logger.debug("Getting Terms Of Use from " +instance +" for name " +name +"...");
    let options = {
      url: '/admin/v1/TermsOfUses?attributes=id&filter=name eq "' +name +'"',
      method: "GET"
    };
    logger.trace("Invoking IAM to get TOU with filter: name eq \"" +name +"\" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let tou = await this.callIamEndpoint(instance, options);
    logger.debug("Got TOU response for search for " +name +". " +(tou.Resources?.length>0?"Found TOU in target.":"No results"));
    logger.trace(JSON.stringify(tou, null, 2));
    if(tou.Resources && tou.Resources.length == 1){
      return tou.Resources[0];
    }
    return null;
  }

  //Get TOU Statements from an instance
  //instance should be one of "source", "target"
  async getTermsOfUseStatementInfo(instance, statementId){
    logger.debug("Getting Terms Of Use Statement for " +statementId +"from " +instance +"...");
    let options = {
      url: '/admin/v1/TermsOfUseStatements/' +statementId,
      method: "GET"
    };
    logger.trace("Invoking IAM to get statement: " +statementId +" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let statement = await this.callIamEndpoint(instance, options)
    logger.debug("Got Statement for " +statementId +".");
    logger.trace(JSON.stringify(statement, null, 2));
    return statement;
  }

  async getPolicyIdByName(instance, name){
    logger.debug("Getting Policies from " +instance +" for name " +name +"...");
    let options = {
      url: '/admin/v1/Policies?attributes=id&filter=name eq "' +name +'"',
      method: "GET"
    };
    logger.trace("Invoking IAM to get Policies with filter: name eq \"" +name +"\" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let policies = await this.callIamEndpoint(instance, options);
    logger.debug("Got Policy response for search for " +name +". " +(policies.Resources?.length>0?"Found TOU in target.":"No results"));
    logger.trace(JSON.stringify(policies, null, 2));
    if(policies.Resources && policies.Resources.length == 1){
      return policies.Resources[0].id;
    }
    return null;
  }

  async getPolicyInfo(instance, policyId){
    logger.debug("Getting Policy Details for " +policyId +"from " +instance +"...");
    //Rules are 'request' for some reason
    let options = {
      url: '/admin/v1/Policies/' +policyId +"?attributes=id,active,name,description,policyType,rules,schemas",
      method: "GET"
    };
    logger.trace("Invoking IAM to get Policy: " +policyId +" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let policy = await this.callIamEndpoint(instance, options);
    logger.debug("Got Policy info for " +policyId +".");
    logger.trace(JSON.stringify(policy, null, 2));
    return policy;
  }

  async getRuleInfo(instance, ruleId){
    logger.debug("Getting Rule Details for " +ruleId +" from " +instance +"...");
    let options = {
      url: '/admin/v1/Rules/' +ruleId,
      method: "GET"
    };
    logger.trace("Invoking IAM to get Rule: " +ruleId +" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let rule = await this.callIamEndpoint(instance, options);
    logger.debug("Got Rule info for " +ruleId +".");
    logger.trace(JSON.stringify(rule, null, 2));
    return rule;
  }

  async getConditionInfo(instance, conditionId){
    logger.debug("Getting Condition Details for " +conditionId +"from " +instance +"...");
    let options = {
      url: '/admin/v1/Conditions/' +conditionId,
      method: "GET"
    };
    logger.trace("Invoking IAM to get Condition: " +conditionId +" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let condition = await this.callIamEndpoint(instance, options);
    logger.debug("Got Condition info for " +conditionId +".");
    logger.trace(JSON.stringify(condition, null, 2));
    return condition;
  }

  async getConditionGroupInfo(instance, conditionGroupId){
    logger.debug("Getting ConditionGroup Details for " +conditionGroupId +"from " +instance +"...");
    let options = {
      url: '/admin/v1/ConditionGroups/' +conditionGroupId,
      method: "GET"
    };
    logger.trace("Invoking IAM to get ConditionGroup: " +conditionGroupId +" with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let conditionGroup = await this.callIamEndpoint(instance, options);
    logger.debug("Got ConditionGroup info for " +conditionGroupId +".");
    logger.trace(JSON.stringify(conditionGroup, null, 2));
    return conditionGroup;
  }

  async getAuthenticationSettingsInfo(instance, settingsId){
    logger.debug("Getting Authentication Settings from " +instance +"...");
    let options = {
      url: '/admin/v1/AuthenticationFactorSettings/' +settingsId,
      method: "GET"
    };
    logger.trace("Invoking IAM to get Authentication Factor Settings with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let authSettings = await this.callIamEndpoint(instance, options);
    logger.debug("Got Authentication Factor Details for " +settingsId +".");
    logger.trace(JSON.stringify(authSettings, null, 2));
    return authSettings;
  }

  async getAdaptiveAccessSettingsInfo(instance, settingsId){
    logger.debug("Getting Adaptive Access Settings from " +instance +"...");
    let options = {
      url: '/admin/v1/AdaptiveAccessSettings/' +settingsId,
      method: "GET"
    };
    logger.trace("Invoking IAM to get Adaptive Settings with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let authSettings = await this.callIamEndpoint(instance, options);
    logger.debug("Got Adaptive Details for " +settingsId +".");
    logger.trace(JSON.stringify(authSettings, null, 2));
    return authSettings;
  }

  async getRiskProviderInfo(instance){
    logger.debug("Getting Risk Provider Settings from " +instance +"...");
    let options = {
      url: '/admin/v1/RiskProviderProfiles',
      method: "GET"
    };
    logger.trace("Invoking IAM to get Risk Provider Settings with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let authSettings = await this.callIamEndpoint(instance, options);
    logger.debug("Got Risk Provider Settings.");
    logger.trace(JSON.stringify(authSettings, null, 2));
    return authSettings;
  }

  async getAssertionAttributeInfo(instance, attributeId) {
    logger.debug("Getting Assertion Attributes " + attributeId + " from " + instance + " instance...");
    let options = {
      url: '/admin/v1/MappedAttributes/' + attributeId,
      method: "GET"
    };
    logger.trace("Invoking IAM to get Attributes: " + attributeId + " with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let attributes = this.callIamEndpoint(instance, options);
    logger.debug("Got attributes info for " + attributeId + ".");
    logger.trace(JSON.stringify(attributes, null, 2));
    return attributes;
  }

  async getIdentityProvidersList(instance) {
    logger.debug("Getting list of IdPs from " + instance + " instance...");
    let options = {
      url: '/admin/v1/IdentityProviders?attributes=partnerName',
      method: "GET"
    };
    logger.trace("Invoking IAM to get IdPs with request:");
    logger.trace(JSON.stringify(options, null, 2));
    let providers = this.callIamEndpoint(instance, options);
    logger.debug("Got IdP list from " + instance + ".");
    logger.trace(JSON.stringify(providers, null, 2));
    return providers;
  }
}



//Little function to strip out the readOnly or instance-specific data from the body
//This is a bit inefficient, as it is a one-size fits all, but makes the create code
//much simpler.
function filterCreateBody(res){
  //Clone of the object, since we don't want to manipulate the original
  let resource = JSON.parse(JSON.stringify(res));
  delete resource.id;
  if(resource.ocid){
    delete resource.ocid;
  }
  if(resource.compartmentOcid){
    delete resource.compartmentOcid;
  }
  if(resource.domainOcid){
    delete resource.domainOcid;
  }
  if(resource.tenancyOcid){
    delete resource.tenancyOcid;
  }
  if(resource.clientSecret){
    delete resource.clientSecret;
  }
  if(resource.meta){
    delete resource.meta;
  }
  if(resource.basedOnTemplate){
    delete resource.basedOnTemplate.wellKnownId;
    delete resource.basedOnTemplate.lastModified;
    delete resource.basedOnTemplate["$ref"];
  }
  if(resource.idcsCreatedBy){
    delete resource.idcsCreatedBy;
  }
  if(resource.idcsLastModifiedBy){
    delete resource.idcsLastModifiedBy;
  }
  if(resource.idcsPreventedOperations){
    delete resource.idcsPreventedOperations;
  }
  if(resource.idcsLastUpgradedInRelease){
    delete resource.idcsLastUpgradedInRelease;
  }
  if(resource.appSignonPolicy){
    delete resource.appSignonPolicy;
  }
  //Deprecated, but it still is in some apps I have seen
  if(resource.signonPolicy){
    delete resource.signonPolicy;
  }
  if(resource.termsOfUse){
      delete resource.termsOfUse["$ref"];
  }
  //Deleting outbound assertions, since that is managed with
  //a post-creation PATCH
  if(resource[SAMLSCHEMA]?.outboundAssertionAttributes){
    delete resource[SAMLSCHEMA].outboundAssertionAttributes;
  }
  //Deleting User Assertion Attributes, since they have been deprecated
  //and cause issues...
  if(resource[SAMLSCHEMA]?.userAssertionAttributes){
    delete resource[SAMLSCHEMA].userAssertionAttributes;
  }
  //Deleting allowed scopes, since that is managed with
  //a post-creation PATCH
  if(resource.allowedScopes){
    delete resource.allowedScopes;
  }
  if(resource.appsNetworkPerimeters){
    for(let p of resource.appsNetworkPerimeters){
      delete p["$ref"];
    }
  }
  if(resource.statements){
    for(let s of resource.statements){
      delete s["$ref"];
    }
  }
  if(resource.grantedAppRoles){
    delete resource.grantedAppRoles;
  }
  if(resource.rules){
    for(let r of resource.rules){
      delete r["$ref"];
    }
  }
  if(resource.policyType){
    delete resource.policyType["$ref"];
  }
  if(resource.conditionGroup){
    delete resource.conditionGroup["$ref"];
  }
  if(resource.conditions){
    for(let c of resource.conditions){
      delete c["$ref"];
    }
  }
  return resource;
}









export { IamUtil, filterCreateBody };

