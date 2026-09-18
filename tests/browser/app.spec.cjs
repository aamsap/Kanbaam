const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs/promises');
const url = pathToFileURL(path.resolve(__dirname, '../../index.html')).href;
const key = 'kanbaam.workspace.v1';
let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
});
test.afterEach(() => expect(errors).toEqual([]));
async function addProject(page, name) {
  await page.getByRole('button', { name: 'Add project', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.locator('h1')).toHaveText(name);
}
async function addTask(page, title, status = 'backlog', priority = 'medium') {
  await page.locator('#add-task').click();
  await page.locator('#task-form [name=title]').fill(title);
  await page.locator('#task-form [name=description]').fill('A real local task');
  await page.locator('#task-form [name=status]').selectOption(status);
  await page.locator('#task-form [name=priority]').selectOption(priority);
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
}
async function settings(page) { await page.locator('#settings-open').click(); }

test('starts offline, creates browser JSON automatically, project lifecycle persists', async ({ page, context }) => {
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).version, key)).toBe(1);
  await addProject(page, 'Studio work');
  await addTask(page, 'Finish the brief');
  await addProject(page, 'Weekend');
  await page.locator('#projects button').filter({ hasText: 'Studio work' }).click();
  await expect(page.getByRole('button', { name: 'Edit task: Finish the brief', exact: true })).toBeVisible();
  await page.locator('#rename-project').click();
  await page.getByLabel('Project name', { exact: true }).fill('Studio launch');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Studio launch');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await page.locator('#delete-project').click();
  await page.locator('#confirm-button').click();
  await expect(page.locator('h1')).toHaveText('Weekend');
  await expect(page.locator('.task-card')).toHaveCount(0);
});

test('task edit, filtering, drag, accessible reordering, delete and reload', async ({ page }) => {
  await addProject(page, 'Release');
  await addTask(page, 'First', 'backlog', 'high');
  await addTask(page, 'Second');
  await page.getByRole('button', { name: 'Move Second up', exact: true }).click();
  await expect(page.locator('[data-status=backlog] .card-title')).toHaveText(['Second', 'First']);
  await page.locator('.task-card').filter({ hasText: 'First' }).dragTo(page.locator('[data-status=progress] .lane-cards'));
  await expect(page.locator('[data-status=progress] .card-title')).toHaveText(['First']);
  await page.getByRole('button', { name: 'Edit task: First', exact: true }).click();
  await page.locator('#task-form [name=title]').fill('First finished');
  await page.locator('#task-form [name=status]').selectOption('done');
  await page.locator('#task-form [name=due]').fill('2026-10-01');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.locator('[data-status=done] .card-title')).toHaveText(['First finished']);
  await page.getByLabel('Search tasks', { exact: true }).fill('finished');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Filter by priority', exact: true }).selectOption('low');
  await expect(page.locator('.task-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('.task-card')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('[data-status=done] .card-title')).toHaveText(['First finished']);
  await page.getByRole('button', { name: 'Edit task: Second', exact: true }).click();
  await page.getByRole('button', { name: 'Delete task', exact: true }).click();
  await page.locator('#confirm-button').click();
  await expect(page.locator('.task-card')).toHaveCount(1);
});

test('theme and motion settings persist; OS reduced motion takes priority', async ({ page }) => {
  await settings(page);
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await page.getByRole('combobox', { name: 'Color mode', exact: true }).selectOption('dark');
  await page.getByLabel('Motion & celebrations', { exact: true }).uncheck();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'forest');
  await expect(page.locator('html')).toHaveAttribute('data-dark', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'false');
  await settings(page);
  await page.getByLabel('Motion & celebrations', { exact: true }).check();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'false');
});

test('real JSON download round trip, confirmation and invalid import protection', async ({ page }) => {
  await addProject(page, 'Export test');
  await addTask(page, '<img src=x onerror=alert(1)>');
  await settings(page);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const downloaded = await downloadEvent;
  const raw = await fs.readFile(await downloaded.path(), 'utf8');
  const data = JSON.parse(raw);
  expect(data.projects[0].tasks[0].title).toBe('<img src=x onerror=alert(1)>');
  await page.locator('#settings-dialog [data-close]').click();
  await addProject(page, 'Temporary');
  await settings(page);
  await page.locator('#import-file').setInputFiles({ name: 'restored-a.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(page.locator('#confirm-dialog')).toBeVisible();
  await page.locator('#confirm-dialog button[value=cancel]').click();
  await expect(page.locator('#confirm-dialog')).not.toBeVisible();
  expect(await page.evaluate(() => Kanbaam.getState().projects.length)).toBe(2);
  await page.locator('#import-file').setInputFiles({ name: 'restored-b.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect(page.locator('#confirm-dialog')).toBeVisible();
  await page.locator('#confirm-button').click();
  await expect.poll(() => page.evaluate(() => Kanbaam.getState().projects.length), { timeout: 10000 }).toBe(1);
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k + '.backup')).projects.length, key)).toBe(2);
  await page.locator('#import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
  await expect(page.locator('#settings-dialog #file-status')).toContainText('JSON', { timeout: 10000 });
  await expect.poll(() => page.evaluate(() => Kanbaam.getState().projects.length)).toBe(1);
  await page.locator('#settings-dialog [data-close]').click();
  await expect(page.locator('#notice')).toBeVisible();
  await expect(page.locator('.task-card img')).toHaveCount(0);
});

test('corruption is preserved and blocked persistence is clearly announced', async ({ page }) => {
  await page.evaluate(k => localStorage.setItem(k, 'broken payload'), key);
  await page.reload();
  await expect(page.locator('#notice')).toContainText('Original data is untouched');
  await addProject(page, 'Unsaved recovery');
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBe('broken payload');
  await expect(page.locator('#save-status')).toContainText('Not saved');
});

test('responsive layouts, both modes and settings pass accessibility checks', async ({ page }) => {
  await page.locator('#sample-project').click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    for (const mode of ['light', 'dark']) {
      await settings(page);
      await page.getByRole('combobox', { name: 'Color mode', exact: true }).selectOption(mode);
      await page.evaluate(() => Promise.allSettled(document.getAnimations().map(a => a.finished)));
      const dialogViolations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations;
      expect(dialogViolations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
      await page.locator('#settings-dialog [data-close]').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations;
      expect(violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
      if (width === 1440 || width === 390) await page.screenshot({ path: `test-results/kanbaam-${width}-${mode}.png`, fullPage: true });
    }
  }
});

test('mobile keeps a working add-project control after the first project exists', async ({ page }) => {
  await addProject(page, 'First board');
  await page.setViewportSize({ width: 390, height: 844 });
  const newProject = page.locator('#new-project');
  await expect(newProject).toBeVisible();
  const box = await newProject.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await newProject.click();
  await page.getByLabel('Project name', { exact: true }).fill('Second board');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Second board');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('keyboard can create and move tasks, with escape closing and focus contained in dialog', async ({ page }) => {
  await addProject(page, 'Keyboard');
  await addTask(page, 'Keyboard task');
  await page.getByRole('button', { name: 'Edit task: Keyboard task', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#task-dialog')).toBeVisible();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('#task-dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#task-dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit task: Keyboard task', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.locator('#task-form [name=status]').selectOption('review');
  await page.locator('#task-form [type=submit]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-status=review] .card-title')).toHaveText(['Keyboard task']);
});
