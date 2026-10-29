// v236 冒烟：家庭关系测评学生卷 → 报告「家庭教育报告」
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
  await page.goto(BASE + '/assessments', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const t = await page.locator('body').innerText();
  console.log('[2] 测评中心含家庭关系:', t.includes('家庭'));
  // 找家庭相关卡片按钮
  const cards = await page.locator('#assessment-list .paper-card h3').allInnerTexts().catch(() => []);
  console.log('[2] 列表卡片:', JSON.stringify(cards));
  const familyCard = page.locator('#assessment-list .paper-card', { hasText: /家庭|亲子/ }).first();
  if (await familyCard.count() > 0) {
    await familyCard.getByRole('button', { name: /开始测评|重新测/ }).first().click();
    await page.waitForTimeout(3000);
  } else { console.log('!! 无家庭卡片'); await browser.close(); return; }
  // 连答：每题点第一个选项，最多 20 题
  for (let i = 0; i < 20; i++) {
    const body = await page.locator('body').innerText();
    if (/结果|完成|报告/.test(body) && !/单选|量表/.test(body)) break;
    const opts = page.locator('.scroll-mt-24 button').filter({ hasNotText: /上一题|跳过/ });
    if (await opts.count() === 0) break;
    await opts.first().click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(3000);
  const rt = await page.locator('body').innerText();
  console.log('[3] 答题结束页面文本片段:', rt.slice(0, 250).replace(/\n/g, ' | '));
  await page.screenshot({ path: 'v236-quiz.png' });
  console.log('[4] pageerror:', errors.length ? errors : '无');
  await browser.close();
})();
