/* v96 冒烟：学员删除 / 回收站——软删（users.deleted_at）+ 2 个月保留 + 到期物理清除 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v96 数据层", () => {
  it("schema 与迁移含 users.deleted_at", () => {
    need(read("db/schema.ts"), 'deletedAt: timestamp("deleted_at")', "users.deleted_at 列");
    const mig = read("api/migrationsEmbedded.ts");
    need(mig, "0027_user_soft_delete", "内嵌迁移 0027");
    need(mig, "ADD `deleted_at` timestamp NULL", "迁移 DDL");
    need(mig, "users_deleted_idx", "迁移索引");
  });

  it("recycle.ts：保留期常量、到期清扫、按机构列已删学员", () => {
    const src = read("api/recycle.ts");
    need(src, "RETENTION_MS", "保留期常量");
    need(src, "purgeExpiredStudents", "到期物理清除");
    need(src, "listDeletedStudents", "回收站列表");
    need(src, "purgeStudent", "物理清除单个学员");
  });
});

describe("v96 后端接线", () => {
  const coachSrc = read("api/coachRouter.ts");
  it("coach 三个过程：删除/恢复/回收站", () => {
    need(coachSrc, "deleteStudent", "软删 mutation");
    need(coachSrc, "restoreStudent", "恢复 mutation");
    need(coachSrc, "recycleBin", "回收站 query");
    need(coachSrc, "deletedAt: new Date()", "软删写时间戳");
    need(coachSrc, "deletedAt: null", "恢复清时间戳");
    need(coachSrc, "purgeExpiredStudents", "打开回收站先清扫");
  });

  it("登录与会话拦截已删账号", () => {
    need(read("api/auth-router.ts"), "user.deletedAt", "登录拦截");
    need(read("api/middleware.ts"), "ctx.user.deletedAt", "会话中间件拦截");
  });

  it("学员列表/详情排除已删学员", () => {
    const src = read("api/studentDetail.ts");
    need(src, "deletedAt == null", "列表过滤已删学员");
    need(src, "该学员已被删除", "详情拒绝已删学员");
  });

  it("启动时惰性清扫（失败不阻塞启动）", () => {
    const src = read("api/initDb.ts");
    need(src, "purgeExpiredStudents", "启动清扫");
  });
});

describe("v96 前端接线", () => {
  it("删除按钮组件与两处挂载", () => {
    const btn = read("src/components/DeleteStudentButton.tsx");
    need(btn, "coach.deleteStudent", "删除 mutation");
    need(btn, "移入回收站", "确认文案");
    need(read("src/pages/Tutor.tsx"), "DeleteStudentButton", "伴学工作台学员卡");
    need(read("src/pages/Admin.tsx"), "DeleteStudentButton", "后台学员行");
  });

  it("回收站页面 + 路由 + 导航", () => {
    const page = read("src/pages/RecycleBin.tsx");
    need(page, "coach.recycleBin", "回收站查询");
    need(page, "coach.restoreStudent", "恢复 mutation");
    need(page, "remainingDays", "剩余天数");
    need(read("src/App.tsx"), "/recycle-bin", "路由");
    need(read("src/components/Layout.tsx"), "/recycle-bin", "侧边导航");
  });
});
