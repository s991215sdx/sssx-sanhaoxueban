/**
 * 人才测评三屏截图（验收用）。
 * 用法：node scripts/talent-shot.mjs [报告id] [邀请码]
 *   不带邀请码时，在中心页点「发一张码给候选人」现开一张，顺便把弹层也拍下来。
 */
import { chromium } from "playwright-core";
import { openPage, BASE } from "./lib/talent-auth.mjs";

const REPORT_ID = process.argv[2] ?? "9";
const CODE_ARG = process.argv[3];
const OUT = "/workspace/sim-talent";

const b = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const p = await openPage(b);

await p.goto(`${BASE}/talent`, { waitUntil: "networkidle" });
await p.waitForTimeout(1800);
await p.screenshot({ path: `${OUT}/01-center.png`, fullPage: true });
console.log("center ok");

let code = CODE_ARG ?? null;
if (!code) {
  await p.click('button:has-text("发一张码给候选人")');
  await p.waitForTimeout(2500);
  /* 弹层里「打开看看」是绝对地址，直接从句子里抠更省事 */
  const shown = await p.evaluate(() => document.querySelector(".fixed.z-50")?.innerText ?? "");
  code = shown.match(/\/t\/([a-z0-9-]+)/i)?.[1] ?? null;
  await p.screenshot({ path: `${OUT}/05-invite.png` });
  console.log("invite ok, code:", code);
}

await p.goto(`${BASE}/talent/report/${REPORT_ID}`, { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
const h = await p.evaluate(() => document.body.scrollHeight);
await p.screenshot({ path: `${OUT}/02-report-full.png`, fullPage: true });
console.log("report ok, height", h);

if (code) {
  const g = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const gp = await g.newPage();
  await gp.goto(`${BASE}/t/${code}`, { waitUntil: "networkidle" });
  await gp.waitForTimeout(1800);
  await gp.screenshot({ path: `${OUT}/03-join.png`, fullPage: true });
  await gp.fill("input", "王小雨");
  await gp.click('button:has-text("开始")');
  await gp.waitForTimeout(2500);
  await gp.screenshot({ path: `${OUT}/04-quiz.png`, fullPage: false });
  console.log("join ok");
}

await b.close();
