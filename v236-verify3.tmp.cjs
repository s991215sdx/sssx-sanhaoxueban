// v236 冒烟3：学生卷全量答完（20 题）→ 报告页验证
const { chromium } = require('playwright-core');
const BASE = 'http://106.52.8.20:3001';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const inputs = page.locator('input');
  await inputs.nth(0).fill('19911112222');
  await inputs.nth(1).fill('123456');
  await page.getByRole('button', { name: /进入三好学伴/ }).first().click();
  await page.waitForTimeout(3500);
  await page.goto(BASE + '/assessments?start=familystudent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 40; i++) {
    const opts = page.locator('.scroll-mt-24 button').filter({ hasNotText: /上一题/ });
    if (await opts.count() === 0) { console.log(`  答完 ${i} 题后无选项，停止`); break; }
    await opts.first().click();
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(3000);
  let body = await page.locator('body').innerText();
  console.log('[3] 提交后文本片段:', body.slice(0, 160).replace(/\n/g, ' | '));
  await page.screenshot({ path: 'v236-family-result.png' });
  await page.goto(BASE + '/report-detail?tab=family', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const rt = await page.locator('body').innerText();
  console.log('[4] 报告页含家庭教育:', rt.includes('家庭教育'));
  console.log('[4] 报告页含台阶:', rt.includes('台阶'));
  console.log('[4] 单方作答标注:', rt.includes('单方'));
  console.log('[4] 安全感/冲突/九十天:', rt.includes('安全感'), rt.includes('冲突'), rt.includes('90') || rt.includes('九十'));
  await page.screenshot({ path: 'v236-family-report.png', fullPage: false });
  console.log('[5] pageerror:', errors.length ? errors : '无');
  await browser.close();
})();
