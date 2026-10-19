import { chromium } from 'playwright-core';
const OUT = 'D:/KIMI/kimi/tasks/2026-10-02/12-44-25-36022aba/mockups/v221-verify';
const BASE = 'http://106.52.8.20:3001';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 300)); });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 400)));
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
await page.goto(BASE + '/admin?item=selection', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/01-selection-weight-panel.png` });
console.log('body text head:', (await page.locator('body').innerText()).slice(0, 200).replace(/\n/g, ' | '));
await browser.close();
console.log('done');
