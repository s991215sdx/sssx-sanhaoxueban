import { beforeEach, describe, expect, it, vi } from "vitest";
import { canAccessUser, sameOrg } from "./tenant";
import { isMyStudent } from "./tutorAccess";
import { getStudentDetail } from "./studentDetail";
import { QueryClient } from "@tanstack/react-query";
import { clearIdentityScopedState } from "../src/lib/identitySwitch";

const queryClient = new QueryClient();

/** 顺序返回数据库结果的轻量桩；不冒充真实数据库集成测试。 */
function dbWithReads(reads: unknown[][]) {
  const pending = [...reads];
  const select = vi.fn(() => {
    const builder = {
      from: () => builder,
      innerJoin: () => builder,
      where: () => builder,
      limit: async () => pending.shift() ?? [],
      then: (resolve: (value: unknown[]) => unknown) => resolve(pending.shift() ?? []),
    };
    return builder;
  });
  return { db: { select } as never, select, remaining: pending };
}

describe("v256 多机构、学校身份的后端隔离", () => {
  it("A／B 机构各自按 users.id 取名下学员，历史跨机构关系不能放行", async () => {
    const own = dbWithReads([[{ orgId: 10 }], [{ tutorId: 101 }]]);
    await expect(isMyStudent(own.db, { id: 101, orgId: 10 }, 1001)).resolves.toBe(true);
    const other = dbWithReads([[{ orgId: 20 }]]);
    await expect(isMyStudent(other.db, { id: 101, orgId: 10 }, 2001)).resolves.toBe(false);
    expect(other.select).toHaveBeenCalledOnce();
  });

  it("C 学校管理员与伴学师权限不同，伴学师不能读取同校其他教师的学生", async () => {
    const admin = dbWithReads([[{ orgId: 30, role: "user" }]]);
    await expect(canAccessUser(admin.db, { id: 301, orgId: 30, role: "admin" }, 3001)).resolves.toBe(true);
    const tutor = dbWithReads([[{ orgId: 30 }], [{ tutorId: 999 }], [], []]);
    await expect(canAccessUser(tutor.db, { id: 301, orgId: 30, role: "tutor" }, 3001)).resolves.toBe(false);
  });

  it("管理员跨机构详情被拒绝，且不能靠旧分配绕过", async () => {
    const cross = dbWithReads([[{ orgId: 20, role: "user" }]]);
    await expect(sameOrg(cross.db, { orgId: 10 }, 2001)).resolves.toBe(false);
    const detail = dbWithReads([[{ orgId: 20, role: "user" }]]);
    await expect(getStudentDetail(detail.db, 2001, 10)).rejects.toThrow("无权查看该学员");
  });

  it("无机构旧学员只按明确的本机构关系可见，不再全机构共享", async () => {
    const linked = dbWithReads([
      [{ orgId: null, role: "user" }], [{ userId: 4001 }], [{ userId: 4002 }], [{ userId: 4003 }],
    ]);
    await expect(sameOrg(linked.db, { orgId: 10 }, 4002)).resolves.toBe(true);
    const unlinked = dbWithReads([[{ orgId: null, role: "user" }], [], [], []]);
    await expect(sameOrg(unlinked.db, { orgId: 20 }, 4004)).resolves.toBe(false);
  });
});

describe("v256 切换身份的前端缓存隔离", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it("清除学员、测评、陪跑、积分等查询，关闭旧机构详情参数", async () => {
    const values = new Map([["assessment:mbti", "old-org-task"]]);
    const clear = vi.fn(() => values.clear());
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      sessionStorage: { clear },
      history: { replaceState },
      location: { pathname: "/tutor" },
    });
    queryClient.setQueryData(["coach", "myStudents"], [{ userId: 1001 }]);
    queryClient.setQueryData(["orgPoints", "accounts"], [{ balance: 15000 }]);
    await clearIdentityScopedState(queryClient);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(clear).toHaveBeenCalledOnce();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/tutor");
    vi.unstubAllGlobals();
  });
});
