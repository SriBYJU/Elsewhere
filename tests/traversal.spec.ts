import { expect, test, type Page } from '@playwright/test';

const position = async (page: Page) => (await page.locator('canvas').getAttribute('data-position'))!.split(',').map(Number);
const enter = async (page: Page) => {
  await page.goto('./#/play/manhattan');
  await expect(page.locator('.explorer--immersive')).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-traversal', 'walking');
  await expect(page.locator('canvas')).toHaveAttribute('data-position', /,/);
};

test('play opens on foot; movement, stationary jumping, and wall collision work', async ({ page }) => {
  test.setTimeout(60000);
  await enter(page);
  const canvas = page.locator('canvas');
  const start = await position(page);
  await canvas.focus();
  await page.keyboard.down('w');
  try { await expect.poll(async () => (await position(page))[2], {timeout:20000}).toBeLessThan(start[2] - .12); }
  finally { await page.keyboard.up('w'); }
  await page.getByRole('button', {name:'Reset camera', exact:true}).click();
  await expect.poll(async () => (await position(page))[2]).toBeCloseTo(start[2], 3);
  await canvas.focus();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await position(page))[1], {intervals:[30,50,75],timeout:20000}).toBeGreaterThan(start[1] + .02);
  await expect(canvas).toHaveAttribute('data-grounded', 'true', {timeout:20000});
  await expect.poll(async () => (await position(page))[1]).toBeCloseTo(start[1], 3);
  // Move out of the intersection before testing the adjacent building wall.
  await page.keyboard.down('w');
  try { await expect.poll(async () => (await position(page))[2], {intervals:[50,100],timeout:20000}).toBeLessThan(3.8); }
  finally { await page.keyboard.up('w'); }
  await page.keyboard.down('a');
  try {
    await expect.poll(async () => (await position(page))[0]).toBeLessThan(start[0] - .07);
    await page.waitForTimeout(650);
    expect((await position(page))[0]).toBeGreaterThan(1.8);
  } finally { await page.keyboard.up('a'); }
});

test('Escape releases captured mouse before leaving the full-screen world', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse capture applies to desktop only.');
  await enter(page);
  await page.getByRole('button', {name:'Click to look around',exact:true}).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-pointer-locked', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).toHaveAttribute('data-pointer-locked', 'false');
  await expect(page.locator('.explorer--immersive')).toBeVisible();
  await page.waitForTimeout(350);
  await page.keyboard.press('Escape');
  await expect(page.locator('.explorer--immersive')).toHaveCount(0);
});

test('held on-screen movement stops on release and node menu stays inside scene', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch controls apply to phones.');
  await enter(page);
  const forward = page.getByRole('button', {name:'Walk forward',exact:true});
  const bounds = (await forward.boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  const before = await position(page);
  await page.mouse.down();
  try { await expect.poll(async () => (await position(page))[2], {timeout:20000}).toBeLessThan(before[2] - .1); }
  finally { await page.mouse.up(); }
  await page.waitForTimeout(200);
  const stopped = await position(page);
  await page.waitForTimeout(350);
  expect((await position(page))[2]).toBeCloseTo(stopped[2], 3);
  await page.locator('summary').filter({hasText:'Nodes'}).click();
  const list = (await page.locator('.world-scene-node-list').boundingBox())!;
  const scene = (await page.locator('.world-scene').boundingBox())!;
  expect(list.y).toBeGreaterThanOrEqual(scene.y);

});
