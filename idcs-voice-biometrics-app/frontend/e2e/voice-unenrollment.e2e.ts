import * as assert from "node:assert/strict";
import { Builder, By, Key, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { webdriverConfig } from "./webdriver.config";

type Scenario =
  | "ENROLLED"
  | "DELETE_SUCCEEDS"
  | "ALREADY_ABSENT"
  | "ACTIVE_CAPTURE"
  | "DELETE_DEPENDENCY_FAILURE"
  | "EXPIRED_SESSION";

interface FixtureTrace {
  deleteCalls: number;
  postDeleteListCalls: number;
  unrelatedFactorPresent: boolean;
  requestCompleted: boolean;
}

const fixtureUrl = process.env.VOICE_BIOMETRIC_E2E_UNENROLLMENT_FIXTURE_URL;
const suite = fixtureUrl ? describe : describe.skip;

suite("voice unenrollment browser journey", function () {
  let driver: WebDriver;

  before(async function () {
    this.timeout(30_000);
    driver = await new Builder().forBrowser(webdriverConfig.browser).build();
    await driver.manage().setTimeouts({
      implicit: webdriverConfig.implicitWaitMs,
      pageLoad: webdriverConfig.pageLoadTimeoutMs,
      script: webdriverConfig.scriptTimeoutMs
    });
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  beforeEach(async function () {
    await configure("ENROLLED");
    await driver.get(webdriverConfig.baseUrl);
    await driver.wait(until.elementLocated(deleteButton()), 5_000);
  });

  it("cancels on Cancel, Escape, dismiss, and navigation without an IAM mutation", async () => {
    await openDialog();
    const cancel = await button("Cancel");
    assert.equal(await driver.switchTo().activeElement().getText(), await cancel.getText());
    await cancel.click();

    await openDialog();
    await driver.actions().sendKeys(Key.ESCAPE).perform();
    assert.equal((await trace()).deleteCalls, 0);

    await openDialog();
    await (await driver.findElement(By.css("[data-testid='voice-unenrollment-backdrop']"))).click();
    assert.equal((await trace()).deleteCalls, 0);

    await openDialog();
    await driver.navigate().refresh();
    assert.equal((await trace()).deleteCalls, 0);
  });

  it("deletes only the voice factor and replaces account actions after authoritative absence", async () => {
    await configure("DELETE_SUCCEEDS");
    await driver.navigate().refresh();
    await confirmDelete();

    await driver.wait(until.elementLocated(By.xpath("//button[contains(., 'Enroll voice')]")), 5_000);
    assert.equal((await driver.findElements(deleteButton())).length, 0);
    assert.equal((await driver.findElements(By.xpath("//button[contains(., 'Open verification')]"))).length, 0);
    const provider = await trace();
    assert.equal(provider.deleteCalls, 1);
    assert.equal(provider.unrelatedFactorPresent, true);
    assert.equal(provider.postDeleteListCalls, 1);
  });

  it("reconciles an already-absent voice factor without issuing DELETE", async () => {
    await configure("ALREADY_ABSENT");
    await driver.navigate().refresh();
    await confirmDelete();

    await driver.wait(until.elementLocated(By.xpath("//button[contains(., 'Enroll voice')]")), 5_000);
    assert.equal((await trace()).deleteCalls, 0);
  });

  it("suppresses duplicate confirmation while one deletion is in flight", async () => {
    await configure("DELETE_SUCCEEDS");
    await driver.navigate().refresh();
    await openDialog();
    const confirm = await button("Delete voice enrollment");
    await driver.executeScript("arguments[0].click(); arguments[0].click();", confirm);

    await driver.wait(async () => (await trace()).requestCompleted, 5_000);
    assert.equal((await trace()).deleteCalls, 1);
  });

  it("fails closed while capture is active or when IAM cannot reconcile state", async () => {
    for (const scenario of ["ACTIVE_CAPTURE", "DELETE_DEPENDENCY_FAILURE"] as const) {
      await configure(scenario);
      await driver.navigate().refresh();
      await confirmDelete();
      await driver.wait(until.elementLocated(By.css("[role='alert'], [role='status']")), 5_000);
      assert.equal((await driver.findElements(By.xpath("//button[contains(., 'Open verification')]"))).length, 1);
      assert.equal((await driver.findElements(By.xpath("//button[contains(., 'Enroll voice')]"))).length, 0);
    }
  });

  it("redirects an expired session and exposes no provider identifiers in browser state", async () => {
    await configure("EXPIRED_SESSION");
    await driver.navigate().refresh();
    await confirmDelete();
    await driver.wait(until.urlContains("/login"), 5_000);

    const visibleAndStored = await driver.executeScript<string>(`
      return [document.body.innerText, location.href, JSON.stringify(localStorage),
        JSON.stringify(sessionStorage)].join(' ');
    `);
    assert.doesNotMatch(visibleAndStored, /userId|factorId|provider-factor|provider-user/i);
  });

  async function configure(scenario: Scenario): Promise<void> {
    const response = await fetch(`${fixtureUrl}/scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario })
    });
    assert.equal(response.ok, true, `fixture rejected ${scenario}`);
  }

  async function trace(): Promise<FixtureTrace> {
    const response = await fetch(`${fixtureUrl}/trace`);
    assert.equal(response.ok, true, "fixture trace unavailable");
    return await response.json() as FixtureTrace;
  }

  function deleteButton(): By {
    return By.xpath("//button[contains(., 'Delete voice enrollment')]");
  }

  async function button(label: string): Promise<WebElement> {
    return await driver.findElement(By.xpath(`//button[contains(normalize-space(.), '${label}')]`));
  }

  async function openDialog(): Promise<void> {
    await (await driver.findElement(deleteButton())).click();
    await driver.wait(until.elementLocated(By.css("[role='dialog']")), 5_000);
  }

  async function confirmDelete(): Promise<void> {
    await openDialog();
    await (await button("Delete voice enrollment")).click();
  }
});
