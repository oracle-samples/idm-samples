/*
 * Handler for the login endpoints, which provides the standard entry to the
 * application, and is responsible for rendering the initial view.
 */

import express, { Router } from "express";
import winston from "winston";
import * as ReactDOMServer from 'react-dom/server';
import errorConstants from "../error/errorConstants";
import { RequestState } from "../types/idcsTypes";
import IdcsUtil from "../util/idcsUtil";
import template from "../res/template";
import React from "react";
import App from "../../client/components/App";
import { SubmitCredentialsResponse } from "../types/uiTypes";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  defaultMeta: { service: 'login-router' },
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


function getLoginRouter(idcs: IdcsUtil, assets: { [key: string]: string; }, redwoodTheme:boolean) {
  if (!assets["client.css"] || !assets["client.js"]) {
    logger.error("Expected Assets are not present! Has this been built properly?");
    process.exit(1);
  }
  // The Router we are exporting
  const router = Router();

  // Standard entry point for the application, receives a signature and a loginCtx
  router.post('/login', express.urlencoded({ extended: false }), (req, res) => {
    // Set headers to prevent iframing
    res.setHeader('X-Frame-Options', "DENY");
    logger.debug("Received a login request");
    if (req.body.loginCtx && req.body.signature) {
      try {
        idcs.validateSignature("loginCtx", req.body.loginCtx, req.body.signature);
      } catch (ex) {
        logger.error("Error validating the signature of the login context.")
        logger.error(ex);
        const errRes = {
          code: errorConstants.SIGNATURE_VALIDATION_FAILED_FOR_LOGINCTX,
          message: "Invalid login request."
        }
        return res.status(400).json(errRes);
      }
      logger.debug("Decrypting login context...");
      const decryptedStr = idcs.decrypt(req.body.loginCtx);
      let initialState: RequestState;
      try {
        const decrypted = JSON.parse(decryptedStr) as RequestState;
        // Use the login context to assemble the login form - it needs the following as initial state:
        // - nextAuthFactors
        // - the attributes corresponding to the above
        // - requestState
        // - KMSI enabled is included, since we will render that if no previous token
        // - nextOp to determine what needs rendering
        initialState = {
          nextOp: decrypted.nextOp,
          nextAuthFactors: [],
          requestState: decrypted.requestState,
          keepMeSignedInEnabled: decrypted.keepMeSignedInEnabled
        };
        for (const factor of decrypted.nextAuthFactors) {
          initialState.nextAuthFactors.push(factor);
          // Yey! Typescript. Since otherwise I might be assigning to invalid object shapes.
          switch (factor) {
            case "IDP":
              initialState.IDP = decrypted.IDP;
              break;
            case "USERNAME_PASSWORD":
              initialState.USERNAME_PASSWORD = decrypted.USERNAME_PASSWORD;
              break;
            case "EMAIL":
              initialState.EMAIL = decrypted.EMAIL;
              break;
            case "SMS":
              initialState.SMS = decrypted.SMS;
              break;
            case "TOU":
              initialState.TOU = decrypted.TOU;
              break;
            case "KMSI":
              initialState.KMSI = decrypted.KMSI;
              break;
            case "SECURITY_QUESTIONS":
              initialState.SECURITY_QUESTIONS = decrypted.SECURITY_QUESTIONS;
              break;
            case "PUSH":
              initialState.PUSH = decrypted.PUSH;
              break;
            case "BYPASSCODE":
              initialState.BYPASSCODE = decrypted.BYPASSCODE;
              break;
            case "TOTP":
              initialState.TOTP = decrypted.TOTP;
              break;
          }
        }
      } catch (ex) {
        logger.error("Error parsing the initial login context to generate the login form.");
        logger.error(ex);
        const errRes = {
          code: errorConstants.UNABLE_TO_PARSE_LOGINCTX,
          message: "Invalid login request."
        }
        return res.status(400).json(errRes);
      }
      // Use the initial state to render the login form
      const component = ReactDOMServer.renderToString(React.createElement(App, {initialState, redwoodTheme}));
      return res.send(template({
        body: component,
        title: 'Identity Cloud Service',
        initialState: JSON.stringify(initialState),
        cssLocation: assets["client.css"],
        jsLocation: assets["client.js"],
        redwood: redwoodTheme
      }));
    } else {
      const errRes = {
        code: errorConstants.LOGIN_POST_MISSING_FIELDS,
        message: "Invalid login request."
      }
      return res.status(400).json(errRes);
    }
  })

  // Shouldn't be directly accessed ever.
  router.get('/login', (req, res) => {
    const initialState: SubmitCredentialsResponse = {
      requestState: "a"
    }
    // Use the initial state to render the login form
    const component = ReactDOMServer.renderToString(React.createElement(App, {initialState, redwoodTheme}));
    res.send(template({
      body: component,
      title: 'Identity Cloud Service',
      initialState: JSON.stringify(initialState),
      cssLocation: assets["client.css"],
      jsLocation: assets["client.js"],
      redwood: redwoodTheme
    }));
  });

  return router;
}


export { getLoginRouter };