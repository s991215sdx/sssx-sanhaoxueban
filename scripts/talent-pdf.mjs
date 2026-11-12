/**
 * 把人才测评报告打成 PDF，用来肉眼验收打印版式、也给外部当样例看。
 *
 * 用法：node scripts/talent-pdf.mjs [报告id ...]
 *   例：node scripts/talent-pdf.mjs 11 12 9 10
 *   不带参数时按下面 DEFAULTS 出全套四岗样例。
 *
 * 报告 id 来自 scripts/talent-sample.ts 的输出（「报告页：/talent/report/11」）。
 * 文件名按页面上的岗位名与档位自动生成，不手写——手写会和实际判档对不上。
 * 打印前确认 body 上有 talent-print 类——报告页自己挂，别在外部补。
 */
import { chromium } from "playwright-core";
import { openPage, BASE } from "./lib/talent-auth.mjs";

/** 四岗各一份 + 一份「暂不匹配」对照，四种分档全齐 */
const DEFAULTS = ["20", "21", "22", "23", "24"];
const OUT_DIR = "/workspace";

const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
const list = ids.length > 0 ? ids : DEFAULTS;

const b = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const p = await openPage(b, { width: 1100, height: 1200 });

for (const id of list) {
  await p.goto(`${BASE}/talent/report/${id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);

  /* 岗位名取自结论标题，档位取结论卡里那个 semibold 徽标——
     不能拿全页关键词扫，四岗对比里也印着别的档位词。 */
  const meta = await p.evaluate(() => {
    const txt = document.body.innerText;
    const pos = txt.match(/与「(.+?)」的匹配度/)?.[1] ?? "";
    const name = document.querySelector("h1")?.innerText ?? "";
    const band = [...document.querySelectorAll("span")].find(
      (s) => String(s.className).includes("text-[12.5px]") && String(s.className).includes("font-semibold"),
    )?.innerText.trim() ?? "";
    return { pos, name, band };
  });
  if (!meta.pos || !meta.band) {
    console.log("报告", id, "信息不全，跳过:", JSON.stringify(meta));
    continue;
  }

  const out = `${OUT_DIR}/人才测评-报告样例-${meta.pos}-${meta.band}.pdf`;
  await p.pdf({ path: out, format: "A4", printBackground: true, margin: { top: "10mm", bottom: "12mm", left: "10mm", right: "10mm" } });
  console.log(`#${id} ${meta.name} · ${meta.pos} · ${meta.band} → ${out}`);
}
await b.close();
