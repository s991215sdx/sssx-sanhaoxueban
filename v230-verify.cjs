// v230 验证脚本：超管跨机构分配伴学师
const { chromium } = require('playwright-core');
const BASE = 'http://106.52.8.20:3001';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  async function login(phone, pw) {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const inputs = page.locator('input');
    await inputs.nth(0).fill(phone);
    await inputs.nth(1).fill(pw);
    await page.getByRole('button', { name: /进入三好学伴/ }).first().click();
    await page.waitForTimeout(3000);
  }

  // 1. 超管登录
  await login('19900010001', 'Test1234');
  console.log('[1] 超管登录后 URL:', page.url());
  console.log('[1] 页面文本片段:', (await page.locator('body').innerText()).slice(0, 200).replace(/\n/g, ' | '));

  // 2. 进入后台管理 → 学员 tab
  const bodyText = await page.locator('body').innerText();
  if (!bodyText.includes('后台管理')) { console.log('!! 找不到后台管理入口'); }
  await page.getByText('后台管理', { exact: true }).first().click();
  await page.waitForTimeout(2500);
  // 点「学员」tab
  const stuTab = page.getByRole('tab', { name: /^学员$/ }).or(page.getByText('学员', { exact: true }));
  await stuTab.first().click();
  await page.waitForTimeout(2500);
  // 选机构：找机构下拉，选粤华（列表里应出现"东莞粤华学校"或"查看该系统"对应项）
  const sel = page.locator('select').first();
  if (await sel.count() > 0) {
    const opts = await sel.locator('option').allInnerTexts();
    console.log('[2] 机构下拉选项:', JSON.stringify(opts));
    // 找含"粤华"或最后一个 school
    const idx = opts.findIndex(o => o.includes('粤华'));
    if (idx >= 0) { await sel.selectOption({ index: idx }); await page.waitForTimeout(2000); console.log('[2] 已选机构:', opts[idx]); }
  } else { console.log('[2] 页面无 select，可能为自定义下拉'); }
  await page.screenshot({ path: 'v230-students.png' });

  // 勾选第一个学员复选框（跳过全选框和“按班级归类”框）
  const cbs = page.locator('input[type="checkbox"]');
  const n = await cbs.count();
  console.log('[2] 页面复选框数量:', n);
  if (n > 2) { await cbs.nth(2).click(); await page.waitForTimeout(800); console.log('[2] 已勾选学员'); }

  // 找批量分配按钮并点击（学员tab下）
  await page.waitForTimeout(1000);
  const bulkBtn = page.getByRole('button', { name: /批量分配伴学师/ });
  if (await bulkBtn.count() === 0) { console.log('!! 找不到批量分配伴学师按钮'); }
  else {
    await bulkBtn.first().click();
    await page.waitForTimeout(2500);
    // 弹窗里应能搜到其他机构的伴学师
    await page.locator('input:not([type="checkbox"])').last().fill('测试伴学师');
    await page.waitForTimeout(2000);
    const modal = await page.locator('body').innerText();
    const found = ['测试伴学师一', '测试伴学师二', '测试伴学师五'].map(n => `${n}:${modal.includes(n)}`);
    console.log('[3] 弹窗搜索结果:', found.join(', '));
    // 选第一个并保存
    const pick = page.getByText('测试伴学师一', { exact: false }).first();
    if (await pick.count() > 0) {
      await pick.click().catch(() => {});
      await page.waitForTimeout(500);
      const save = page.getByRole('button', { name: /确定|保存|分配/ });
      if (await save.count() > 0) { await save.last().click(); await page.waitForTimeout(2000); console.log('[3] 已点击保存'); }
    }
  }
  await page.screenshot({ path: 'v230-admin.png' });

  // 3. 伴学师1登录验证
  await ctx.clearCookies();
  await login('19900020001', 'Test1234');
  await page.waitForTimeout(2000);
  const t = await page.locator('body').innerText();
  console.log('[4] 伴学师登录后文本片段:', t.slice(0, 300).replace(/\n/g, ' | '));
  await page.screenshot({ path: 'v230-tutor.png' });

  console.log('[5] console错误:', errors.length ? errors.slice(0, 5) : '无');
  await browser.close();
})();
