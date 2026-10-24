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
  // 展开答题卷行
  const row = page.getByText(/多元智能五项（客观题 · 通用版）/).first();
  if (await row.count() > 0) { await row.click(); await page.waitForTimeout(3000); }
  const t = await page.locator('body').innerText();
  console.log('答题卷展开含题干:', /找规律填数|方向|笔/.test(t));
  console.log('答题卷展开含不会标识:', t.includes('不会') || t.includes('未答'));
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'v233-answers.png' });
  console.log('pageerror:', errors.length ? errors : '无');
  await browser.close();
})();
