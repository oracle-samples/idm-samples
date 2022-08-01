/*
 * Not a migration utility, but a failsafe in case Sign-On Policy changes break access.
 * This loads a permissive policy into the Default Sign-On Policy which should recover
 * console access.
 */
import log4js from 'log4js';
const logger = log4js.getLogger();
const consoleLogger = log4js.getLogger("console");

import { IamUtil } from './iam-util.js';

const FAILSAFE_POLICY={
  schemas: ["urn:ietf:params:scim:api:messages:2.0:BulkRequest"],
  Operations:[
    {
      method:"PUT",
      path:"/Conditions/DefaultSignOnCondition",
      bulkId:"conditionId0",
      data: {
        schemas: ["urn:ietf:params:scim:schemas:oracle:idcs:Condition"],
        operator: "eq",
        attributeName: "target.action",
        attributeValue: "\"Login\"",
        name: "Default Sign-On Condition"
      }
    },
    {
      method:"PATCH",
      path:"/Rules/DefaultSignOnRule",
      bulkId:"ruleId0",
      data: {
        schemas:["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations:[
          {
            op: "replace",
            path: "condition",
            value: "target.action eq \"Login\""
          },
          {
            op: "replace",
            path: "return",
            value: [
              {
                name: "authenticationFactor",
                value: "IDP"
              },
              {
                name: "effect",
                value: "ALLOW"
              }
            ]
          }
        ],

      }
    },
    {
      method:"PUT",
      path:"/Policies/DefaultSignOnPolicy",
      bulkId:"policyId0",
      data: {
        active: true,
        description: "Default Sign on Policy for Tenant",
        policyType: {
            value: "SignOn",
        },
        name: "Default Sign-On Policy",
        rules: [
          {
            value: "DefaultSignOnRule",
            sequence: 1,
          }
        ],
        schemas: [
            "urn:ietf:params:scim:schemas:oracle:idcs:Policy"
        ]
      }
    }
  ]
};

async function resetPolicy(iam, instance, dryRun){
  logger.debug("Reseting Default Sign-On Policy for " +instance +"...");
  if(typeof instance != 'string' || !config[instance]){
    logger.error("No configuration provided for the instance type.");
    return null;
  }
  let options = {
    url: '/admin/v1/Bulk',
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(FAILSAFE_POLICY)
  };
  if(dryRun){
    //Clean up the request for printing
    options.headers.Authorization = 'Bearer ...';
    options.body = FAILSAFE_POLICY;
    consoleLogger.info("Running in Dryrun mode, so not updating any resources in the target.");
    consoleLogger.info("The following request would have been made to replace the Default SignOn Policy in " +instance +".");
    consoleLogger.info("------- START REQUEST -------");
    consoleLogger.info(JSON.stringify(options, null, 2));
    consoleLogger.info("------- END REQUEST -------");
    return;
  }
  logger.trace("Invoking IAM to reset the Sign-On Policy with request:");
  logger.trace(JSON.stringify(options, null, 2));
  await iam.callBulkEndpoint(instance, options);
}

async function cliHandler(argv){
  //Set logging levels
  switch(argv.verbose){
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
  await resetPolicy(iamUtil, argv["instance"], argv["dry-run"]);
}

//Yargs wrapper for CLI use
const resetPolicyCommand = {
  command: "reset-default-policy <instance> [options]",
  describe: "Reset the Default Sign-On Policy for an instance. <instance> is as specified in the config file, typically 'source' or 'target'",
  builder: {},
  handler: cliHandler
}

export { resetPolicyCommand };
