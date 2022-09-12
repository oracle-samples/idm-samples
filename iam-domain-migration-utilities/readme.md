# OCI IAM Domain Migration Utilities

This repository contains a collection of utilities to support scenarios in which resources from one IAM Domain need to be migrated to another, such as to accomodate T2P (Test to Production) requirements.

## High Level Functionality

* Migrate User Schema Extensions
* Support Comprehensive User export
* Migration of OAuth and SAML Applications
* Migration of Sign-On Policies

## Out of Scope Components

There are a number of components which don't make sense to migrate, or don't support migration between environments. These include the following:

* Other App Types:
    * App Gateway Applications
    * Oracle Public Cloud Applications
    * App Catalog Applications
* Identity Providers
* Non-Exportable User Attributes (which notably includes MFA registrations)
* Non-User based config (such as Dynamic Groups)

Some of these will need to be created through other mechanisms, others are the result of interactions by individual users, and can't be handled in bulk by an administrator.

## Prerequisites

These utilites are written in Node.js, and the prerequisites can be installed using npm run in the base directory, i.e.

`npm install`

The utilities all reference the file specified by the `--config` option for details about the source and target instances. It was assumed that there would be consistent source and target instances during a migration scenario, and using a config file like this was simpler than specifying all of these details as parameters.

The config file has the following format, specifying the source and target instances, as well as providing client credentials to use to access them.

```
{
  "source":{
    "client_id": "1234567",
    "client_secret": "source-secret",
    "base_url":"https://idcs-<source-guid>.identity.oraclecloud.com"
  },
  "target":{
    "client_id": "12334567",
    "client_secret": "target-secret",
    "base_url":"https://idcs-<target-guid>.identity.oraclecloud.com"
  }
}
```

The client used is assumed to be granted Identity Domain Administrator privileges, which should be removed from both instances after migration.

## Typical Usage Scenarios

The following describes the common migration scenarios at a high level. Details of the individual utilities are provided below to support bespoke requirements.

## Typical Usage For User Migration

This scenario assumes you wish to replicate the user base, including groups and group memberships from one instance to another.

### 1. Export the Users from the Source

The `export-users` command wraps up a number of the other capabilities into a single command. It can be run using the default options, i.e

`node migrate-iam export-users --config ./config.json`

When run like this, the utility will add export headers to all custom attributes in the source, push the custom attributes from the source to the target instance, then schedules an export job, to export the users in a CSV file. 

This can also be run with a filter (`-f` option) in order to extract only a subset of users.

The resulting User CSVs can be obtained from the Source instance's Console, via the Jobs section, and imported into the Target instance from the Users section of the console.

### 2. Export Groups from the Source

Default Group Export behaviour can be used to migrate between instances. A Group Export can be run from the source instance's console or APIs, then imported into the target.

## Typical Usage for App Migration

This scenario assumes you have representations of Applications in IAM which use OAuth or SAML and need to be replicated to a new environment.

### 1. Migrate Individual Applications

The `migrate-app` command can be used to migrate individual apps from the source instance to the target. When run using the default options, i.e.

`node migrate-iam migrate-app <app-id> --config ./config.json`

Here, `app-id` is the identifier of the application in IAM, which can be obtained from the API or the console.

When this is run, the source will be introspected to determine the application dependencies, then they will be recreated and relinked in the target instance.

### 2. Update the Client Applications

After running `migrate-app`, representations of the apps will be created in the target IAM instance. The actual applications which rely upon that IAM instance will need to be reconfigured to use the new instance though. This will involve updating URLs, client_id/secrets, SAML Metadata, etc.

## Typical Usage for Sign-On Configuration Migration

This scenario assumes you wish to migrate Sign-On configuration. If the Sign-On Configuration includes references to particular Identity Providers, those providers should be created first. The utility attempts to match IdPs by name (So a policy referencing 'Corporate SSO' in the source is linked to 'Corporate SSO' in the target, if it exists, even if those are different IdPs).

### 1. Migrate MFA Settings

The `migrate-mfa` command replicates the MFA settings (including enabled Factors and settings) from the source instance to the target. i.e.

`node migrate-iam migrate-mfa --config ./config.json`

### 2. Migrate Sign-On Policies

The `migrate-sign-on` command replicates a Sign-On Policy from the source instance to the target. i.e.

`node migrate-iam migrate-sign-on "My Sign-On Policy" --config ./config.json`

Here, `"My Sign-On Policy"` is the name of the Sign-On Policy in the source IAM.

When this is run, the source will be introspected to determine the policy dependencies, then they will be recreated and relinked in the target instance.

### 3. Assign Applications to the Sign-On Policy

Applications are not automatically assigned to the new Sign-On Policy, these need to be assigned after the policy is created using either the console or API.

## Command Details

### Common Options

All commands support the following options:

|||
| --- | --- |
| `-v, --verbose` | Enable verbose logging. `-vv` can be used for additional verbosity.|
|`-d, --dry-run` | Don't make changes, just print the payloads|
|`-h --help` | Print usage information|
|`-c --config` | Path to the config file (required)|

### `export-users`

The Export Users command is designed to simplify the user migration process into a single command. This includes configuring the custom user attributes to support import and export, migrating them to the target instance, and running an export job, requesting all exportable attributes.

*Example:*

`node migrate-iam export-users -f 'userName sw \"test\"' --skip-custom -d -c ./config.json`

This simulates a migration of all users who have a username beginning with 'test', outputting the number of users who would be exported with such a filter, as well as the API request which would have triggered the export job.

The following additional options are supported:

|||
| --- | --- |
| `-f, --filter` | Specify a filter for the user export |
| `-s, --skip-custom` | Skip migrating custom attributes |
| `--check-schemas` | Determine the attributes from the schemas |
| `--include-passwords` | Export the user's (hashed) password |


The `-f` option can be used to specify a filter for the users, based upon the filter syntax available [here](https://docs.oracle.com/en/cloud/paas/identity-cloud/rest-api/OCISQueryParameters.html). Filters should use escaped quotation marks rather than URI encoding. Useful examples might be filtering on Group membership, i.e.

`-f 'groups[value eq \"<group-id>\"]'`

Or email domain, i.e.

`-f 'emails[primary eq true].value ew \"@oracle.com\"'`

It is recommended to use `-f` together with `-d` and `-s` if you are testing filters, as the first step of the export command is to validate the filter.

The `-s` or `--skip-custom` option simply uses the base IAM User attributes, and bypasses inspecting or migrating User Schema extensions.

The `--check-schemas` option causes the utility to determine which attributes to export based upon the IAM User Schemas. If not specified, a pre-determined set of attributes are used, which covers all exportable attributes at time of writing. This could be used if user schemas change in future releases of IAM, or something non-standard is going on.

The `--include-passwords` option specifies that the user's hashed password should be included in the exported CSV. This can be used to allow a migration of users without forcing them to set a new password, though obviously should be used with care, as it exposes the password hashes in the CSV.

### `migrate-attributes`

The Migrate Attributes command is a substep of the overall export users flow, which replicates Custom User attributes from the source to the target. 

It makes sense to use this command rather than `export-users` when you are simply migrating configuration, but have a different user base between the environments.

*Example:*

`node migrate-iam migrate-attributes --config ./config.json`

Run with no options, this simply copies the Custom User attributes from the source and merges them into the target instance's schema.

The following additional option is supported.

|||
| --- | --- |
| `--make-exportable` | Add CSV headers to the custom attributes  |

The `--make-exportable` option adds CSV header entries for the custom attributes, which are then replicated to the target. This enables the use of Import/Export of these attributes for Users.

### `migrate-app`

The Migrate App command is used to move a SAML or OAuth Client App from the Source system to the target, bringing in the dependencies of that app. 

*Example:*

`node migrate-iam migrate-app 12341234541f11f1f23fd12ff551f1f2 --config ./config.json --set-inactive`

This command gathers information on the app with id `12341234541f11f1f23fd12ff551f1f2` from the source, then creates the app in a deactivated state along with all of the dependencies in the target instance.

These dependencies include the following:

For All Apps:

* Terms of Use
* Grants to Groups (matching Group Names between Source and Target instances)

For OAuth Apps:

 * All resources, including those in other applications
 * Network Perimeters used for IP Allowlisting of client credentials

For SAML Apps:

 * Attribute Mappings

The following additional option is supported.

|||
| --- | --- |
| `--preserve-ids` | Don't generate a new client id |
| `--set-inactive` | Create apps in the deactivated state |


The `--preserve-ids` option applies to OAuth Apps, and when specified, creates the apps in the target with the same client id as they had in the source. The client secret can't be preserved, so applications will need to be reconfigured unless they are using client assertions (though they will need to be reconfigured to use the new IAM endpoints anyway).

The `--set-inactive` option is useful if more control over availability of the new applications are required. It creates the applications in the target in a deactivated state, regardless of the state in the source. 

### `migrate-sign-on`

The Migrate Sign-On command is used to migrate a Sign-On Policy, which defines how users authenticate to applications using IAM.

**Note: It is possible to migrate the Default Sign-On Policy using this utility. Be very careful when doing so, as it can result in users being unable to access IAM. The `reset-default-policy` command can be used to restore access in the event that the IAM Console cannot be accessed.**

*Example:*

`node migrate-iam migrate-sign-on "My Sign-On Policy" --config ./config.json`

This command gathers information on the sign-on policy named  `My Sign-On Policy` from the source instance, then replicates it into the target instance.

This migrates Network Perimeters as well as all sign-on rules. Rules which are conditioned upon IdPs are relinked to an IdP in the target with a matching name, or removed if the IdP is not present (and a warning is outputted).

During the migration, potential incompatibility issues are assessed, and outputed if found. By default an issue will result in the migration being aborted.

**Apps assigned to the Sign-On Policy are not migrated. Apps in the target need to be assigned after the Policy is created in the target.**

The following additional options are supported.

|||
| --- | --- |
| `--ignore-issues` | Proceed despite issues identified with the target instance |
| `--force` | Force migration of the Default Sign-On Policy |

The `--ignore-issues` option creates the Policy in the target even if incompatibilities are detected. Typical issues include policies requiring Multi-factor Authentication when it is not enabled in the target instance, or relying on Adaptive Risk Providers which aren't enabled.

The `--force` option is required for migration of the Default Sign-On Policy. Misconfiguration of this policy can lock users out of an instance, so this option is treated as additional confirmation. This option isn't required if the `--dry-run` option is present (since that doesn't make changes that could lock users out).

### `reset-default-policy`

Not a migration utility, the `reset-default-policy` command provides a failsafe in case Sign-On Policy changes break access.
This loads a permissive policy into the Default Sign-On Policy which should recover console access.

*Example:*

`node migrate-iam reset-default-policy target --config ./config.json`

This command sets the Default Sign-On policy for the instance defined as the `target` in the config file to a permissive Sign-On Policy which should restore console access.

This command takes no additional options.

### `migrate-mfa`

The Migrate MFA command is used to copy the Multifactor Authentication settings from the source to the target. 

*Example:*

`node migrate-iam migrate-mfa --config ./config.json`

This overrides the MFA settings in the target so ensure you are not inadvertantly disabling factors which are used in the target. If you wish to apply a subset of MFA options, then it is better to use the console or API.

This command takes no additional options.

## Using a Proxy Server

This utility will honour the `HTTPS_PROXY` environment variable, or you can explicitly set a proxy in the config file, i.e.

```
{
  "source":{...},
  "target":{...},
  "proxy":"http://myproxyserver:8080"
}
```

## Known Issues

### Limits on Bulk Import

An import can only include 100k rows and a max file size of 52MB. Large exports may exceed this, and so cannot be imported directly into the target instance.

**Workaround:** Review how many users you are looking to export using the `--dry-run` option, or the output from the `export-users` command, then manually split the file to remain within the IAM import limits.

### API Rate Limits

This utility requires a number of API calls to gather information about resources and create them in the target instance. This may run up against API Rate limits in Free-type domains. 

**Workaround:** It is likely the pair of Bulk requests made for App Migration and Sign-On Policy Migration which may cause issues. In this situation, use a `--dry-run` option to gather the request bodies, then run them manually (updating the references between calls).
