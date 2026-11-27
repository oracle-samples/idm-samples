export const webdriverConfig = Object.freeze({
  baseUrl: process.env.VOICE_BIOMETRIC_E2E_BASE_URL ?? "https://localhost:8443",
  browser: process.env.VOICE_BIOMETRIC_E2E_BROWSER ?? "chrome",
  implicitWaitMs: 0,
  pageLoadTimeoutMs: 10_000,
  scriptTimeoutMs: 5_000
});
