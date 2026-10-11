/* v88 冒烟：管理员可在后台总览修改用户姓名（同步学员档案，解决「同学+尾号」占位名） */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v88 管理员修改用户姓名", () => {
  it("后端 setUserName 同步 users 与学员档案并校验长度", () => {
    const src = read("api/adminRouter.ts");
    need(src, "setUserName", "setUserName 接口");
    need(src, 'db.update(users).set({ name })', "更新 users.name");
    need(src, 'db.update(studentProfile).set({ name })', "同步 studentProfile.name");
    need(src, "姓名需 1～32 个字符", "长度校验");
    need(src, "sameOrg", "机构隔离校验");
  });

  it("前端总览列表有改名入口与内联编辑", () => {
    const src = read("src/pages/Admin.tsx");
    need(src, "trpc.admin.setUserName.useMutation", "改名 mutation 接线");
    need(src, "改名", "改名按钮");
    need(src, "renamingId === u.id", "内联编辑态");
  });
});
