module.exports = {
  preset: "@oracle/oraclejet-jest-preset",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  setupFilesAfterEnv: ["<rootDir>/test-config/jest.setup.ts"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/index.tsx",
    "!src/**/*.test.{ts,tsx}"
  ],
  coverageDirectory: "coverage"
};
