const { chromium } = require('playwright-core');
const BASE = 'http://106.52.8.20:3001';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const inputs = page.locator('input');
  await inputs.nth(0).fill('19900010001');
  await inputs.nth(1).fill('Test1234');
  await page.getByRole('button', { name: /进入三好学伴/ }).first().click();
  await page.waitForTimeout(3500);
  await page.goto(BASE + '/tutor?student=18', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const t = await page.locator('body').innerText();
  console.log('抽屉打开:', t.includes('同学2222'));
  console.log('含多元智能:', t.includes('多元智能'));
  await page.screenshot({ path: 'v233-admin-detail.png' });
  // 点多元智能报告入口
  const entry = page.getByText(/多元智能五项/, { exact: false }).first();
  if (await entry.count() > 0) { await entry.click().catch(()=>{}); await page.waitForTimeout(4000); }
  const t2 = await page.locator('body').innerText();
  console.log('报告区含多元智能:', t2.includes('多元智能'));
  console.log('报告区含通用:', t2.includes('通用'));
  const score = t2.match(/综合[^\n]{0,10}/g);
  console.log('综合相关文本:', JSON.stringify(score && score.slice(0,3)));
  await page.screenshot({ path: 'v233-admin-report.png' });
  console.log('pageerror:', errors.length ? errors : '无');
  await browser.close();
})();
