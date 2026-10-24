// v233 验证脚本（第3轮）：过新手信息向导 → 多元智能五项全流程
const { chromium } = require('playwright-core');
const BASE = 'http://106.52.8.20:3001';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  async function login(phone, pw) {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    const inputs = page.locator('input');
    await inputs.nth(0).fill(phone);
    await inputs.nth(1).fill(pw);
    await page.getByRole('button', { name: /进入三好学伴/ }).first().click();
    await page.waitForTimeout(3000);
  }

  // 学生已重置为 123456（上一轮已成功）
  await login('19911112222', '123456');
  console.log('[1] 学生登录后 URL:', page.url());
  if (page.url().includes('/login')) { console.log('!! 学生登录失败'); await browser.close(); return; }

  await page.goto(BASE + '/assessments?start=multi5', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // 2. 过「先认识一下你」向导（该生已填过则直接跳过）
  for (let step = 0; step < 8; step++) {
    const txt = await page.locator('body').innerText();
    if (!txt.includes('先认识一下你')) break; // 无向导，已在测评中心
    if (txt.includes('这题我不会')) break; // 已进入答题
    const nameInput = page.locator('input[placeholder*="名字"], input[placeholder*="称呼"]').first();
    if (await nameInput.count() > 0 && await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('冬晓测试');
      await page.waitForTimeout(400);
    }
    const next = page.getByRole('button', { name: /下一步|完成/ }).last();
    if (await next.count() === 0) break;
    await next.click();
    await page.waitForTimeout(2500);
  }

  // 3. 已进入答题（深链直达）；若仍在列表则点卡片进入
  if (await page.getByRole('button', { name: /这题我不会/ }).count() === 0) {
    const card = page.locator('.paper-card', { hasText: '多元智能五项' }).first();
    if (await card.count() === 0) { console.log('!! 找不到多元智能五项卡片'); await browser.close(); return; }
    await card.getByRole('button', { name: /开始测评|重新测/ }).first().click();
    await page.waitForTimeout(3000);
  }

  let quizText = await page.locator('body').innerText();
  console.log('[3] 答题页含「这题我不会」:', quizText.includes('这题我不会'));
  console.log('[3] 通用版标识:', /通用/.test(quizText) ? '有' : '无');
  await page.screenshot({ path: 'v233-quiz-q1.png' });

  // 3. 连点 40 次「这题我不会」
  const qSamples = [];
  for (let i = 0; i < 40; i++) {
    if (i < 5 || i === 20 || i === 39) {
      const qt = await page.locator('.scroll-mt-24 p').nth(1).innerText().catch(() => '');
      qSamples.push(`Q${i + 1}: ${qt.slice(0, 45)}`);
    }
    const dk = page.getByRole('button', { name: /这题我不会/ });
    if (await dk.count() === 0) { console.log(`!! 第 ${i + 1} 题找不到「这题我不会」按钮`); break; }
    await dk.first().click();
    await page.waitForTimeout(150);
  }
  console.log('[4] 题干样例:');
  for (const s of qSamples) console.log('   ', s);
  await page.waitForTimeout(3500);

  const resultText = await page.locator('body').innerText();
  console.log('[5] 结果卡出现:', /· 结果/.test(resultText) ? '是' : '否');
  const m = resultText.match(/综合水平[\s\S]{0,30}?(\d+)[\s\S]{0,15}?细心指数[\s\S]{0,20}?(\d+)%/);
  console.log('[5] 综合水平/细心指数:', m ? `${m[1]} / ${m[2]}%` : '未取到');
  await page.screenshot({ path: 'v233-result.png' });

  const detailBtn = page.getByRole('button', { name: /查看详细报告/ });
  if (await detailBtn.count() > 0) {
    await detailBtn.first().click(); await page.waitForTimeout(4000);
    const rt = await page.locator('body').innerText();
    console.log('[6] 详细报告页含多元智能:', rt.includes('多元智能') ? '正常渲染' : '!! 内容异常');
    await page.screenshot({ path: 'v233-report.png' });
  } else console.log('!! 无查看详细报告按钮');

  console.log('[7] console错误:', errors.length ? errors.slice(0, 5) : '无');
  await browser.close();
})();
