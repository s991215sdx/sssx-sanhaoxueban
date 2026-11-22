import { describe, expect, it } from "vitest";
import { COACHING_SECTIONS, resolveCoachingCaseId, sectionForOperation } from "../src/components/org/coachingNavigation";
import type { CoachingCases } from "../src/components/org/coachingTypes";

const cases = [101, 202].map((id) => ({ coachingCase: { id } })) as unknown as CoachingCases;

describe("陪跑中心九页导航与全局学员联动", () => {
  it("画像紧跟工作台，建档固定在最后", () => {
    expect(COACHING_SECTIONS.map((section) => section.key)).toEqual([
      "workspace", "profile", "overview", "plan", "execute", "growth", "family", "ops", "intake",
    ]);
  });

  it("有效学员选择跨页面保持，无效选择才回退", () => {
    expect(resolveCoachingCaseId(cases, 202)).toBe(202);
    expect(resolveCoachingCaseId(cases, 101)).toBe(101);
    expect(resolveCoachingCaseId(cases, 0)).toBe(101);
    expect(resolveCoachingCaseId(cases, 999)).toBe(101);
    expect(resolveCoachingCaseId([] as unknown as CoachingCases, 202)).toBe(0);
  });

  it("工作台待办进入同一学员的正确页面", () => {
    expect(sectionForOperation()).toBe("overview");
    expect(sectionForOperation("plan")).toBe("plan");
    expect(sectionForOperation("task")).toBe("plan");
    expect(sectionForOperation("session")).toBe("execute");
    expect(sectionForOperation("supervision")).toBe("execute");
    expect(sectionForOperation("record")).toBe("growth");
    expect(sectionForOperation("exception")).toBe("growth");
    expect(sectionForOperation("crisis")).toBe("growth");
    expect(sectionForOperation("quality")).toBe("ops");
    expect(sectionForOperation("handoff")).toBe("ops");
  });
});
