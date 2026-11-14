/**
 * 验收脚本共用的登录态。
 *
 * 为什么要存：登录接口对同一手机号有「10 分钟 10 次」的限流，
 * 一轮验收里 talent-check / talent-shot / talent-pdf 各登录一次就会把自己锁住。
 * 这里第一次登录后把 storageState 落到 /tmp，后续直接复用；过期了再登一次。
 */
import fs from "node:fs";

const BASE = process.env.TALENT_BASE ?? "http://localhost:3000";
const STATE = "/tmp/talent-auth-state.json";
const PHONE = process.env.TALENT_PHONE ?? "13900000001";
const PASS = process.env.TALENT_PASS ?? "123456";

/** 拿一个已登录的页面；同一个浏览器实例内复用存储态 */
export async function openPage(browser, viewport = { width: 1280, height: 1000 }, extra = {}) {
  const ctx = await browser.newContext({
    viewport,
    storageState: fs.existsSync(STATE) ? STATE : undefined,
    ...extra,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/talent`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  if (page.url().includes("/login")) {
    await page.fill('input[type="tel"]', PHONE);
    await page.fill('input[placeholder="6～64 位"]', PASS);
    await page.click('button[type="submit"], button:has-text("登录")');
    await page.waitForTimeout(2500);
    if (page.url().includes("/login")) {
      const tip = await page.evaluate(() => document.body.innerText.match(/尝试太多次[^\n]*/)?.[0] ?? "");
      throw new Error(`登录失败${tip ? "：" + tip : ""}——等 10 分钟或重启 dev server 清掉限流`);
    }
    await ctx.storageState({ path: STATE });
  }
  return page;
}

export { BASE };
