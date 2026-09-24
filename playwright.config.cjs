const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1440, height: 960 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
