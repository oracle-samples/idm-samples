/*
 * Quick util for reading the IAM Domains Schemas for a user in order to
 * extract all of the fields which contain a mapping to CSV headers.
 * 
 * Pretty simple top level view - get a list of user schemas, then call
 * the /Schemas endpoint for each of the schemas.
 * Unfortunately /Schemas aren't filterable, so we parse the results
 * here.
 */

import log4js from 'log4js';
const logger = log4js.getLogger();

async function getExportableAttributes(iam) {
  //Get the list of user schemas (using the ends with ':User' filter, since that seems to 
  //be the schema naming convention)
  logger.debug("Getting Schema List...");
  let options = {
    url: '/admin/v1/Schemas?attributes=id&filter=id ew ":User"',
    method: "GET"
  };
  let schemas = [];
  let schemaJSON = await iam.callIamEndpoint("source", options);
  for (let schema of schemaJSON["Resources"]) {
    schemas.push(schema["id"]);
  }
  //Get the schemas and parse the exportable attributes out
  //Could parallel this, but once off...
  let exportableAttributes = [];
  let attributeHeaders = [];
  for (let schema of schemas) {
    logger.debug("Getting Schema [" + schema + "]...");
    options = {
      url: '/admin/v1/Schemas/' + schema,
      method: "GET"
    };
    let schemaJSON = await iam.callIamEndpoint("source", options);
    if (!schemaJSON || !schemaJSON["attributes"]) {
      continue;
    }
    let schemaAttributes = schemaJSON["attributes"];    
    //If not in the base User schema, we need to specify the schema name as a prefix
    let prefix = (schema == "urn:ietf:params:scim:schemas:core:2.0:User" ? "" : schema + ":");
    for (let attribute of schemaAttributes) {
      if (attribute["idcsCsvAttributeNameMappings"]) {
        let subattr = false;
        for (let mapping of attribute["idcsCsvAttributeNameMappings"]) {
          if (mapping["defaultValue"]) {
            //I think this only applies to 'creationMechanism', which
            //simply defaults the value if using flatfiles...
            continue;
          }
          //Mostly for capturing this information, since it is interesting...
          attributeHeaders.push({ "header": mapping["columnHeaderName"], "mapsTo": prefix + (mapping.mapsTo ? mapping.mapsTo : attribute["name"]), "attributeToExport": prefix + attribute["name"] });
          if (!subattr) {
            exportableAttributes.push(prefix + attribute["name"]);
            subattr = true;
          }
        }
      }
    }
  }
  return {
    attributes: exportableAttributes,
    csvHeaders: attributeHeaders
  };
}

export { getExportableAttributes };

// var exportableAttributes = await getExportableAttributes();
// logger.debug("All Attributes and mappings:");
// for(var attr in exportableAttributes.csvHeaders){
//   logger.debug(exportableAttributes.csvHeaders[attr].header +" ==> "
//     +exportableAttributes.csvHeaders[attr].mapsTo
//     +(exportableAttributes.csvHeaders[attr].mapsTo==exportableAttributes.csvHeaders[attr].attributeToExport?"":" (exported using '" +exportableAttributes.csvHeaders[attr].attributeToExport +"')"));
// }

// console.log("Use the following attributesToGet value to export users:");
// console.log(exportableAttributes.attributes.join(","));

