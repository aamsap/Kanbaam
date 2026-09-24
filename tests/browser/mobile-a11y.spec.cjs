const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const url = pathToFileURL(path.resolve(__dirname, '../../index.html')).href;

test('mobile shows project description and provides usable action hit areas', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(url);
  await page.locator('#start-project').click();
  await page.getByLabel('Project name', { exact: true }).fill('Mobile board');
  await page.locator('#project-description-input').fill('A project description that matters');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.locator('#project-description')).toBeVisible();
  await expect(page.locator('#project-description')).toHaveText('A project description that matters');
  const add = page.locator('.lane-heading > .icon-button').first();
  const box = await add.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});
