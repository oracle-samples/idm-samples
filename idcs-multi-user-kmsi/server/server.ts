import express from 'express';
import cookieParser from 'cookie-parser';
import winston from "winston";
import { readFileSync } from 'fs';
import path from 'path';
import http, { Server } from 'http';
import https from 'https';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  defaultMeta: { service: 'iam-multi-user-kmsi-server' },
  transports: [
    // Write all logs with importance level of error or less to error.log
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // Write all logs with importance level of info or less to diagnostic.log
    new winston.transports.File({ filename: 'diagnostic.log' }),
  ],
});

// If we're not in production then log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug';
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

import IdcsUtil from "./util/idcsUtil";
import { ServerConfig } from './types/config';
import { getCredentialSubmissionRouter } from './routes/credSubmit';
import { getLoginRouter } from './routes/login';
import { getMfaRouter } from './routes/mfaRoutes';
import { getResetPasswordRouter } from './routes/resetPassword';
import { getForgetPasswordRouter } from './routes/forgotPassword';

// Read from our static files - config and assets.
const config: ServerConfig = JSON.parse(readFileSync(path.join(__dirname, '..', 'config', 'config.json'), 'utf-8'));
// TODO: Config Validator
// Assets is the webpack manifest and is generated automatically
const assets: {[key: string]: string;} = JSON.parse(readFileSync(path.join(__dirname, 'static', 'manifest.json'), 'utf-8'));
if(!assets["client.css"] || !assets["client.js"]){
  logger.error("Expected Assets are not present! Has this been built properly?");
  process.exit(1);
}

const idcs = new IdcsUtil(config.idcs_config);

const app = express();
app.use(cookieParser(config.cookie_signing_key));
app.use('/', express.static(path.join(__dirname, 'static')));

// Load our routes.
// Login routes provide the standard entry point for the application,
// receives a signature and a loginCtx
app.use(getLoginRouter(idcs, assets, config.style?.redwood_theme));
// Cred Submission routes handle CredSubmit, but also KMSI Deletion
// and session creation which is used when MFA enrollment is bypassed
app.use(getCredentialSubmissionRouter(idcs, config));
// MFA Routes are used to provide utility capabilities, for values
// which need to be dynamically generated. The actual MFA steps
// themselves play against the credential submission endpoints
app.use(getMfaRouter(idcs));
// Password Management Routes are used to set new passwords in
// the event that the existing ones have expired.
app.use(getResetPasswordRouter(idcs));
// The Forgot password Routes are used to handle password reset
// requests
app.use(getForgetPasswordRouter(idcs));


// Health Check basically - since the login is accessed differently
app.get('/', (req, res) => {
  return res.send("Custom Login Server is running.")
})

// Load a HTTP or HTTPS Server depending upon our config
const port = parseInt(process.env.PORT, 10) || config.port || 8000;
let server: Server;
if(config.ssl?.use_ssl){
  // Load local SSL certs for testing
  const privateKey = readFileSync(config.ssl?.private_key_path, 'utf8');
  const publicCert = readFileSync(config.ssl?.public_cert_path, 'utf8');
  const serverCredentials = {key: privateKey, cert: publicCert};
  server = https.createServer(serverCredentials, app);
}else{
  if(!config.ssl?.is_ssl){
    logger.warn("Server started without SSL configured - this should ONLY be used for local testing.");
  }
  server = http.createServer(app);
}

// Ensure IDCS is configured before we listen for requests.
idcs.initialise().then(() => {
  if(config.force_ip_version_4){
    // Specify the IPv4 hostname explicitly to force that bind
    server.listen(port, '0.0.0.0', () => {
      logger.info(`Server running on http://localhost:${port}`);
    });
  }else{
    server.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}`);
    });
  }
});
