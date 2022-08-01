/*
 * Entry point for the utility, manages CLI commands and arguments,
 * routing each command to its own module.
 */
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

//Central Logging config
import log4js from 'log4js';
log4js.configure({
  appenders: { 
    out: { 
      type: "stdout",
      layout: {
        type: "pattern",
        pattern: "%[[%d] - %]%m"
      }
    },
    stdout: {
      type: "stdout"
    }
  },
  categories: {    
    console: { appenders: ["out"], level: "trace" },
    default: { appenders: ["stdout"], level: "warn" }
  }
})

import { migrateAttributesCommand } from './migrate-attributes.js';
import { exportUsersCommand } from './export-users.js';
import { migrateAppCommand } from './migrate-app.js';
import { resetPolicyCommand } from './reset-default-policy.js';
import { migratePolicyCommand } from './migrate-sign-on.js';
import { migrateMfaCommand } from './migrate-mfa-settings.js';

const argv = yargs(hideBin(process.argv))
  .scriptName("migrate-iam")
  .usage('Usage: $0 <command> [options]')
  .command(migrateAttributesCommand)
  .command(exportUsersCommand)
  .command(migrateAppCommand)
  .command(resetPolicyCommand)
  .command(migratePolicyCommand)
  .command(migrateMfaCommand)
  .alias('dry-run', "d")
  .describe('dry-run', "Don't modify anything, just print payloads")
  .alias('verbose', "v")
  .describe('verbose', "Enable verbose logging")
  .boolean(['d','v'])
  .count('v')
  .alias('config', 'c')
  .describe('config', "Path to config file with instance details")
  .demandOption('config')
  .string('c')
  .help('h')
  .alias('h', 'help')
  .argv;