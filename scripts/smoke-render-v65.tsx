/* v65 冒烟：DISC 学生版/家长版「最后一组手动提交按钮 + 恢复进度自动补提交」 */
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";

const need = (html: string, kw: string, where: string) => {
  if (!html.includes(kw)) {
    console.error(`SMOKE_FAIL: ${where} 缺少「${kw}」`);
    process.exit(1);
  }
};

// 1. 源码断言：手动提交按钮 + 统一 finish 入口 + 恢复兜底
const src = readFileSync("src/components/companion/DiscV2Quiz.tsx", "utf8");
need(src, "showSubmit={idx === total - 1}", "学生版最后一组显示提交按钮");
need(src, "autoTriedRef", "学生版恢复进度自动补提交兜底");
need(src, "已帮你跳过去", "漏组提示文案");
need(src, "finish(most, least)", "学生版统一提交入口");
const psrc = readFileSync("src/components/companion/DiscParentQuiz.tsx", "utf8");
need(psrc, "finish(most, least)", "家长版统一提交入口");
need(psrc, "showSubmit={idx === total - 1}", "家长版最后一组显示提交按钮");

// 2. SSR：UI 组件在最后一组渲染提交按钮
import { DiscV2GroupsUI } from "../src/components/companion/DiscV2Quiz";
import { DISC_V2_GROUPS } from "../contracts/assessments";
const total = DISC_V2_GROUPS.length;
const most = DISC_V2_GROUPS.map((_, i) => 0);
const least = DISC_V2_GROUPS.map((_, i) => 1);
const html = renderToString(
  <DiscV2GroupsUI
    groups={DISC_V2_GROUPS}
    idx={total - 1}
    most={most}
    least={least}
    onPick={() => {}}
    onPrev={() => {}}
    pending={false}
    error={false}
    showSubmit
    onSubmit={() => {}}
    submitPending={false}
    submitHint={null}
  />,
);
need(html, "完成提交", "最后一组渲染手动提交按钮");
need(html.replace(/<!-- -->/g, ""), `${total} / ${total}`, "进度显示最后一组");
// 非最后一组不显示提交按钮
const html2 = renderToString(
  <DiscV2GroupsUI
    groups={DISC_V2_GROUPS}
    idx={0}
    most={most}
    least={least}
    onPick={() => {}}
    onPrev={() => {}}
    pending={false}
    error={false}
    showSubmit={false}
    onSubmit={() => {}}
    submitPending={false}
    submitHint={null}
  />,
);
if (html2.includes("完成提交")) {
  console.error("SMOKE_FAIL: 第 1 组不应显示提交按钮");
  process.exit(1);
}

// 3. BUILD_TAG 升级
const routerSrc = readFileSync("api/router.ts", "utf8");
need(routerSrc, "v65-2026-09-24", "BUILD_TAG v65");

console.log("RENDER_SMOKE_V65_OK");
