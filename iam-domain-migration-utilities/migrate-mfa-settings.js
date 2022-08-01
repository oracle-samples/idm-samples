/*
 * Utility for inspecting the MFA settings in the source, then creating
 * the matching config in the target IAM instance.
 * 
 */

//Handled by AuthenticationFactorSettings

import log4js from 'log4js';
const logger = log4js.getLogger();
const consoleLogger = log4js.getLogger("console");

import { filterCreateBody, IamUtil } from './iam-util.js';

const DEFAULT_FACTOR_SETTINGS = "AuthenticationFactorSettings"

async function migrateMFA(iam, dryRun){
  let authSettings = await iam.getAuthenticationSettingsInfo("source", DEFAULT_FACTOR_SETTINGS);
  //Update target
  logger.debug("Updating Authentication Factor Settings in target...");
  let options = {
    url: '/admin/v1/AuthenticationFactorSettings/' +DEFAULT_FACTOR_SETTINGS,
    method: "PUT",
    headers: {
      'Content-Type' : 'application/json'
    },
    body: JSON.stringify(filterCreateBody(authSettings))
  };
  if(dryRun){
    //Clean up the request for printing
    options.headers.Authorization = 'Bearer ...';
    options.body = filterCreateBody(authSettings);
    consoleLogger.info("Running in Dryrun mode, so not creating any resources in the target.");
    consoleLogger.info("The following request would have been made to update the Authentication Factor Settings in the target.");
    consoleLogger.info("------- START REQUEST -------");
    consoleLogger.info(JSON.stringify(options, null, 2));
    consoleLogger.info("------- END REQUEST -------");
    return;
  }
  logger.trace("Invoking IAM to update Authentication Factor Settings with request:");
  logger.trace(JSON.stringify(options, null, 2));
  await iam.callIamEndpoint("target", options);
  logger.debug("Updated Authentication Factor Settings in target.");
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
  await migrateMFA(iamUtil, argv["dry-run"]);
}

//Yargs wrapper for CLI use
const migrateMfaCommand = {
  command: "migrate-mfa [options]",
  describe: "Create a copy of an app and dependencies in the target",
  builder: {},
  handler: cliHandler
}

export { migrateMfaCommand };

