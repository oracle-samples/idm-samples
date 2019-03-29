## Sample Implementation of a Custom SCIM Gateway

1. Use a client application in Oracle Identity Cloud Service, to acquire an access token. If your Oracle Identity Cloud Service don't have a client credential application, add one.
2. Use the access token from the previous step as an Authorization: Bearer to execute a GET request to the following endpoint: https://yourtenant.identity.oraclecloud.com/admin/v1/Apps?filter=displayName co "SCIM Gateway Application"
3. The JSON response contains an ID value for this application.
3. Use the ID value and the access token from step 1 to execute a PATCH request to the following endpoint: https://yourtenant.identity.oraclecloud.com/admin/v1/Apps/ID"
   Replace the ID value at the end of the URL, set header Content-type as application/json, and body message as follows:
'''
   {
  "schemas": [
    "urn:ietf:params:scim:api:messages:2.0:PatchOp"
  ],
  "Operations": [
     {
      "op": "replace",
      "path": "urn:ietf:params:scim:schemas:oracle:idcs:extension:managedapp:App:bundleConfigurationProperties[name eq \"ContentType\"].value",
      "value": [ "application/json"]
    },
     {
      "op": "replace",
      "path": "urn:ietf:params:scim:schemas:oracle:idcs:extension:managedapp:App:bundleConfigurationProperties[name eq \"AcceptType\"].value",
      "value": [ "application/json"]
    },
     {
      "op": "replace",
      "path": "urn:ietf:params:scim:schemas:oracle:idcs:extension:managedapp:App:bundleConfigurationProperties[name eq \"port\"].value",
      "value": [ "6355"]
    },
     {
      "op": "replace",
      "path": "urn:ietf:params:scim:schemas:oracle:idcs:extension:managedapp:App:bundleConfigurationProperties[name eq \"sslEnabled"].value",
      "value": [ "false"]
    }
  ]
}
'''