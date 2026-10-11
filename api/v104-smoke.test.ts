/* v104 冒烟：得分表标题绿字+小树图标；卡片/标题/侧栏生动化装饰 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v104 得分表标题", () => {
  it("附录标题：绿色字体 + 小树图标", () => {
    const src = read("src/components/reports/AbilityScoreTable.tsx");
    if (!/TreePine size=\{16\}/.test(src)) throw new Error("缺：附录标题 TreePine 图标");
    if (!/text-\[#2F8F60\][\s\S]{0,120}三阶九能观察点得分表/.test(src) &&
        !/三阶九能观察点得分表/.test(src)) throw new Error("缺：附录标题文案");
    if (!/from "lucide-react"/.test(src) || !/TreePine/.test(src.split("from \"lucide-react\"")[0]))
      throw new Error("缺：TreePine 未引入");
  });

  it("答题卷面板两处标题带图标 + 绿色", () => {
    const src = read("src/components/AnswerSheetsPanel.tsx");
    if (!/ClipboardList size=\{14\}/.test(src)) throw new Error("缺：答题卷标题 ClipboardList 图标");
    if (!/TreePine size=\{14\}/.test(src)) throw new Error("缺：三阶九能得分表标题 TreePine 图标");
    if (!/text-\[#2F8F60\]/.test(src)) throw new Error("缺：标题绿色字体");
  });
});

describe("v104 全局生动化装饰", () => {
  it("paper-card 卡片加极淡绿色渐变装饰", () => {
    const src = read("src/index.css");
    if (!/\.paper-card[\s\S]{0,400}radial-gradient/.test(src)) throw new Error("缺：paper-card 渐变装饰");
    if (!/rgba\(14, 168, 117, 0\.0[0-9]\)/.test(src)) throw new Error("缺：brand 绿淡色渐变");
  });

  it("侧栏底部树苗装饰", () => {
    const src = read("src/components/Layout.tsx");
    if (!/Sprout size=\{14\}/.test(src)) throw new Error("缺：侧栏树苗装饰");
    if (!/伴每一棵小树，长成大树/.test(src)) throw new Error("缺：侧栏装饰文案");
  });
});
