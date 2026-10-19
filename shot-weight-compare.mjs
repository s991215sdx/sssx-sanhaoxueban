import { chromium } from 'playwright-core';
import fs from 'fs';
const OUT = 'D:/KIMI/kimi/tasks/2026-10-02/12-44-25-36022aba/mockups/weight-compare';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'https://sanhao.sssx.club';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
const inputs = page.locator('input');
const n = await inputs.count();
for (let i = 0; i < n; i++) {
  const ph = await inputs.nth(i).getAttribute('placeholder') || '';
  const type = await inputs.nth(i).getAttribute('type') || '';
  if (/tel|手机|电话/.test(type + ph)) await inputs.nth(i).fill('13800000100');
  if (/密码|password/i.test(type + ph)) await inputs.nth(i).fill('Yuehua@test2026');
}
await page.click('button:has-text("登录"), button:has-text("登 录")').catch(()=>page.keyboard.press('Enter'));
await page.waitForTimeout(2500);

const req = ctx.request;
const results = [];
for (const w of [0, 20, 40, 60]) {
  // 调整权重
  const setR = await req.post(BASE + '/api/trpc/school.xuankeWeight.set?batch=1', {
    data: { "0": { json: { scoreWeight: w } } },
    headers: { 'Content-Type': 'application/json' },
  });
  const setJ = await setR.json();
  // 拉统计并计数
  const selR = await req.get(BASE + '/api/trpc/school.stats.selection');
  const selJ = await selR.json();
  const rows = selJ?.result?.data?.json?.rows ?? [];
  let phys = 0, hist = 0, none = 0, withGrades = 0;
  for (const r of rows) {
    const combo = r.comboWeighted?.rec1 ?? r.comboSurvey?.rec1 ?? null;
    if (!combo) { none++; continue; }
    if (combo[0] === '物理') phys++; else if (combo[0] === '历史') hist++; else none++;
    if (r.hasGrades) withGrades++;
  }
  results.push({ weight: w, total: rows.length, phys, hist, none, withGrades, set: setJ?.[0]?.result?.data?.json ?? setJ?.[0]?.error?.json?.message });
  // 截图（统计页年级分析视图）
  await page.goto(BASE + '/admin?item=selection', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/weight-${String(w).padStart(2,'0')}.png` });
}
// 恢复默认 35
await req.post(BASE + '/api/trpc/school.xuankeWeight.set?batch=1', {
  data: { "0": { json: { scoreWeight: 35 } } },
  headers: { 'Content-Type': 'application/json' },
});
console.log(JSON.stringify(results, null, 2));
await browser.close();
