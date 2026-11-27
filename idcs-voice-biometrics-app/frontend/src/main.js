"use strict";

(function configureRequireJs() {
  requirejs.config({
    // injector:baseUrl
    baseUrl: ".",
    // endinjector
    paths:
      // injector:mainReleasePaths
      {
        ojs: "libs/oj/20.0.0/debug",
        ojL10n: "libs/oj/20.0.0/ojL10n",
        ojtranslations: "libs/oj/20.0.0/resources",
        "@oracle/oraclejet-preact": "libs/oraclejet-preact/amd",
        preact: "libs/preact/dist/preact.umd",
        "preact/hooks": "libs/preact/hooks/dist/hooks.umd",
        "preact/compat": "libs/preact/compat/dist/compat.umd",
        "preact/jsx-runtime": "libs/preact/jsx-runtime/dist/jsxRuntime.umd",
        css: "libs/require-css/css.min",
        "css-builder": "libs/require-css/css-builder",
        normalize: "libs/require-css/normalize"
      }
      // endinjector
  });
})();

require(["./index"]);
