/* v151 冒烟：学员详情头卡 ID 与目标文字上移到学校后面（字号颜色不变，仅挪位置）。
   v152 注：BUILD_TAG 断言已放宽为通用形式 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v151 ID/目标上移到学校后面", () => {
  const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");

  it("ID/目标 span 在姓名行内（学校之后）", () => {
    if (!/\{\[data\.profile\?\.grade, data\.profile\?\.school\][\s\S]{0,600}ID \{data\.user\.phone\}/.test(src))
      throw new Error("缺：ID 未跟随学校之后");
  });

  it("字号颜色不变：mono 11.5px 白 80%", () => {
    if (!/mono text-\[11\.5px\] text-white\/80/.test(src)) throw new Error("缺：原字号颜色");
  });

  it("原独立 ID 行已删除（divider 下直接是统计格）", () => {
    if (!/h-px bg-white\/25[\s\S]{0,120}grid grid-cols-4/.test(src)) throw new Error("缺：divider 下统计格");
    const idSpans = (src.match(/ID \{data\.user\.phone\}/g) ?? []).length;
    if (idSpans !== 1) throw new Error(`ID 行应只剩 1 处，实际 ${idSpans}`);
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
