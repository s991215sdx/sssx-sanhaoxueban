/**
 * 人才测评三屏截图（v253 验证用）。
 * 用法：node scripts/talent-shot.mjs [报告id] [邀请码]
 */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const REPORT_ID = process.argv[2] ?? "2";
const CODE = process.argv[3];
const OUT = "/workspace/sim-talent";

const b = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[type="tel"]', "13900000001");
await p.fill('input[placeholder="6～64 位"]', "123456");
await p.click('button[type="submit"], button:has-text("登录")');
await p.waitForTimeout(2500);

await p.goto(`${BASE}/talent`, { waitUntil: "networkidle" });
await p.waitForTimeout(1800);
await p.screenshot({ path: `${OUT}/01-center.png`, fullPage: true });
console.log("center ok");

await p.goto(`${BASE}/talent/report/${REPORT_ID}`, { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
const h = await p.evaluate(() => document.body.scrollHeight);
await p.screenshot({ path: `${OUT}/02-report-full.png`, fullPage: true });
console.log("report ok, height", h);

if (CODE) {
  const g = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const gp = await g.newPage();
  await gp.goto(`${BASE}/t/${CODE}`, { waitUntil: "networkidle" });
  await gp.waitForTimeout(1800);
  await gp.screenshot({ path: `${OUT}/03-join.png`, fullPage: true });
  await gp.fill("input", "王小雨");
  await gp.click('button:has-text("开始")');
  await gp.waitForTimeout(2500);
  await gp.screenshot({ path: `${OUT}/04-quiz.png`, fullPage: false });
  console.log("join ok");
}

await b.close();
