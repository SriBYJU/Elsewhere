import { expect, test } from '@playwright/test';

test('immersive mode fills the viewport and returns to the simulation workspace', async ({ page }) => {
  await page.goto('./#/explore/manhattan');
  await expect(page.getByRole('heading', { name: /manhattan with fewer cars/i })).toBeVisible();
  await page.getByRole('button', { name: 'Expand immersive world', exact: true }).click();
  const explorer = page.locator('.explorer--immersive');
  await expect(explorer).toBeVisible();
  const bounds = await explorer.boundingBox();
  expect(bounds?.width).toBe(page.viewportSize()?.width);
  expect(bounds?.height).toBe(page.viewportSize()?.height);
  await expect(page.getByLabel('Private-car reduction')).not.toBeVisible();
  await page.getByRole('button', { name: 'Exit immersive world', exact: true }).click();
  await expect(page.getByLabel('Private-car reduction')).toBeVisible();
});

test('historical location compiles to a historical world and keeps evidence accessible', async ({ page }) => {
  await page.route('https://en.wikipedia.org/w/api.php**', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({query:{pages:[]}}),
  }));
  await page.goto('./');
  await page.getByLabel('What do you want to understand?').fill('Virginia 2000 years ago');
  await page.getByRole('button', { name: 'Compile world' }).click();
  await page.getByRole('button', { name: /enter elsewhere/i }).click();
  await expect(page.locator('.world-heading')).toContainText(/history|historical/i);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Virginia');
  await page.getByRole('tab', { name: /source dna/i }).click();
  await expect(page.getByRole('heading', { name: /know what you’re standing on/i })).toBeVisible();
});
