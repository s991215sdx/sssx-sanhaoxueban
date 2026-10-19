import { chromium } from 'playwright-core';
import fs from 'fs';

const OUT = 'D:/KIMI/kimi/tasks/2026-10-02/12-44-25-36022aba/mockups/school-v220';
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'http://106.52.8.20:3001';
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));

await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
await page.screenshot({ path: OUT + '/00-login.png' });

// 登录
await page.fill('input[type="tel"], input[placeholder*="手机"], input[placeholder*="电话"]', '13800000004').catch(()=>{});
// 兜底：填第一个文本输入框
const inputs = page.locator('input');
const n = await inputs.count();
for (let i = 0; i < n; i++) {
  const ph = await inputs.nth(i).getAttribute('placeholder') || '';
  const type = await inputs.nth(i).getAttribute('type') || '';
  if (/tel|手机|电话/.test(type + ph)) { await inputs.nth(i).fill('13800000004'); }
  if (/密码|password/i.test(type + ph)) { await inputs.nth(i).fill('Test220!x'); }
}
await page.screenshot({ path: OUT + '/01-login-filled.png' });
await page.click('button:has-text("登录"), button:has-text("登 录")').catch(()=>page.keyboard.press('Enter'));
await page.waitForTimeout(3000);
await page.screenshot({ path: OUT + '/02-after-login.png' });

// 去 admin
await page.goto(BASE + '/admin', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + '/03-admin-default.png', fullPage: false });

// 点击左侧栏各菜单截图
const items = await page.locator('aside button, aside [role="button"], aside li, nav button').allTextContents().catch(()=>[]);
console.log('aside items:', JSON.stringify(items));
const clickable = page.locator('aside >> text=/测评管理|数据统计|学生管理|学校管理|施测任务|进度看板|选科意向|预警中心|成长档案|学员管理|指导老师|组织架构/');
const cnt = await clickable.count();
for (let i = 0; i < cnt; i++) {
  const label = (await clickable.nth(i).textContent() || 'item' + i).trim().slice(0, 12);
  try {
    await clickable.nth(i).click({ timeout: 3000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/10-menu-${i}-${label}.png` });
  } catch (e) { console.log('click fail', label, String(e).slice(0,100)); }
}

await browser.close();
console.log('done, files:', fs.readdirSync(OUT).join(', '));
