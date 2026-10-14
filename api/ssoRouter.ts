/**
 * v158：一体通 SSO 只读接口——最小权限：仅允许查看短会话绑定的那个学员，且无登录态。
 */
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { getStudentDetail } from "./studentDetail";

export const ssoRouter = createRouter({
  /** SSO 会话绑定的学员详情（档案 + 测评，复用 getStudentDetail 组装，只读）。 */
  studentDetail: publicQuery.input(z.object({ userId: z.number().int() })).query(({ input, ctx }) => {
    if (!ctx.sso || ctx.sso.studentId !== input.userId) {
      throw new Error("链接已失效，请从一体通重新进入");
    }
    return getStudentDetail(getDb(), input.userId);
  }),
});
