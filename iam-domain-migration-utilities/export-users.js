/*
 * Utility for triggering user export from the source IAM, including
 * migrating the attributes into the target if required.
 */

import { IamUtil } from './iam-util.js';
import { addExportHeaders, pushCustomAttributes } from './migrate-attributes.js';
import { getExportableAttributes } from './get-exportable-attributes.js';

import log4js from 'log4js';
const logger = log4js.getLogger();
const consoleLogger = log4js.getLogger("console");

var config;

const defaultAttributes = ["externalId,userName,displayName,nickName,profileUrl,title,userType,locale,preferredLanguage,timezone,active,name,emails,phoneNumbers,addresses,meta,urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:employeeNumber,urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:costCenter,urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:organization,urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:division,urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department,urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager,urn:ietf:params:scim:schemas:oracle:idcs:extension:user:User:isFederatedUser,urn:ietf:params:scim:schemas:oracle:idcs:extension:user:User:bypassNotification,urn:ietf:params:scim:schemas:oracle:idcs:extension:userState:User:locked"]

async function exportUsers(iam, filter, skipCustom, checkSchemas, includePasswords, dryRun){
  //Check the filter first...
  let numUsers = await getAffectedUsers(iam, filter);
  consoleLogger.info("The Export Users job will export " +numUsers +" Users.");
  let customAttributes = [];
  if(!skipCustom){
    let customSchema = await addExportHeaders(iam, "source", dryRun);
    customAttributes = customSchema.attributes.map((attr) => {return customSchema.id +":" +attr.name});
    await pushCustomAttributes(iam, customSchema, dryRun);
  }
  let attributesToGet;
  if(checkSchemas){
    let exportableAttributes = await getExportableAttributes(iam);
    if(!argv["include-passwords"]){
      exportableAttributes.attributes = exportableAttributes.attributes.filter((attr) => {return attr != "password"})
    }
    attributesToGet = exportableAttributes.attributes.join(",");
  }else{
    if(includePasswords){
      customAttributes.push("password");
    }
    attributesToGet = defaultAttributes.concat(customAttributes).join(",");
  }
  await scheduleExportJob(iam, attributesToGet, filter, dryRun);
}

async function scheduleExportJob(iam, attributesToGet, filter, dryRun){
  let exportBody = {
    schemas: ["urn:ietf:params:scim:schemas:oracle:idcs:JobSchedule"],
    jobType: "UserExport",
    runNow: true,
    parameters: [
      {
        name: "exportFormat",
        value: "CSV"
      },
      {
        name: "attributesToGet",
        value: attributesToGet
      }
    ]
  };
  if(filter){
    exportBody.parameters.push({
      name: "filter",
      value: filter 
    });
  }
  let options = {
    url: '/job/v1/JobSchedules',
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(exportBody)
  };
  if(dryRun){
    //Clean up the request for printing
    options.headers.Authorization = 'Bearer ...';
    options.body = exportBody;
    consoleLogger.info("Running in Dryrun mode, so not invoking IDCS.");
    consoleLogger.info("The following request would have been sent to the source to kick off the export job.");
    consoleLogger.info("------- START REQUEST -------");
    consoleLogger.info(JSON.stringify(options, null, 2));
    consoleLogger.info("------- END REQUEST -------");
    return;
  }
  logger.debug("Scheduling the export job...");
  logger.trace(JSON.stringify(options, null, 2));
  let job = await iam.callIamEndpoint("source", options);
  logger.debug("Scheduled Export Job.");
  logger.trace(JSON.stringify(job, null, 2));
  consoleLogger.info("Scheduled Export Job. Schedule Id: " +job.id);
  return;
}

//As the first step of the export process, we need to validate the filter.
//This helps santity check things too.
async function getAffectedUsers(iam, filter){
  logger.debug("Getting the number of users to be exported...");
  let userFilter = "";
  if(filter){
    userFilter = "&filter=" +encodeURIComponent(filter);
  }
  let options = {
    url: '/admin/v1/Users?count=0' +userFilter,
    method: "GET"
  };
  let userJson = await iam.callIamEndpoint("source", options);
  logger.debug("Got affected User count from the source.");
  logger.trace(userJson);
  return userJson.totalResults;
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
  await exportUsers(iamUtil, argv["filter"], argv["skip-custom"], argv["check-schemas"], argv["include-passwords"], argv["dry-run"]);
}


const exportUsersCommand = {
    command: "export-users [options]",
    describe: "Replicate Custom User attributes from the source to the target.",
    builder: {
      "filter": {
        alias: "f",
        type: 'string',
        describe: "Specify a filter for the user export"
      },
      "skip-custom": {
        alias: "s",
        default: false,
        type: 'boolean',
        describe: "Skip migrating custom attributes"
      },
      "check-schemas": {
        default: false,
        type: 'boolean',
        describe: "Determine the attributes from the schemas"
      },
      "include-passwords": {
        type: 'boolean',
        default: false,
        describe: "Export the user's (hashed) password"
      }
    },
    handler: cliHandler
  }
  
  export { exportUsersCommand }