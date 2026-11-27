const assert = require("node:assert/strict");
const { webdriverConfig } = require("./webdriver.config.ts");

describe("browser-test harness", () => {
  it("defaults to the trusted same-origin HTTPS application", () => {
    const target = new URL(webdriverConfig.baseUrl);
    assert.equal(target.protocol, "https:");
    assert.equal(target.pathname, "/");
    assert.equal(webdriverConfig.implicitWaitMs, 0);
  });
});
