const { chromium } = require('playwright-core');
const BASE = 'http://106.52.8.20:3001';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const inputs = page.locator('input');
  await inputs.nth(0).fill('19911112222');
  await inputs.nth(1).fill('123456');
  await page.getByRole('button', { name: /进入三好学伴/ }).first().click();
  await page.waitForTimeout(3500);
  console.log('URL:', page.url());
  const t = await page.locator('body').innerText();
  console.log('含多元智能五项:', t.includes('多元智能五项'));
  console.log('含我的测评:', t.includes('我的测评'));
  console.log('含套餐提示:', t.includes('伴学师为你开放') || t.includes('已为你开放'));
  // 滚动到列表底部再取一次
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(1500);
  const t2 = await page.locator('body').innerText();
  console.log('滚动后含多元智能五项:', t2.includes('多元智能五项'));
  const cards = await page.locator('#assessment-list .paper-card h3').allInnerTexts().catch(() => []);
  console.log('列表卡片:', JSON.stringify(cards));
  await page.screenshot({ path: 'v233-debug.png', fullPage: true });
  await browser.close();
})();
