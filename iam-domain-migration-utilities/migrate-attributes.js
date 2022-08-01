/*
 * Quick util for adding the custom schema attributes set in the source to 
 * the target.
 * Doesn't override attributes with matching names - you will need to resolve
 * that conflict yourself.
 */

import { IamUtil } from './iam-util.js';
import log4js from 'log4js';
const logger = log4js.getLogger();
const consoleLogger = log4js.getLogger("console");

const CUSTOMUSERSCHEMA = "urn:ietf:params:scim:schemas:idcs:extension:custom:User";

async function migrateAttributes(iam, addCSVHeaders, dryRun) {
  let customSchema;
  if (addCSVHeaders) {
    customSchema = await addExportHeaders(iam, "source", dryRun);
  }
  await pushCustomAttributes(iam, customSchema, dryRun);
}

async function pushCustomAttributes(iam, schema, dryRun) {
  //If the schema hasn't been provided, then get the attributes from the source
  if (!schema) {
    logger.debug("Getting Custom User Schema from source...");
    let options = {
      url: '/admin/v1/Schemas/' + CUSTOMUSERSCHEMA,
      method: "GET"
    };
    schema = await iam.callIamEndpoint("source", options);
    logger.trace(JSON.stringify(schema));
  }
  logger.debug("Getting Custom User Schema from target...");
  let options = {
    url: '/admin/v1/Schemas/' + CUSTOMUSERSCHEMA,
    method: "GET"
  };
  let targetSchema = await iam.callIamEndpoint("target", options);
  logger.debug("Got Schemas, building Patch body...");
  let patchBody = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    Operations: []
  };
  //For each of the attributes in the schema, add a patchOp
  for (let attribute of schema.attributes) {
    let newAttr = true;
    if (targetSchema.attributes) {
      for (let targetAttribute of targetSchema.attributes) {
        if (attribute.name == targetAttribute.name
          && targetAttribute.idcsCsvAttributeNameMappings?.columnHeaderName) {
          newAttr = false;
          break;
        }
      }
    }
    if (newAttr) {
      patchBody.Operations.push({
        op: "add",
        path: "attributes",
        value: [attribute]
      });
    }
  }
  if (patchBody.Operations.length == 0) {
    logger.debug("No changes required on the target instance.")
    return;
  }
  //Update the schemas
  options = {
    url: '/admin/v1/Schemas/' + CUSTOMUSERSCHEMA,
    method: "PATCH",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(patchBody)
  };
  if (dryRun) {
    //Clean up the request for printing
    options.headers.Authorization = 'Bearer ...';
    options.body = patchBody;
    consoleLogger.info("Running in Dryrun mode, so not updating IDCS.");
    consoleLogger.info("The following request would have been sent to the target to update the attributes:");
    consoleLogger.info("------- START REQUEST -------");
    consoleLogger.info(JSON.stringify(options, null, 2));
    consoleLogger.info("------- END REQUEST -------");
    return;
  }
  logger.debug("Updating the target schema...");
  let patchJSON = await iam.callIamEndpoint("target", options);
  logger.debug("Updated target with attributes from source.");
  logger.trace(JSON.stringify(patchJSON, null, 2));
  return;
}

async function addExportHeaders(iam, instance, dryRun) {
  logger.debug("Getting User Schema Extension from source...");
  let options = {
    url: '/admin/v1/Schemas/' + CUSTOMUSERSCHEMA,
    method: "GET"
  };
  let schema = await iam.callIamEndpoint(instance, options);
  //For each of the attributes in the schema, add a idcsCsvAttributeNameMappings
  //entry, to permit import/export via CSV
  logger.debug("Adding Column Headers...");
  for (let attribute of schema.attributes) {
    attribute.idcsCsvAttributeNameMappings = [{
      "columnHeaderName": "Custom_" + attribute.name
    }];
    if (attribute.multiValued) {
      attribute.idcsCsvAttributeNameMappings[0].multiValueDelimiter = ";";
    }
  }
  //Add the new attributes to a Patch operation
  var patchBody = {
    schemas: [
      "urn:ietf:params:scim:api:messages:2.0:PatchOp"
    ],
    Operations: [
      {
        op: "replace",
        path: "attributes",
        value: schema.attributes
      }
    ]
  };
  //Update the schemas
  options = {
    url: '/admin/v1/Schemas/' + CUSTOMUSERSCHEMA,
    method: "PATCH",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(patchBody)
  };
  if (dryRun) {
    //Clean up the request for printing
    options.headers.Authorization = 'Bearer ...';
    options.body = patchBody;
    consoleLogger.info("Running in Dryrun mode, so not updating IDCS.");
    consoleLogger.info("The following request would have been made to add the CSV Headers:");
    consoleLogger.info("------- START REQUEST -------");
    consoleLogger.info(JSON.stringify(options, null, 2));
    consoleLogger.info("------- END REQUEST -------");
    return schema;
  }
  logger.debug("Updating the Schema in IDCS...");
  let patchJSON = await iam.callIamEndpoint(instance, options);
  logger.debug("Updated Attributes in source.");
  logger.trace(JSON.stringify(patchJSON, null, 2));
  //Returning the schema, since it is useful to save an extra call sometimes
  return schema;
}

async function cliHandler(argv) {
  //Set logging levels
  switch (argv.verbose) {
    case 0:
      //Defer to envrionment, or default 'error'
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
  await migrateAttributes(iamUtil, argv["make-exportable"], argv["dry-run"]);
}


const migrateAttributesCommand = {
  command: "migrate-attributes [options]",
  describe: "Replicate Custom User attributes from the source to the target.",
  builder: {
    "make-exportable": {
      default: false,
      type: 'boolean',
      describe: "Add CSV headers to the Custom attributes before exporting"
    }
  },
  handler: cliHandler
}

export { migrateAttributesCommand, addExportHeaders, pushCustomAttributes };