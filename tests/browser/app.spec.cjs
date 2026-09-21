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
async function settings(page, tab='Appearance') { await page.locator('#settings-open').click(); await page.getByRole('tab',{name:tab,exact:true}).click(); }
async function projectNames(page) {
  return page.locator('#projects .project-button').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')));
}
function rgbToHex(rgb) {
  const channels = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  return '#' + channels.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}
function expectedRailInk(color) {
  return color === '#111111' ? '#ffffff' : '#202925';
}

test('project creation and archive clear stale filters, but resizing preserves them', async ({page})=>{
  await addProject(page,'Original');
  await addTask(page,'Original task');
  await page.locator('#search').fill('nothing matches');
  await page.setViewportSize({width:1440,height:700});
  await expect(page.locator('#search')).toHaveValue('nothing matches');
  await addProject(page,'New board');
  await expect(page.locator('#search')).toHaveValue('');
  await addTask(page,'Visible task');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await page.locator('#search').fill('nothing matches');
  await page.getByRole('button',{name:'Project options for New board',exact:true}).click();
  await page.getByRole('menuitem',{name:'Archive project',exact:true}).click();
  await expect(page.locator('#search')).toHaveValue('');
  await expect(page.locator('.card-title')).toHaveText(['Original task']);
});

test('background removal failure does not claim deletion or discard the image',async({page})=>{
  await settings(page,'Background');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=16;c.height=16;c.getContext('2d').fillRect(0,0,16,16);return c.toDataURL().split(',')[1];});
  await page.locator('#bg-file').setInputFiles({name:'pixel.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await expect(page.locator('#bg-remove')).toBeVisible();
  await page.evaluate(()=>{window.KanbaamBackground.deleteImage=async()=>{throw Error('Storage unavailable');};});
  await page.locator('#bg-remove').click();
  await expect(page.locator('#bg-status')).toContainText('Could not remove');
  await expect(page.locator('#bg-remove')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-bg','custom');
});

test('splash uses saved theme, dismisses and only appears once per session', async ({page}) => {
  await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k));s.settings.accent='forest';localStorage.setItem(k,JSON.stringify(s));sessionStorage.removeItem('kanbaam.splash.seen');},key);
  await page.setViewportSize({width:390,height:844});
  await page.reload();
  await expect(page.locator('#splash')).toBeVisible();
  expect(await page.locator('#splash').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(40, 100, 72)');
  await page.locator('.splash-tagline').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
  await page.screenshot({path:'test-results/splash-mobile.png'});
  await page.getByRole('button',{name:'Enter workspace',exact:true}).click();
  await expect(page.locator('#splash')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#splash')).toHaveCount(0);
  await page.evaluate(()=>sessionStorage.removeItem('kanbaam.splash.seen'));
  await page.reload();
  await expect(page.locator('#splash')).toHaveCount(0,{timeout:4000});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>sessionStorage.removeItem('kanbaam.splash.seen'));
  await page.reload();
  await expect(page.locator('#splash')).toHaveCount(0);
});

test('projects archive and restore with tasks intact', async ({page}) => {
  await addProject(page,'Keep');
  await addTask(page,'Preserved task');
  await addProject(page,'Other');
  await page.getByRole('button',{name:'Project options for Keep',exact:true}).click();
  await page.getByRole('menuitem',{name:'Archive project',exact:true}).click();
  await expect(page.locator('h1')).toHaveText('Other');
  await expect(page.locator('#projects .project-button')).toHaveCount(1);
  await page.getByRole('button',{name:'Project options for Other',exact:true}).click();
  await page.getByRole('menuitem',{name:'Archive project',exact:true}).click();
  await page.reload();
  await expect(page.locator('#welcome')).toBeVisible();
  await settings(page,'Data');
  await expect(page.locator('#archived-projects .category-row')).toHaveCount(2);
  await page.getByRole('button',{name:'Restore project Keep',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Keep');
  await expect(page.locator('.task-card')).toHaveCount(1);
  await expect(page.locator('#projects .project-button')).toHaveCount(1);
});

test('projects can be reordered by dragging in the sidebar and persist after reload', async ({ page }) => {
  await addProject(page, 'Alpha');
  await addProject(page, 'Beta');
  await addProject(page, 'Gamma');
  expect(await projectNames(page)).toEqual(['Alpha', 'Beta', 'Gamma']);
  await page.locator('#projects .project-row').filter({ hasText: 'Gamma' }).dragTo(page.locator('#projects .project-row').filter({ hasText: 'Alpha' }));
  await expect.poll(() => projectNames(page)).toEqual(['Gamma', 'Alpha', 'Beta']);
  expect(await page.evaluate(() => Kanbaam.getState().projects.filter(p => !p.archived).map(p => p.name))).toEqual(['Gamma', 'Alpha', 'Beta']);
  await page.reload();
  expect(await projectNames(page)).toEqual(['Gamma', 'Alpha', 'Beta']);
});

test('dynamic categories support tasks, editing, ordering, safe removal and persistence', async ({ page }) => {
  await addProject(page, 'Custom workflow');
  await expect(page.locator('.lane-heading h2')).toHaveText(['Backlog','In progress','Review','Done']);
  await page.locator('#add-category').click();
  await expect(page.getByRole('tab',{name:'Categories',exact:true})).toHaveAttribute('aria-selected','true');
  await page.locator('#settings-add-category').click();
  await page.getByLabel('Category name', {exact:true}).fill('Shipped');
  await page.getByLabel('Category color', {exact:true}).fill('#168477');
  await page.getByLabel('Counts as completed').check();
  await page.getByRole('button',{name:'Save category',exact:true}).click();
  await page.keyboard.press('Escape');
  const status = await page.locator('.lane').last().getAttribute('data-status');
  await addTask(page, 'Release notes', status);
  await settings(page, 'Categories');
  await page.getByRole('button',{name:'Edit category Shipped',exact:true}).click();
  await page.getByLabel('Category name', {exact:true}).fill('Released');
  await page.getByRole('button',{name:'Save category',exact:true}).click();
  await page.getByRole('button',{name:'Move Released left',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('.lane-heading h2')).toHaveText(['Backlog','In progress','Review','Released','Done']);
  await expect(page.locator(`.lane[data-status="${status}"] .task-card`)).toHaveCount(1);
  await settings(page, 'Categories');
  await page.getByRole('button',{name:'Delete category Released',exact:true}).click();
  await page.locator('#remove-category-form').getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('#category-list')).toContainText('Released');
  await page.getByRole('button',{name:'Delete category Released',exact:true}).click();
  await page.locator('#category-destination').selectOption('done');
  await page.locator('#remove-category-form').getByRole('button',{name:'Delete category',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('.lane')).toHaveCount(4);
  await expect(page.locator('.lane[data-status=done] .task-card')).toHaveCount(1);
  await addProject(page, 'Independent workflow');
  await expect(page.locator('.lane-heading h2')).toHaveText(['Backlog','In progress','Review','Done']);
});

test('category templates can extend or replace workflows without deleting cards', async ({ page }) => {
  await addProject(page, 'Templates');
  await addTask(page, 'Backlog card', 'backlog');
  await addTask(page, 'Moving card', 'progress');
  await addTask(page, 'Finished card', 'done');
  await settings(page, 'Categories');
  await page.locator('#category-template').selectOption('marketing');
  await page.locator('#extend-template').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.lane-heading h2')).toHaveText(['Backlog','In progress','Review','Done','Ideas','Briefed','In Production','In Review','Scheduled','Published']);
  await expect(page.locator('.task-card')).toHaveCount(3);

  await settings(page, 'Categories');
  await page.locator('#category-template').selectOption('software');
  await page.locator('#replace-template').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.lane-heading h2')).toHaveText(['Backlog','Ready','In Development','Code Review','QA','Deployed']);
  await expect(page.locator('.lane').nth(0).locator('.card-title')).toHaveText(['Backlog card']);
  await expect(page.locator('.lane').nth(1).locator('.card-title')).toHaveText(['Moving card']);
  await expect(page.locator('.lane').nth(5).locator('.card-title')).toHaveText(['Finished card']);
  await page.reload();
  await expect(page.locator('.lane-heading h2')).toHaveText(['Backlog','Ready','In Development','Code Review','QA','Deployed']);
  await expect(page.locator('.task-card')).toHaveCount(3);
});

test('settings tabs are keyboard accessible and fit narrow screens', async ({ page }) => {
  await addProject(page, 'Settings coverage');
  await page.setViewportSize({width:320,height:740});
  await settings(page);
  await page.getByRole('tab',{name:'Appearance',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Background',exact:true})).toBeFocused();
  for (const name of ['Appearance','Background','Categories','Data']) {
    await page.getByRole('tab',{name,exact:true}).click();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    const overflow = await page.locator('#settings-dialog').evaluate(el=>el.scrollWidth>el.clientWidth);
    expect(overflow).toBe(false);
    const results = await new AxeBuilder({page}).include('#settings-dialog').analyze();
    expect(results.violations).toEqual([]);
  }
  await page.screenshot({path:'test-results/category-settings-mobile.png'});
});

test('starts offline, creates browser JSON automatically, project lifecycle persists', async ({ page, context }) => {
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).version, key)).toBe(1);
  await addProject(page, 'Studio work');
  await addTask(page, 'Finish the brief');
  await addProject(page, 'Weekend');
  await page.locator('#projects .project-button').filter({ hasText: 'Studio work' }).click();
  await expect(page.getByRole('button', { name: 'Edit task: Finish the brief', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Project options for Studio work', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit project' })).toBeFocused();
  await page.getByRole('menuitem', { name: 'Edit project' }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Studio launch');
  await page.locator('#project-dialog').getByLabel('Description').fill('Everything for the spring launch');
  await page.getByRole('radio', { name: 'Rocket', exact: true }).check();
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Studio launch');
  await expect(page.locator('#project-description')).toHaveText('Everything for the spring launch');
  await expect(page.locator('#projects .project-button[aria-current=true] .project-mark svg')).toHaveCount(1);
  await expect(page.locator('.task-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Project options for Studio launch', exact: true }).click();
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Delete project' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.locator('#confirm-button').click();
  await expect(page.locator('h1')).toHaveText('Weekend');
  await expect(page.locator('.task-card')).toHaveCount(0);
});

test('header toggle switches light and dark, and the mobile project menu edits the current project', async ({ page }) => {
  await page.locator('#sample-project').click();
  await settings(page);
  await page.getByRole('combobox', { name: 'Color mode', exact: true }).selectOption('light');
  await page.locator('#settings-dialog [data-close]').click();
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-dark', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-dark', 'true');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-dark', 'false');
  await page.setViewportSize({ width: 390, height: 700 });
  await page.getByRole('button', { name: 'Project options', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit project' }).click();
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('A fresh start · sample');
});

test('custom accent color re-themes the app, stays readable for any pick, and persists', async ({ page }) => {
  await page.locator('#sample-project').click();
  for (const color of ['#ffd400', '#9ff4ff', '#f5f5f5', '#111111']) {
    for (const mode of ['light', 'dark']) {
      await settings(page);
      await page.getByRole('combobox', { name: 'Color mode', exact: true }).selectOption(mode);
      await page.getByLabel('Custom color', { exact: true }).fill(color);
      await expect(page.locator('html')).toHaveAttribute('data-accent', 'custom');
      await expect(page.getByRole('radio', { name: 'Custom', exact: true })).toBeChecked();
      await expect(page.getByLabel('Custom color', { exact: true })).toHaveValue(color);
      const pickerSwatch = await page.getByLabel('Custom color', { exact: true }).evaluate(input => getComputedStyle(input).backgroundColor);
      expect(rgbToHex(pickerSwatch)).toBe(color);
      const rail = await page.locator('html').evaluate(root => getComputedStyle(root).getPropertyValue('--rail').trim());
      const railInk = await page.locator('html').evaluate(root => getComputedStyle(root).getPropertyValue('--rail-ink').trim());
      expect(rail).toBe(color);
      expect(railInk).toBe(expectedRailInk(color));
      await expect.poll(async () => rgbToHex(await page.locator('.sidebar').evaluate(sidebar => getComputedStyle(sidebar).backgroundColor))).toBe(color);
      await page.locator('#settings-dialog [data-close]').click();
      await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)));
      const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations;
      expect(violations.map(v => ({ color, mode, id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
    }
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'custom');
  await settings(page);
  await expect(page.getByLabel('Custom color', { exact: true })).toHaveValue('#111111');
  await page.getByRole('radio', { name: 'Forest', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'forest');
  await expect(page.getByLabel('Custom color', { exact: true })).toHaveValue('#111111');
});

test('task card color defaults to plain, is chosen in the task dialog, persists and stays readable', async ({ page }) => {
  await addProject(page, 'Colors');
  await page.locator('.lane-heading button').first().click();
  await expect(page.getByRole('radio', { name: 'Default', exact: true })).toBeChecked();
  await page.locator('#task-form [name=title]').fill('Plain card');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.locator('.task-card').filter({ hasText: 'Plain card' })).not.toHaveAttribute('data-color');
  const tints = ['rose', 'amber', 'lime', 'teal', 'sky', 'violet', 'slate'];
  for (const tint of tints) {
    await page.locator('.lane-heading button').first().click();
    await page.locator('#task-form [name=title]').fill('Card ' + tint);
    await page.locator('#task-form [name=description]').fill('Readable secondary text');
    await page.locator('#task-form').getByRole('radio', { name: tint[0].toUpperCase() + tint.slice(1), exact: true }).check();
    await page.getByRole('button', { name: 'Save task', exact: true }).click();
  }
  await page.reload();
  for (const tint of tints) await expect(page.locator('.task-card').filter({ hasText: 'Card ' + tint })).toHaveAttribute('data-color', tint);
  await page.getByRole('button', { name: 'Edit task: Card teal', exact: true }).click({ force: true });
  await expect(page.locator('#task-form').getByRole('radio', { name: 'Teal', exact: true })).toBeChecked();
  await page.locator('#task-form').getByRole('radio', { name: 'Default', exact: true }).check();
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.locator('.task-card').filter({ hasText: 'Card teal' })).not.toHaveAttribute('data-color');
  for (const mode of ['light', 'dark']) {
    await settings(page);
    await page.getByRole('combobox', { name: 'Color mode', exact: true }).selectOption(mode);
    await page.locator('#settings-dialog [data-close]').click();
    await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)));
    const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations;
    expect(violations.map(v => ({ mode, id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  }
});

test('background settings: animated default, device-only custom image with dim and blur in both modes', async ({ page }) => {
  await page.locator('#sample-project').click();
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'default');
  expect(await page.locator('.bg-art .bg-flow-a').evaluate(n => getComputedStyle(n).animationName)).toBe('flow-a');
  await settings(page,'Background');
  const dialog = page.locator('#settings-dialog');
  await expect(dialog.getByRole('radio', { name: 'Default', exact: true })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: 'Custom image', exact: true })).toBeDisabled();
  await page.locator('#bg-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.locator('#bg-status')).toContainText('Choose a PNG');
  const png = Buffer.from(await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d'); g.fillStyle = '#2f7d5b'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#f2c14e'; g.fillRect(16, 12, 32, 24); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  await page.locator('#bg-file').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'custom');
  await expect(page.locator('.bg-image')).toHaveAttribute('style', /blob:/);
  await expect(dialog.getByRole('radio', { name: 'Custom image', exact: true })).toBeChecked();
  await expect(page.locator('#bg-dim')).toHaveValue('25');
  await page.getByLabel('Dim', { exact: true }).fill('50');
  await page.getByLabel('Blur', { exact: true }).fill('12');
  await expect(page.locator('#bg-dim-value')).toHaveText('50%');
  await expect(page.locator('#bg-blur-value')).toHaveText('12px');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-dim').trim())).toBe('0.5');
  await page.locator('#settings-dialog [data-close]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'custom');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'custom');
  expect(await page.evaluate(() => JSON.stringify(Kanbaam.getState()))).not.toMatch(/blob:|data:image/);
  await settings(page,'Background');
  await expect(page.locator('#bg-blur')).toHaveValue('12');
  await dialog.getByRole('button', { name: 'Remove image', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'default');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'default');
  await settings(page,'Background');
  await page.getByRole('tab',{name:'Appearance',exact:true}).click();
  await page.getByLabel('Motion & celebrations', { exact: true }).uncheck();
  expect(await page.locator('.bg-art .bg-flow-a').evaluate(n => getComputedStyle(n).animationName)).toBe('none');
});

test('keyboard focus survives re-renders and a drop back in place changes nothing', async ({ page }) => {
  await page.locator('#sample-project').click();
  const sort = page.getByLabel('Sort Backlog', { exact: true });
  await sort.focus();
  await sort.selectOption('priority');
  await expect(page.getByLabel('Sort Backlog', { exact: true })).toBeFocused();

  await page.getByRole('button', { name: 'Project options for A fresh start · sample', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit project' }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Renamed board');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.locator('#projects .project-button[aria-label="Renamed board"]')).toBeFocused();

  await page.evaluate(() => { document.getElementById('announcement').textContent = ''; });
  const card = page.locator('[data-status=backlog] .task-card').first();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + 40, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2, box.y + 30, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await expect(page.getByLabel('Sort Backlog', { exact: true })).toHaveValue('priority');
  await expect(page.locator('#announcement')).not.toContainText('Task moved');
});

test('preview deletion cancels safely, confirms and persists on mobile', async ({ page }) => {
 await page.locator('#sample-project').click();
 await expect(page.locator('.board-tab')).toHaveCount(0);
 await page.setViewportSize({width:320,height:568});
 await page.getByRole('button',{name:'View task: Make this board your own',exact:true}).click();
 const preview=page.locator('#view-dialog');
 await preview.getByRole('button',{name:'Delete task',exact:true}).click();
 await expect(page.locator('#confirm-message')).toContainText('Make this board your own');
 await page.locator('#confirm-dialog button[value=cancel]').click();
 await expect(preview).toBeVisible();
 await expect(page.locator('.task-card')).toHaveCount(5);
 await preview.getByRole('button',{name:'Delete task',exact:true}).click();
 await page.locator('#confirm-button').click();
 await expect(preview).not.toBeVisible();
 await expect(page.locator('.task-card')).toHaveCount(4);
 await page.reload();
 await expect(page.getByRole('button',{name:'View task: Make this board your own',exact:true})).toHaveCount(0);
});

test('glass surfaces have a reduced-transparency fallback', async ({ page, context }) => {
 await page.locator('#sample-project').click();
 expect(await page.locator('.task-card').first().evaluate(n=>getComputedStyle(n).backdropFilter)).toContain('blur');
 const session=await context.newCDPSession(page);
 await session.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
 expect(await page.locator('.task-card').first().evaluate(n=>getComputedStyle(n).backdropFilter)).toBe('none');
 expect(await page.locator('body').evaluate(n=>getComputedStyle(n).backgroundImage)).toBe('none');
 await session.detach();
});

test('tag filters, lane sorting, collapse and sticky headers work together', async ({ page }) => {
 await page.locator('#sample-project').click();
 await expect(page.locator('#tag-filter option')).toHaveText(['All tags','AI Project','Content','Design','Technical Content']);
 await page.locator('#tag-filter').selectOption('design');
 await expect(page.locator('.task-card')).toHaveCount(2);
 await page.locator('#clear-filters').click();
 await page.getByLabel('Sort Backlog', {exact:true}).selectOption('priority');
 await expect(page.locator('[data-status=backlog] .card-title')).toHaveText(['Gather the loose ends','Make this board your own']);
 await page.getByLabel('Sort Backlog', {exact:true}).selectOption('oldest');
 await expect(page.locator('[data-status=backlog] .card-title')).toHaveText(['Make this board your own','Gather the loose ends']);
 await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
 await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
 await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
 const colors=await page.locator('.tag').evaluateAll(nodes=>[...new Set(nodes.map(n=>getComputedStyle(n).backgroundColor))]);
 expect(colors.length).toBeGreaterThan(1);
 await page.setViewportSize({width:1440,height:600});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const heading=await page.locator('.board-heading').boundingBox();
 const status=await page.locator('.lane-header').first().boundingBox();
 await page.locator('#board').evaluate(n=>n.scrollTop=150);
 expect((await page.locator('.board-heading').boundingBox()).y).toBe(heading.y);
 expect(Math.abs((await page.locator('.lane-header').first().boundingBox()).y-status.y)).toBeLessThan(3);
});

test('non-scrolling sidebar pages projects and collapses on mobile', async ({ page }) => {
 await page.setViewportSize({width:1440,height:510});
 for(let i=1;i<=6;i++)await addProject(page,'Project '+i);
 await expect(page.locator('#projects .project-button[aria-current=true]')).toHaveAttribute('aria-label','Project 6');
 await expect(page.locator('#projects .project-button')).toHaveCount(2);
 await page.getByRole('button',{name:'Previous projects',exact:true}).click();
 await expect(page.locator('#projects .project-button')).toHaveCount(2);
 expect(await page.locator('.sidebar').evaluate(n=>n.scrollHeight<=n.clientHeight)).toBe(true);
 const settingsBox=await page.locator('#settings-open').boundingBox();
 expect(settingsBox.y+settingsBox.height).toBeLessThanOrEqual(510);
 await page.getByRole('button',{name:'Next projects',exact:true}).click();
 await expect(page.locator('#projects .project-button')).toHaveCount(2);
 await page.locator('#projects .project-button').filter({hasText:'Project 6'}).click();
 await page.setViewportSize({width:390,height:700});
 await page.getByRole('combobox',{name:'Current project',exact:true}).selectOption({label:'Project 2'});
 await expect(page.locator('h1')).toHaveText('Project 2');
 expect(await page.locator('.sidebar').evaluate(n=>getComputedStyle(n).overflowY)).toBe('hidden');
 await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
 await expect(page.locator('.sidebar')).toHaveClass(/collapsed/);
 await page.locator('#settings-open').click();
 await expect(page.locator('#settings-dialog')).toBeVisible();
 await page.locator('#settings-dialog [data-close]').click();
 await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
 await expect(page.locator('#new-project')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('short screens retain usable board space and sticky headers with long names', async ({ page }) => {
 await page.locator('#sample-project').click();
 await page.evaluate(() => {
   const state=Kanbaam.getState(), project=state.projects[0];
   project.name='A very long project name for a complex launch across multiple product teams';
   for(let i=0;i<15;i++)KanbaamModel.saveTask(project,{title:'Release task '+i,description:'Detailed work for the launch',tags:['Product']});
   localStorage.setItem(Kanbaam.storageKey,JSON.stringify(state));
 });
 await page.reload();
 for(const [width,height] of [[1440,900],[768,600],[390,667],[320,568],[844,390]]) {
   await page.setViewportSize({width,height});
   await page.locator('#board').evaluate(n=>n.scrollTop=0);
   const board=await page.locator('#board').boundingBox();
   expect(board.height).toBeGreaterThan(height*0.5);
   const heading=await page.locator('.board-heading').boundingBox();
   const status=await page.locator('.lane-header').first().boundingBox();
   await page.locator('#board').evaluate(n=>n.scrollTop=240);
   expect(await page.locator('#board').evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
   expect((await page.locator('.board-heading').boundingBox()).y).toBe(heading.y);
   expect(Math.abs((await page.locator('.lane-header').first().boundingBox()).y-status.y)).toBeLessThan(1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`test-results/redesign-${width}x${height}.png`});
 }
});

test('mobile filters expose tags and clear correctly', async ({ page }) => {
 await page.locator('#sample-project').click();
 await page.setViewportSize({width:390,height:667});
 await page.getByRole('button',{name:'Filters',exact:true}).click();
 await page.locator('#tag-filter').selectOption('design');
 await expect(page.locator('.task-card')).toHaveCount(2);
 await page.locator('#clear-filters').click();
 await expect(page.locator('.task-card')).toHaveCount(5);
 await page.getByRole('button',{name:'Filters',exact:true}).click();
 await expect(page.locator('#tag-filter')).not.toBeVisible();
});

test('task edit, filtering, drag, accessible reordering, delete and reload', async ({ page }) => {
  await addProject(page, 'Release');
  await addTask(page, 'First', 'backlog', 'high');
  await addTask(page, 'Second');
  await page.getByRole('button', { name: 'Move Second up', exact: true }).click();
  await expect(page.locator('[data-status=backlog] .card-title')).toHaveText(['Second', 'First']);
  await page.evaluate(()=>Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)));
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

test('background preferences travel through the exported/linked JSON to a second browser', async ({ page }) => {
  // Simulates two browsers sharing one linked file: browser A sets a custom background and exports;
  // browser B (a fresh page importing that same JSON) must show the same preferences, not its own device default.
  // The image itself stays device-local by design (see the Storage decision in an earlier session), so browser B
  // correctly falls back to the default art since it never uploaded an image of its own.
  await page.locator('#sample-project').click();
  await settings(page, 'Background');
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 16; c.height = 16; c.getContext('2d').fillRect(0, 0, 16, 16); return c.toDataURL().split(',')[1]; });
  await page.locator('#bg-file').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByRole('radio', { name: 'Custom image', exact: true })).toBeChecked();
  await page.getByLabel('Dim', { exact: true }).fill('40');
  await page.getByLabel('Blur', { exact: true }).fill('10');
  expect(await page.evaluate(() => Kanbaam.getState().settings.background)).toEqual({ mode: 'custom', dim: 40, blur: 10 });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('tab', { name: 'Data', exact: true }).click();
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const raw = await fs.readFile(await (await downloadEvent).path(), 'utf8');
  expect(JSON.parse(raw).settings.background).toEqual({ mode: 'custom', dim: 40, blur: 10 });
  await page.locator('#settings-dialog [data-close]').click();

  // Simulate a genuinely different browser: clear this origin's workspace storage AND its device-local image
  // store, so nothing survives except what the imported JSON provides.
  await page.evaluate(() => new Promise((resolve, reject) => {
    localStorage.clear();
    const req = indexedDB.deleteDatabase('kanbaam-assets');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
  await page.reload();
  await addProject(page, 'Second browser');
  await settings(page, 'Data');
  await page.locator('#import-file').setInputFiles({ name: 'shared.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await page.locator('#confirm-button').click();
  await expect.poll(() => page.evaluate(() => Kanbaam.getState().settings.background)).toEqual({ mode: 'custom', dim: 40, blur: 10 });
  await page.getByRole('tab', { name: 'Background', exact: true }).click();
  await expect(page.locator('#bg-dim')).toHaveValue('40');
  await expect(page.locator('#bg-blur')).toHaveValue('10');
  // No image was ever uploaded on this device, so it correctly falls back to the default art rather than a blank custom slot.
  await expect(page.locator('html')).toHaveAttribute('data-bg', 'default');
});

test('a linked file reconnects automatically when permission is already granted, or via a Reconnect button otherwise', async ({ page }) => {
  // KanbaamBackground.getHandle would normally read a real FileSystemFileHandle back from IndexedDB; a mock handle
  // (with function properties) can't survive a real IndexedDB round trip, so this stubs getHandle directly instead.
  await page.addInitScript(() => {
    let real;
    Object.defineProperty(window, 'KanbaamBackground', {
      configurable: true,
      get() { return real; },
      set(value) { real = value; real.getHandle = async () => window.__mockHandle; },
    });
  });

  // Permission already granted: reconnect happens with no user action.
  await page.addInitScript(() => {
    window.__mockHandle = { name: 'shared.json', queryPermission: async () => 'granted', requestPermission: async () => 'granted' };
  });
  await page.goto(url);
  await settings(page, 'Data');
  await expect(page.locator('#file-status')).toHaveText('Linked: shared.json · up to date');
  await expect(page.locator('#reconnect-file')).toBeHidden();
  await expect(page.locator('#disconnect-file')).toBeVisible();
  await page.locator('#settings-dialog [data-close]').click();

  // Permission needs to be re-granted: the user gets a Reconnect button instead of silently losing the link.
  await page.addInitScript(() => {
    window.__mockHandle = { name: 'shared.json', queryPermission: async () => 'prompt', requestPermission: async () => 'granted' };
  });
  await page.reload();
  await settings(page, 'Data');
  await expect(page.locator('#reconnect-file')).toBeVisible();
  await expect(page.locator('#file-status')).toContainText('needs permission again');
  await page.locator('#reconnect-file').click();
  await expect(page.locator('#file-status')).toHaveText('Linked: shared.json · up to date');
  await expect(page.locator('#reconnect-file')).toBeHidden();
});

test('real JSON download round trip, confirmation and invalid import protection', async ({ page }) => {
  await addProject(page, 'Export test');
  await addTask(page, '<img src=x onerror=alert(1)>');
  await settings(page,'Data');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const downloaded = await downloadEvent;
  const raw = await fs.readFile(await downloaded.path(), 'utf8');
  const data = JSON.parse(raw);
  expect(data.projects[0].tasks[0].title).toBe('<img src=x onerror=alert(1)>');
  await page.locator('#settings-dialog [data-close]').click();
  await addProject(page, 'Temporary');
  await settings(page,'Data');
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
      await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)));
      const dialogViolations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations;
      expect(dialogViolations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
      await page.locator('#settings-dialog [data-close]').click();
      await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)));
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

test('dragging within a sorted lane inserts relative to the visible order, not stale creation order', async ({ page }) => {
  await addProject(page, 'Sort drag');
  await addTask(page, 'T1', 'backlog', 'low');
  await addTask(page, 'T2', 'backlog', 'high');
  await addTask(page, 'T3', 'backlog', 'medium');
  await addTask(page, 'T4', 'backlog', 'high');
  await page.getByLabel('Sort Backlog', { exact: true }).selectOption('priority');
  await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)));
  await expect(page.locator('[data-status=backlog] .card-title')).toHaveText(['T2', 'T4', 'T3', 'T1']);

  const cardT1 = page.locator('[data-status=backlog] .task-card').filter({ has: page.locator('.card-title', { hasText: /^T1$/ }) });
  const cardT4 = page.locator('[data-status=backlog] .task-card').filter({ has: page.locator('.card-title', { hasText: /^T4$/ }) });
  const t1Box = await cardT1.boundingBox();
  const t4Box = await cardT4.boundingBox();
  await page.mouse.move(t1Box.x + t1Box.width / 2, t1Box.y + 15);
  await page.mouse.down();
  await page.mouse.move(t1Box.x + t1Box.width / 2, t1Box.y + 30, { steps: 5 });
  await page.mouse.move(t4Box.x + t4Box.width / 2, t4Box.y + t4Box.height - 5, { steps: 15 });
  await page.mouse.up();

  // dropped visually between T4 and T3: that must be exactly where it lands, in both the live sorted view and the underlying manual order
  await expect(page.locator('[data-status=backlog] .card-title')).toHaveText(['T2', 'T4', 'T1', 'T3']);
  await page.getByLabel('Sort Backlog', { exact: true }).selectOption('manual');
  await expect(page.locator('[data-status=backlog] .card-title')).toHaveText(['T2', 'T4', 'T1', 'T3']);
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
