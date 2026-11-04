import { chromium } from 'playwright-core';
const BASE = 'https://sanhao.sssx.club';
const OUT = 'D:/KIMI/kimi/tasks/2026-10-02/12-44-25-36022aba/mockups';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 920 }, deviceScaleFactor: 1.2 })).newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await page.locator('input').nth(0).fill('13800000100');
await page.locator('input').nth(1).fill('Yuehua@test2026');
await page.locator('button').nth(1).click();
await page.waitForTimeout(3500);
await page.goto(BASE + '/admin?item=assess', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
// 侧栏滚条检查：可滚动 + scrollbar-width 为 none
const sb = await page.evaluate(() => {
  const nav = document.querySelector('nav[class*="overflow-y-auto"]');
  if (!nav) return 'nav-not-found';
  const cs = getComputedStyle(nav);
  return `scroll=${nav.scrollHeight > nav.clientHeight} sbw=${cs.scrollbarWidth}`;
});
console.log('sidebar:', sb);
// 打开详情弹窗 → 弹窗内切换
await page.getByRole('button', { name: '查看详情' }).first().click();
await page.waitForTimeout(1500);
const modal = page.locator('div.fixed.inset-0.z-50').last();
await modal.locator('button[title="切换封面 / 报告页"]').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + '/v224-detail-switch.png' });
console.log('ok');
await browser.close();
