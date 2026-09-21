import {expect,test} from '@playwright/test';

test('captures desktop, tablet, mobile, and entered-world audit views without horizontal overflow',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='chromium','One browser captures the visual audit set.');
  for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',375,812]] as const){
    await page.setViewportSize({width,height});
    await page.goto('./');
    await page.locator('canvas').waitFor();
    await page.waitForTimeout(500);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,`${name} horizontal overflow`).toBeLessThanOrEqual(1);
    await page.screenshot({path:testInfo.outputPath(`home-${name}.png`),fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.route('https://en.wikipedia.org/w/api.php**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({query:{pages:[{title:'Central processing unit',fullurl:'https://en.wikipedia.org/wiki/Central_processing_unit',extract:'A central processing unit executes instructions and coordinates data processing.'}]}})}));
  await page.goto('./');
  await page.getByLabel('What do you want to understand?').fill('How does a CPU move instructions through memory?');
  await page.getByRole('button',{name:'Compile world'}).click();
  await page.getByRole('button',{name:/enter elsewhere/i}).click();
  await page.getByRole('button',{name:/enter and walk through world/i}).click();
  await expect(page.getByText('EXPLORATION MODE')).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('cpu-entered-world.png'),fullPage:true});
});
