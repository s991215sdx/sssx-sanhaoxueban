/* v114 冒烟：答题卷列表改信标 + 细线分隔样式，日期单独灰色显示 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v114 答题卷列表样式", () => {
  it("E/S 信标 + 细线分隔容器", () => {
    const src = read("src/components/AnswerSheetsPanel.tsx");
    if (!/startsWith\("e3"\) \? "E" : "S"/.test(src)) throw new Error("缺：E/S 信标逻辑");
    if (!/divide-y divide-border\/70/.test(src)) throw new Error("缺：细线分隔");
    if (!/h-9 w-9[\s\S]{0,60}rounded-lg bg-\[#EFF3F1\]/.test(src)) throw new Error("缺：信标样式");
  });

  it("标题末尾日期拆出单独灰色显示", () => {
    const src = read("src/components/AnswerSheetsPanel.tsx");
    if (!/b\.title\.match\(\/\^\(\.\*\?\)（\(\\d\{4\}/.test(src)) throw new Error("缺：日期拆分");
    if (!/dateStr && <span className="ml-1\.5 text-\[12px\] font-normal text-olive-mute">/.test(src))
      throw new Error("缺：日期灰色样式");
  });

  it("展开内容缩进对齐信标（pl-12）", () => {
    const src = read("src/components/AnswerSheetsPanel.tsx");
    const n = (src.match(/pl-12/g) ?? []).length;
    if (n < 2) throw new Error(`缺：展开内容缩进（应≥2处，实际${n}）`);
  });
});
