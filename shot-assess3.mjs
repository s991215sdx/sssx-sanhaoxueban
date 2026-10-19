import { chromium } from 'playwright-core';
const OUT = 'D:/KIMI/kimi/tasks/2026-10-02/12-44-25-36022aba/sanhao-github/public/assess';
const BASE = 'https://sanhao.sssx.club';
// [报告视图 tab 文字, 输出文件名]
const TABS = [
  ['学科能力评估', 'subject'], ['职业兴趣', 'holland'],
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

async function openTab(label) {
  await page.goto(`${BASE}/tutor?student=26652343`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  await page.getByRole('button', { name: /查看完整报告/ }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: new RegExp(label) }).first().click();
  await page.waitForTimeout(3500);
}

for (const [label, name] of TABS) {
  try {
    await openTab(label);
    // 封面：打印版第一页
    const printBtn = page.getByRole('button', { name: /打印版/ }).first();
    if (await printBtn.count()) {
      await printBtn.click();
      await page.waitForTimeout(2500);
    }
    await page.mouse.wheel(0, -12000);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}-cover.png` });
    console.log('shot', name + '-cover');
    // 内页：原版报告滚一段
    const origBtn = page.getByRole('button', { name: /原版报告/ }).first();
    if (await origBtn.count()) {
      await origBtn.click();
      await page.waitForTimeout(2000);
    }
    await page.mouse.wheel(0, -12000);
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, 620);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('shot', name);
  } catch (e) { console.log('FAIL', name, String(e).slice(0, 150)); }
}

/* 选科及升学规划报告：封面在 +620，图表页再往下 */
try {
  await openTab('选科及升学规划');
  await page.mouse.wheel(0, -12000);
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, 620);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/xuanke-cover.png` });
  console.log('shot xuanke-cover');
  await page.mouse.wheel(0, 1600);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/xuanke.png` });
  console.log('shot xuanke');
} catch (e) { console.log('FAIL xuanke', String(e).slice(0, 150)); }

await browser.close();
console.log('done');
