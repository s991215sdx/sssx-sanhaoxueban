/* v201 冒烟：粤华校园版专属「预约专业解读」悬浮框。
   需求（孙冬晓 2026-10-18）：学生/家长看完测评想请专业老师解读，测评中心首页右下角悬浮入口，
   点击直达报名页 https://sssx.club/signup.html?c=86ecffbd（外链报名，不做库内表单）。
   仅校园渠道注册学生可见（access.campus 口径，与 v191 校园机制一致）。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v201 预约专业解读悬浮框（校园版专属）", () => {
  const page = read("src/pages/AssessmentCenter.tsx");
  const router = read("api/router.ts");

  it("入口存在且跳转报名链接（v202：无图标小字按钮，位于测评中心标题行）", () => {
    if (!/预约专业解读/.test(page)) throw new Error("缺：按钮文案");
    if (!/sssx\.club\/signup\.html\?c=86ecffbd/.test(page)) throw new Error("缺：报名外链");
    if (!/window\.open\(/.test(page)) throw new Error("缺：新窗口打开");
    if (/PhoneCall/.test(page)) throw new Error("残留：电话图标已移除");
    if (!/<Pointer size=\{13\}/.test(page)) throw new Error("缺：v204 小手图标");
    if (!/fixed bottom-20 right-4/.test(page)) throw new Error("缺：视口悬浮定位（上移避让底部 tab）");
  });

  it("仅校园学生可见（access.campus 门控）", () => {
    if (!/access\?\.campus && \(/.test(page)) throw new Error("缺：campus 门控");
  });

  it("BUILD_TAG 已递增到 v201", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 201) throw new Error(`BUILD_TAG 未递增到 v201（当前 v${v}）`);
  });
});
