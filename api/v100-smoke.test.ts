/* v100 冒烟：抽屉/弹窗遮罩去绿——v98 全局替换把深色遮罩误换成翡翠绿，改回中性黑 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v100 遮罩去绿", () => {
  it("学员详情抽屉遮罩为中性黑（视觉焦点在抽屉内容）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!src.includes("bg-black/25 backdrop-blur-sm")) throw new Error("抽屉遮罩应为 bg-black/25");
    if (/bg-brand\/30/.test(src)) throw new Error("抽屉遮罩仍残留 bg-brand/30");
  });

  it("机构管理弹窗遮罩同为中性黑", () => {
    const src = read("src/components/admin/OrgAdminTab.tsx");
    if (!src.includes("bg-black/25")) throw new Error("机构弹窗遮罩应为 bg-black/25");
    if (/bg-brand\/30/.test(src)) throw new Error("机构弹窗遮罩仍残留 bg-brand/30");
  });

  it("试卷图片灯箱遮罩为深色（原 bg-olive/80 深色语义）", () => {
    const src = read("src/components/papers/PaperDetail.tsx");
    if (!src.includes("bg-black/70")) throw new Error("灯箱遮罩应为 bg-black/70");
    if (/bg-brand\/80/.test(src)) throw new Error("灯箱遮罩仍残留 bg-brand/80");
  });

  it("全库不再有遮罩级 brand 半透明底（细粒度 tint 除外）", () => {
    for (const f of ["src/components/StudentDetailDrawer.tsx", "src/components/admin/OrgAdminTab.tsx", "src/components/papers/PaperDetail.tsx"]) {
      const src = read(f);
      if (/bg-brand\/(2[05]|30|40|50|60|70|80|90)/.test(src)) throw new Error(f + " 仍有重透明度 brand 遮罩");
    }
  });
});
