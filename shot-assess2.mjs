import { chromium } from 'playwright-core';
const OUT = 'D:/KIMI/kimi/tasks/2026-10-02/12-44-25-36022aba/sanhao-github/public/assess';
const BASE = 'https://sanhao.sssx.club';
// [报告视图 tab 文字, 输出文件名]
const TABS = [
  ['选科及升学规划', 'xuanke'], ['学科能力评估', 'subject'], ['职业兴趣', 'holland'],
  ['学业诊断报告', 'e3'], ['多元智能五项', 'multi5'], ['心理健康', 'mental'], ['家长认知冲突报告', 'parent'],
  ['MBTI 性格', 'mbti'], ['DISC 行为', 'disc'], ['职业锚', 'anchor'],
];
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 880 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await page.locator('input').nth(0).fill('13800000100');
await page.locator('input').nth(1).fill('Yuehua@test2026');
await page.locator('button').nth(1).click();
await page.waitForTimeout(3500);
for (const [label, name] of TABS) {
  try {
    await page.goto(`${BASE}/tutor?student=26652343`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6000);
    await page.getByRole('button', { name: /查看完整报告/ }).first().click();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: new RegExp(label) }).first().click();
    await page.waitForTimeout(3500);
    // 封面：滚到最顶再截
    await page.mouse.wheel(0, -12000);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}-cover.png` });
    console.log('shot', name + '-cover');
    // 内页：往下滚一段截图表
    await page.mouse.wheel(0, 620);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('shot', name);
  } catch (e) { console.log('FAIL', name, String(e).slice(0, 150)); }
}
await browser.close();
console.log('done');
