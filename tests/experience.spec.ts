import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('compiles, enters, changes, branches, and compares Manhattan', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /turn questions into worlds/i })).toBeVisible();
  await page.getByRole('button', { name: /what if manhattan had no cars/i }).click();
  await expect(page.getByText('THE REALITY COMPILER')).toBeVisible();
  await page.getByRole('button', { name: /enter elsewhere/i }).click();
  await expect(page.getByRole('heading', { name: /manhattan with fewer cars/i })).toBeVisible();
  await page.getByLabel('Private-car reduction').fill('65');
  await expect(page.getByLabel('Active reality')).toContainText('Scenario');
  await page.getByRole('button', { name: /branch reality/i }).click();
  await page.getByLabel('Reality name').fill('Transit first');
  await page.getByRole('button', { name: /create branch/i }).click();
  await expect(page.getByLabel('Active reality')).toContainText('Transit first');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.getByText('See the difference a decision makes.')).toBeVisible();
});

test('opens the neural network and exposes real computation', async ({ page }) => {
  await page.goto('/#/library');
  await page.getByRole('button', { name: /network learning xor/i }).click();
  await page.getByRole('button', { name: /enter elsewhere/i }).click();
  await expect(page.getByRole('heading',{name:/network learning xor/i})).toBeVisible();
  await page.getByRole('button', { name: /data/i }).click();
  await expect(page.getByRole('heading', { name: /every node, in plain sight/i })).toBeVisible();
  await page.getByRole('tab', { name: /x-ray/i }).click();
  await expect(page.getByText(/mechanism beneath the world/i)).toBeVisible();
});

test('researches an arbitrary CPU question and lets the visitor enter and inspect it',async({page})=>{
  await page.route('https://en.wikipedia.org/w/api.php**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({query:{pages:[{title:'Central processing unit',fullurl:'https://en.wikipedia.org/wiki/Central_processing_unit',extract:'A central processing unit executes instructions and coordinates data processing.'},{title:'CPU cache',fullurl:'https://en.wikipedia.org/wiki/CPU_cache',extract:'A cache reduces the average cost of accessing data from memory.'}]}})}));
  await page.goto('/');
  await page.getByLabel('What do you want to understand?').fill('How does a CPU move instructions through memory?');
  await page.getByRole('button',{name:'Compile world'}).click();
  await expect(page.getByText('THE REALITY COMPILER')).toBeVisible();
  await expect(page.getByText(/Retrieved 2 public context sources/)).toBeVisible();
  await page.getByRole('button',{name:/enter elsewhere/i}).click();
  await expect(page.getByRole('heading',{level:1,name:'How does a CPU move instructions through memory'})).toBeVisible();
  const enter=page.getByRole('button',{name:/enter and walk through world/i});
  await expect(enter).toBeVisible();
  await enter.click();
  await expect(page.getByText('ENTERED WORLD')).toBeVisible();
  await page.locator('canvas').press('w');
  await page.locator('summary').filter({hasText:'Nodes'}).click();
  await page.getByRole('button',{name:/Fetch & predict/}).click();
  await expect(page.getByRole('heading',{name:'Fetch & predict'})).toBeVisible();
  await page.getByRole('tab',{name:/source dna/i}).click();
  await expect(page.getByText(/2 SOURCES/)).toBeVisible();
});

test('has no serious automated accessibility violations on the home screen', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  const material = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
  expect(material).toEqual([]);
});
