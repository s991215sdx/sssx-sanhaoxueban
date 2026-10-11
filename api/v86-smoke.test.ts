/* v86 冒烟：后台总览用户列表支持按姓名/手机号/邮箱模糊搜索 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v86 用户列表模糊搜索", () => {
  it("后端 admin.users 接收 search 并按姓名/手机号/邮箱 LIKE 过滤", () => {
    const src = read("api/adminRouter.ts");
    need(src, "search?: string", "search 输入参数");
    need(src, "like(users.name, likeKw)", "姓名模糊匹配");
    need(src, "like(users.phone, likeKw)", "手机号模糊匹配");
    need(src, "like(users.email, likeKw)", "邮箱模糊匹配");
    need(src, "replace(/[\\\\%_]/g", "LIKE 通配符转义");
    need(src, "phone: u.phone", "列表返回手机号字段");
  });

  it("前端总览 tab 有搜索框并把关键字传给查询", () => {
    const src = read("src/pages/Admin.tsx");
    need(src, "搜索姓名 / 手机号 / 邮箱", "搜索框占位文案");
    need(src, "debouncedSearch", "防抖后查询");
    need(src, 'trpc.admin.users.useQuery({ ...orgScope, search: debouncedSearch || undefined })', "查询带 search 参数");
    need(src, "没有匹配", "无结果空态文案");
  });
});
