/* v224 冒烟：测评中心补全（全量目录 + 封面/内页双图 + 机构开放测评配置）+ 侧栏隐形滚条。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v224 测评中心补全 + 机构开放测评配置", () => {
  it("侧栏滚条隐形但保留滚动", () => {
    const layout = read("src/components/Layout.tsx");
    need(layout, "overflow-y-auto", "侧栏可滚动");
    need(layout, "[scrollbar-width:none]", "滚条宽度隐藏");
    need(layout, "[&::-webkit-scrollbar]:hidden", "webkit 滚条隐藏");
    if (layout.includes("[scrollbar-width:thin]")) throw new Error("旧式细滚条未移除");
  });

  it("超管可配机构开放测评（orgRouter.update assessKinds）", () => {
    const org = read("api/orgRouter.ts");
    need(org, "assessKinds", "update 入参");
    need(org, "normalizeAssessKinds(input.assessKinds)", "kind 归一化校验");
    need(org, 'assess: { kinds }', "写入 settings.assess.kinds");
    const schema = read("db/schema.ts");
    need(schema, "assess?: { kinds?: string[] }", "settings 类型扩展");
  });

  it("测评中心按机构开放配置过滤 + 推送限界", () => {
    const api = read("api/schoolRouter.ts");
    need(api, "orgOpenAssessKinds", "开放测评读取");
    need(api, "openKinds", "targets 返回开放清单");
    need(api, "以下测评未对本校开放", "推送越界拦截");
  });

  it("前端目录：11 项全量 + 双图切换 + 开放过滤", () => {
    const center = read("src/components/admin/AssessCenter.tsx");
    for (const k of ["mbti", "disc", "anchor", "subject", "e3parent", "discparent"]) {
      need(center, `key: "${k}"`, `目录项 ${k}`);
    }
    need(center, "imgs: [string, string]", "双图字段");
    need(center, "ShotSwitch", "双图切换组件");
    need(center, "封面", "封面页签");
    need(center, "报告页", "报告内页页签");
    need(center, "openKinds", "开放过滤");
    const orgTab = read("src/components/admin/OrgAdminTab.tsx");
    need(orgTab, "开放全部测评", "超管全部开关");
    need(orgTab, "INVITE_ASSESS_KINDS", "超管勾选清单");
  });

  it("报告效果图素材齐备（封面 + 内页双图）", () => {
    for (const name of ["xuanke", "subject", "holland", "e3", "multi5", "mental", "parent", "mbti", "disc", "anchor"]) {
      read(`public/assess/${name}.png`);
      read(`public/assess/${name}-cover.png`);
    }
  });
});
