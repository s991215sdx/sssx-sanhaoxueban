/**
 * 把人才测评报告打成 PDF，用来肉眼验收打印版式。
 *
 * 用法：node scripts/talent-pdf.mjs [报告id:输出路径] ...
 *   例：node scripts/talent-pdf.mjs 9:/tmp/a.pdf 10:/tmp/b.pdf
 *   不带参数时按下面 DEFAULTS 出两份样例。
 *
 * 报告 id 来自 scripts/talent-sample.ts 的输出（「报告页：/talent/report/9」）。
 * 打印前确认 body 上有 talent-print 类——报告页自己挂，别在外部补。
 */
import { chromium } from "playwright-core";

const BASE = "http://localhost:3000";
const DEFAULTS = [
  ["9", "/workspace/人才测评-报告样例-行政岗-高度匹配.pdf"],
  ["10", "/workspace/人才测评-报告样例-管理岗-有条件匹配.pdf"],
];

const pairs = process.argv.slice(2).filter((a) => a.includes(":"));
const jobs = pairs.length > 0 ? pairs.map((a) => a.split(":")) : DEFAULTS;

const b = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1100, height: 1200 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[type="tel"]', "13900000001");
await p.fill('input[placeholder="6～64 位"]', "123456");
await p.click('button[type="submit"], button:has-text("登录")');
await p.waitForTimeout(3000);
const who = await p.evaluate(() => document.body.innerText.slice(0, 60));
console.log("登录后页面:", who.replace(/\n/g, " | "));

for (const [id, out] of jobs) {
  await p.goto(`${BASE}/talent/report/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const h1 = await p.evaluate(() => document.querySelector("h1")?.innerText);
  console.log("报告", id, "标题:", h1);
  await p.pdf({ path: out, format: "A4", printBackground: true, margin: { top: "10mm", bottom: "12mm", left: "10mm", right: "10mm" } });
  console.log("  →", out);
}
await b.close();
