/**
 * 人才测评三个页面的版式体检：横向溢出 + 报告区块是否齐全。
 *
 * 用法：node scripts/talent-check.mjs
 * 依赖：dev server 在 3000，账号 13900000001 / 123456 已存在。
 *
 * 检查两件事：
 *  1) 桌面（1280）与手机（390）下页面都不该有横向滚动——报告是要在手机上看的；
 *  2) 报告的八个区块按「有没有硬缺口」分两套期望，缺一块就说明条件分支漏了。
 */
import { chromium } from "playwright-core";
import { openPage, BASE } from "./lib/talent-auth.mjs";

const VIEWPORTS = [
  ["桌面", { width: 1280, height: 1000 }],
  ["手机", { width: 390, height: 844 }],
];
/* 9 号是行政岗（高度匹配，无硬缺口），10 号是管理岗（有条件匹配，有硬缺口） */
const REPORTS = [
  ["行政", "9", false],
  ["管理", "10", true],
];
const BASE_KEYS = ["匹配度", "换个岗位会怎样", "十维明细", "特质情商", "发展建议", "面谈时值得追问", "这份报告能用到什么程度"];

const b = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });


for (const [vpName, viewport] of VIEWPORTS) {
  const p = await openPage(b, viewport);
  for (const [label, url] of [["中心", "/talent"], ["行政报告", "/talent/report/9"], ["管理报告", "/talent/report/10"]]) {
    await p.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(2200);
    const info = await p.evaluate(() => {
      const bad = [];
      document.querySelectorAll("*").forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 4 && el.clientWidth > 0) {
          const cs = getComputedStyle(el);
          if (cs.overflowX === "visible" && el.tagName !== "HTML" && el.tagName !== "BODY")
            bad.push(`${el.tagName}.${el.className.toString().slice(0, 36)} sw=${el.scrollWidth} cw=${el.clientWidth}`);
        }
      });
      return { scrollW: document.body.scrollWidth, inner: window.innerWidth, height: document.body.scrollHeight, bad: bad.slice(0, 4) };
    });
    const over = info.scrollW - info.inner;
    console.log(`[${vpName}·${label}] 高=${info.height} 横向溢出=${over}px ${over > 2 ? "← 要修" : ""}`);
    if (info.bad.length) console.log("   溢出元素:", info.bad.join(" | "));
  }
  await p.context().close();
}

const p = await openPage(b);
for (const [label, id, hasGap] of REPORTS) {
  await p.goto(`${BASE}/talent/report/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  const txt = await p.evaluate(() => document.body.innerText);
  const keys = hasGap ? ["硬缺口", ...BASE_KEYS] : BASE_KEYS;
  const missing = keys.filter((k) => !txt.includes(k));
  console.log(`[${label}] 区块 ${keys.length - missing.length}/${keys.length}${missing.length ? " 缺: " + missing.join("、") : ""}`);
}
await b.close();
