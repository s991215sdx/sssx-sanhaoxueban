import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/components/Layout.tsx", "utf8");
const tutor = readFileSync("src/pages/Tutor.tsx", "utf8");
const router = readFileSync("api/router.ts", "utf8");

describe("v257 机构管理员积分管理直达入口", () => {
  it("左侧入口只给机构版管理员，校园版和平台超管不显示", () => {
    expect(layout).toContain('to="/tutor?section=points"');
    expect(layout).toContain('schoolCtx?.edition === "org" && schoolCtx.campus === false');
    expect(layout).toContain("isAdmin && !isPlatformAdmin && user?.orgId != null");
    expect(layout).toContain("orgPointsActive");
  });

  it("工作台读取 section 深链，无权限参数回退学员管理", () => {
    expect(tutor).toContain('searchParams.get("section")');
    expect(tutor).toContain('requestedSection !== "points" || user?.role === "admin"');
    expect(tutor).toContain("canOpenSection ? requestedSection : \"students\"");
    expect(tutor).toContain('params.set("section", next)');
    expect(tutor).toContain('{orgView && user?.role === "admin" && section === "points" && <OrgPointsPanel />}');
  });

  it("保留机构分配页面并递增版本号", () => {
    const panel = readFileSync("src/components/org/OrgPointsPanel.tsx", "utf8");
    expect(panel).toContain("trpc.orgService.allocatePoints.useMutation");
    expect(panel).toContain("trpc.orgService.reclaimPoints.useMutation");
    expect(router).toContain('const BUILD_TAG = "v259-2026-11-07"');
  });
});
