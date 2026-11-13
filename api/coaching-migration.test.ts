import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const tutor = readFileSync("src/pages/Tutor.tsx", "utf8");
const layout = readFileSync("src/components/Layout.tsx", "utf8");

describe("V281 独立陪跑迁移与历史数据边界", () => {
  it("员工端撤下陪跑中心导航，家庭反馈与训练专栏保持原入口", () => {
    expect(tutor).not.toContain('import CoachingWorkspace from "@/components/org/CoachingWorkspace"');
    expect(tutor).not.toContain('{ key: "coaching", label: "陪跑中心", visible: orgView }');
    expect(layout).not.toContain('to="/tutor?section=coaching"');
    expect(layout).not.toContain("showTutorCoaching");
    expect(layout).not.toContain("orgCoachingActive");
    expect(layout).toContain('to="/coaching"');
    expect(layout).toContain("陪跑反馈");
    expect(layout).toContain("陪跑训练专栏");
  });

  it("旧深链仅显示迁移说明，不加载旧陪跑工作台", () => {
    expect(tutor).toContain('["students", "assessments", "coaching", "points", "training"]');
    expect(tutor).toContain('orgView && section === "coaching"');
    expect(tutor).toContain("陪跑中心已迁移至独立系统");
    expect(tutor).toContain("历史数据仍保留在原系统，未自动迁移。");
    expect(tutor).toContain("独立本地版不连接原服务器");
    expect(tutor).toContain('onClick={() => setSection("students")}');
    expect(tutor).toContain("返回学员管理");
    expect(tutor).not.toContain("<CoachingWorkspace");
  });

  it("测评中心保留 GROW 快照，旧工作台按钮统一改为迁移说明", () => {
    const workspace = readFileSync("src/components/org/GrowStudentWorkspace.tsx", "utf8");
    const editor = readFileSync("src/components/org/GrowEditor.tsx", "utf8");
    const snapshot = readFileSync("src/components/org/GrowSnapshot.tsx", "utf8");
    expect(workspace).toContain("此处仅展示当前 GROW 快照与冰山现状");
    expect(workspace).toContain("历史数据仍保留在原系统，未自动迁移");
    expect(workspace).toContain("查看陪跑迁移说明");
    expect(workspace).not.toContain("进入陪跑工作台");
    expect(editor).toContain("陪跑中心已迁移至独立系统 · 查看说明");
    expect(editor).not.toContain("进入独立陪跑：计划、课堂、验收与反馈");
    expect(snapshot).toContain("查看陪跑迁移说明");
    expect(snapshot).not.toContain("更新陪跑进度");
  });

  it("历史陪跑 API 保留，版本号用于测试环境核对", () => {
    const router = readFileSync("api/router.ts", "utf8");
    expect(router).toContain('import { coachingRouter } from "./coachingRouter"');
    expect(router).toContain("coaching: coachingRouter,");
    expect(router).toContain('const BUILD_TAG = "v281-2026-11-13"');
  });
});
