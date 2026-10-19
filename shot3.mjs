import { chromium } from 'playwright-core';
const OUT = 'D:/KIMI/kimi/tasks/2026-10-02/12-44-25-36022aba/mockups/school-v220';
const BASE = 'http://106.52.8.20:3001';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
const inputs = page.locator('input');
const n = await inputs.count();
for (let i = 0; i < n; i++) {
  const ph = await inputs.nth(i).getAttribute('placeholder') || '';
  const type = await inputs.nth(i).getAttribute('type') || '';
  if (/tel|手机|电话/.test(type + ph)) await inputs.nth(i).fill('13800000004');
  if (/密码|password/i.test(type + ph)) await inputs.nth(i).fill('Test220!x');
}
await page.click('button:has-text("登录"), button:has-text("登 录")').catch(()=>page.keyboard.press('Enter'));
await page.waitForTimeout(2500);
const shots = [
  ['30-selection-grade', '/admin?item=selection'],
  ['31-selection-students', '/admin?item=students'],
];
for (const [name, url] of shots) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
// 班级分析视图
await page.goto(BASE + '/admin?item=selection', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('text=班级分析');
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/32-selection-class.png' });
await page.click('text=第一推荐分析');
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/33-selection-recommend.png' });
await page.click('text=三轮对比');
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/34-selection-rounds.png' });
// 学员管理：按班级归类
await page.goto(BASE + '/admin?item=students', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.click('text=按班级归类');
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/35-students-grouped.png' });
await browser.close();
console.log('done');
