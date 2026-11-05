/**
 * 完整版报告 · 版式自检（v250）
 *
 * 跑法：npx esbuild scripts/fam-preview.ts --bundle --platform=node --format=esm --outfile=out/fam-preview.mjs --alias:@contracts=./contracts
 *      node out/fam-preview.mjs
 * 产物：out/fam-report-preview.html（可直接用 Chromium 打成 PDF 与原版逐页对照）
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { buildFamilyFullReport } from "@contracts/familyFullReport";
import { renderFamilyReportPages, FAM_REPORT_CSS } from "../src/pages/famReportHtml";
import { SAMPLE_INPUT } from "./fam-sample";

const r = buildFamilyFullReport(SAMPLE_INPUT);
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>家庭教育认知测评报告 · 完整版 · 样例</title>
<style>
  body{margin:0;background:#EDEFEC}
  @page{size:A4;margin:0}
  ${FAM_REPORT_CSS}
</style>
</head>
<body>
<div class="famrpt">
${renderFamilyReportPages(r)}
</div>
</body>
</html>`;

mkdirSync("out", { recursive: true });
writeFileSync("out/fam-report-preview.html", html, "utf-8");

/* 顺带把关键数字打出来，方便和原版样例对数 */
console.log("台阶：", r.ladder.rows.map((x) => `${x.level}=${x.verdict}`).join(" "));
console.log("家长 DISC：", r.disc.parent ? `D${r.disc.parent.pct.D} I${r.disc.parent.pct.I} S${r.disc.parent.pct.S} C${r.disc.parent.pct.C}` : "-");
console.log("孩子 DISC：", r.disc.child ? `D${r.disc.child.pct.D} I${r.disc.child.pct.I} S${r.disc.child.pct.S} C${r.disc.child.pct.C}` : "-");
console.log("要求/回应：", r.stage.demand, "/", r.stage.warmth);
console.log("偏离题：", r.deviation.total, "项 →", r.deviation.groups.map((g) => `${g.name} ${g.items.length}`).join("、"));
console.log("动力四问命中：", r.motive.hit);
console.log("安全感：", JSON.stringify(r.security));
console.log("附录学生行：", r.appendix.studentRows.length);
