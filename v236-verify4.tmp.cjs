// v236 冒烟4：稳健时序答完学生卷（等题号变化）→ 报告验证
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

  const currentNo = async () => {
    const t = await page.locator('.scroll-mt-24').innerText().catch(() => '');
    const m = t.match(/第\s*(\d+)\s*\/\s*(\d+)\s*题/);
    return m ? Number(m[1]) : null;
  };

  for (let i = 0; i < 40; i++) {
    const no = await currentNo();
    if (no == null) { console.log('  无题号（已提交/结束）'); break; }
    const opts = page.locator('.scroll-mt-24 button').filter({ hasNotText: /上一题/ });
    if (await opts.count() === 0) { console.log(`  第 ${no} 题无选项`); break; }
    await opts.first().click();
    // 等题号变化（最多 5 秒）
    try {
      await page.waitForFunction(
        (prev) => {
          const el = document.querySelector('.scroll-mt-24');
          const m = el?.innerText.match(/第\s*(\d+)\s*\/\s*(\d+)\s*题/);
          return !m || Number(m[1]) !== prev;
        },
        no,
        { timeout: 5000 },
      );
    } catch {
      const body = await page.locator('body').innerText();
      if (body.includes('还有题没答完')) { console.log(`  第 ${no} 题答后提示漏答`); }
      else console.log(`  第 ${no} 题后题号未变（可能已提交）`);
      break;
    }
  }
  await page.waitForTimeout(3000);
  let body = await page.locator('body').innerText();
  const errLine = body.includes('还有题没答完') ? '后端仍报漏答' : '无漏答报错';
  console.log('[3] 提交状态:', errLine);
  await page.screenshot({ path: 'v236-family-result.png' });
  await page.goto(BASE + '/report-detail?tab=family', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const rt = await page.locator('body').innerText();
  console.log('[4] 报告页含台阶:', rt.includes('台阶'));
  console.log('[4] 单方标注:', rt.includes('单方'));
  console.log('[4] 安全感:', rt.includes('安全感'));
  await page.screenshot({ path: 'v236-family-report.png' });
  console.log('[5] pageerror:', errors.length ? errors : '无');
  await browser.close();
})();
