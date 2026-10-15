/* v99 冒烟：回收站可达性修复 + 伴学师可见范围（自己删的/名下/扫自己码的） */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v99 回收站跳转修复", () => {
  it("RoleGate 员工路径白名单含 /recycle-bin", () => {
    need(read("src/App.tsx"), 'staffPaths = ["/tutor", "/admin", "/recycle-bin", "/library", "/zhihui-report"]', "员工路径白名单");
  });
});

describe("v99 删除人与可见范围", () => {
  it("迁移 0028 + schema 列", () => {
    need(read("db/schema.ts"), 'deletedBy: bigint("deleted_by"', "users.deleted_by 列");
    const mig = read("api/migrationsEmbedded.ts");
    need(mig, "0028_user_deleted_by", "内嵌迁移 0028");
    need(mig, "ADD `deleted_by` bigint unsigned NULL", "迁移 DDL");
  });

  it("软删记录删除人，恢复一并清空", () => {
    const src = read("api/coachRouter.ts");
    need(src, "deletedAt: new Date(), deletedBy: ctx.user.id", "删除写删除人");
    need(src, "deletedAt: null, deletedBy: null", "恢复清删除人");
    need(src, "target.deletedBy !== ctx.user.id", "恢复权限含我删的");
  });

  it("回收站列表带删除人，伴学师按三条件过滤", () => {
    const recycle = read("api/recycle.ts");
    need(recycle, "deletedByName", "列表带删除人");
    need(recycle, "visibleDeletedStudentIds", "可见范围函数");
    const coach = read("api/coachRouter.ts");
    need(coach, "visibleDeletedStudentIds(db, ctx.user.id)", "回收站按可见范围过滤");
  });

  it("isMyStudent 追加扫码注册条件", () => {
    const src = read("api/tutorAccess.ts");
    need(src, "listInviteeStudentIds", "扫码学员集合");
    need(src, "inviteChannels.tutorId", "渠道归属判定");
  });

  it("回收站页面展示删除人", () => {
    need(read("src/pages/RecycleBin.tsx"), "由 {s.deletedByName} 删除", "删除人展示");
  });
});
