/* v89 冒烟：后台总览用户列表提供管理员重置密码入口 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v89 总览列表重置密码", () => {
  it("后端 resetStudentPassword 允许管理员重置本机构任意用户", () => {
    const src = read("api/coachRouter.ts");
    need(src, "resetStudentPassword", "重置密码接口");
    need(src, 'hashPassword("123456")', "重置为默认密码 123456");
    need(src, "sameOrg", "管理员限本机构校验");
  });

  it("前端总览列表接入 ResetPasswordButton", () => {
    const src = read("src/pages/Admin.tsx");
    need(src, 'from "@/components/ResetPasswordButton"', "导入组件");
    need(src, "<ResetPasswordButton userId={u.id}", "列表行接入按钮");
  });
});
