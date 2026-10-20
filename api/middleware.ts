import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  /* v96：已删除（软删）的账号一律拒绝对外接口——学员被删后立即失效，
   * 伴学师/管理员要恢复请走回收站。 */
  if (ctx.user.deletedAt) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "该账号已被删除，如需恢复请联系伴学师",
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

function requireRole(role: string) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== role) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

function requireAnyRole(roles: string[]) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || !roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: ErrorMessages.insufficientRole });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const authedQuery = t.procedure.use(requireAuth);
export const adminQuery = authedQuery.use(requireRole("admin"));
/** 伴学师或管理员。 */
export const tutorQuery = authedQuery.use(requireAnyRole(["tutor", "admin"]));
/** v200：教务——只比管理员多一个学员分配相关接口（见 adminRouter 白名单），其余管理接口一律不可访问。 */
export const staffAdminQuery = authedQuery.use(requireAnyRole(["admin", "jiaowu"]));

/* ------------------------------- v229：机构功能权限拦截 ------------------------------- */

import type { OrgServiceKey } from "@contracts/edition";

/**
 * 机构功能权限中间件：平台超管在总系统关闭某功能后，该机构所有账号（职员+学生）
 * 访问对应接口即 403。无机构归属的账号（平台超管/未绑定渠道的学生）不受限。
 */
function requireService(key: OrgServiceKey) {
  return t.middleware(async (opts) => {
    const { ctx } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: ErrorMessages.unauthenticated });
    }
    const { serviceEnabledFor } = await import("./orgServices");
    const { getDb } = await import("./queries/connection");
    const on = await serviceEnabledFor(getDb(), ctx.user, key);
    if (!on) {
      throw new TRPCError({ code: "FORBIDDEN", message: "该功能未对本机构开通，请联系平台管理员" });
    }
    return opts.next({ ctx: { ...ctx, user: ctx.user } });
  });
}

/** 带功能权限校验的过程基座（用法：const tutorQuery = serviceTutorQuery("library")）。 */
export const serviceAuthedQuery = (key: OrgServiceKey) => authedQuery.use(requireService(key));
export const serviceTutorQuery = (key: OrgServiceKey) => authedQuery.use(requireService(key)).use(requireAnyRole(["tutor", "admin"]));
export const serviceAdminQuery = (key: OrgServiceKey) => authedQuery.use(requireService(key)).use(requireRole("admin"));
