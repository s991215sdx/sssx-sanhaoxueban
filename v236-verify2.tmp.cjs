// v236 冒烟2：深链直达家庭关系学生卷 → 答完 → 报告
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
  console.log('[1] 学生登录:', page.url().includes('/login') ? '失败' : '成功');
  await page.goto(BASE + '/assessments?start=familystudent', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  let body = await page.locator('body').innerText();
  console.log('[2] 进入学生卷:', body.includes('家庭') ? '是' : '否');
  await page.screenshot({ path: 'v236-family-q1.png' });

  // 连答 14 题：每题点选项区第一个按钮
  for (let i = 0; i < 16; i++) {
    const opts = page.locator('.scroll-mt-24 button').filter({ hasNotText: /上一题/ });
    if (await opts.count() === 0) { console.log(`  第 ${i + 1} 步无选项按钮，可能已结束`); break; }
    await opts.first().click();
    await page.waitForTimeout(350);
    body = await page.locator('body').innerText();
    if (body.includes('结果') && body.includes('家庭教育')) break;
  }
  await page.waitForTimeout(3000);
  body = await page.locator('body').innerText();
  console.log('[3] 提交后文本片段:', body.slice(0, 200).replace(/\n/g, ' | '));
  await page.screenshot({ path: 'v236-family-result.png' });
  // 进报告页看家庭教育报告
  await page.goto(BASE + '/report-detail?tab=family', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const rt = await page.locator('body').innerText();
  console.log('[4] 报告页含家庭教育:', rt.includes('家庭教育'));
  console.log('[4] 报告页含台阶:', rt.includes('台阶'));
  console.log('[4] 单方作答标注:', rt.includes('单方'));
  await page.screenshot({ path: 'v236-family-report.png' });
  console.log('[5] pageerror:', errors.length ? errors : '无');
  await browser.close();
})();
