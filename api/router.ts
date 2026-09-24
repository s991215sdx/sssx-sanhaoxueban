import { createRouter, publicQuery } from "./middleware";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { graphRouter } from "./graphRouter";
import { previewRouter } from "./previewRouter";
import { gapsRouter } from "./gapsRouter";
import { dashboardRouter } from "./dashboardRouter";
import { profileRouter, assessmentRouter } from "./profileRouter";
import { recordingRouter } from "./recordingRouter";
import { paperRouter } from "./paperRouter";
import { treeholeRouter } from "./treeholeRouter";
import { planRouter } from "./planRouter";
import { guideRouter } from "./guideRouter";
import { tutorRouter } from "./tutorRouter";
import { authRouter } from "./auth-router";
import { adminRouter } from "./adminRouter";
import { inviteRouter } from "./inviteRouter";
import { coachRouter } from "./coachRouter";
import { analyzeRouter } from "./analyzeRouter";
import { orgRouter } from "./orgRouter";

/** 版本标记：每次发版手动递增，用于确认线上跑的是哪一版（平台无部署状态可查） */
const BUILD_TAG = "v59-2026-09-24";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now(), v: BUILD_TAG })),
  /** AI 能力自检：凭据是否配置 + 一次真实模型往返（公开、只读，用于判断网关是否放行） */
  aiHealth: publicQuery.query(async () => {
    const { aiSelfTest } = await import("./ai");
    return aiSelfTest();
  }),
  /** 部署自检：数据库连通性 + 关键表是否就绪（公开、只读，用于排查登录/数据异常） */
  dbHealth: publicQuery.query(async () => {
    const started = Date.now();
    try {
      const db = getDb();
      await db.execute(sql`SELECT 1`);
      const t = await db.execute(sql`SHOW TABLES LIKE 'users'`);
      const usersTable = (t[0] as unknown as unknown[]).length > 0;
      let knowledgePoints = -1;
      try {
        const r = await db.execute(sql`SELECT COUNT(*) AS c FROM knowledge_points`);
        knowledgePoints = Number((r[0] as unknown as { c: number }[])[0]?.c ?? 0);
      } catch {
        knowledgePoints = -1;
      }
      const { initStatus } = await import("./initDb");
      return { ok: true as const, usersTable, knowledgePoints, latencyMs: Date.now() - started, init: initStatus, v: BUILD_TAG };
    } catch (e) {
      const { formatErr } = await import("./initDb");
      return { ok: false as const, error: formatErr(e), latencyMs: Date.now() - started };
    }
  }),
  /** 部署自检：重放启动时的迁移流程并回传结果/报错（与开机自动执行的是同一逻辑，幂等） */
  dbMigrate: publicQuery.query(async () => {
    try {
      const { drizzle } = await import("drizzle-orm/mysql2");
      const { env } = await import("./lib/env");
      const { reconcileMigrations, runMigrations } = await import("./initDb");
      const mdb = drizzle(env.databaseUrl, { mode: "planetscale" });
      // 先逐效果核对补登记（含反向核对），再跑自研迁移器（无事务，TiDB 兼容）：本探针即修复触发器（幂等）
      await reconcileMigrations(mdb);
      await runMigrations(mdb);
      const db = getDb();
      const t = await db.execute(sql`SHOW TABLES LIKE 'users'`);
      const usersTable = (t[0] as unknown as unknown[]).length > 0;
      const m = await db.execute(
        sql`SELECT id, created_at FROM __drizzle_migrations ORDER BY created_at`,
      );
      const migrations = (m[0] as unknown as { id: number; created_at: number }[]).map(
        (r) => r.created_at,
      );
      // 一次调用=完整拉起：种子按 code 幂等 upsert，数量不足全集则补齐
      const k = await db.execute(sql`SELECT COUNT(*) AS c FROM knowledge_points`);
      let knowledgePoints = Number((k[0] as unknown as { c: number }[])[0]?.c ?? 0);
      let seeded = 0;
      const { runSeed, ALL_KPS } = await import("../db/seed-core");
      if (knowledgePoints < ALL_KPS.length) {
        seeded = await runSeed(db);
        const recount = await db.execute(sql`SELECT COUNT(*) AS c FROM knowledge_points`);
        knowledgePoints = Number((recount[0] as unknown as { c: number }[])[0]?.c ?? seeded);
      }
      return { ok: true as const, usersTable, migrations, knowledgePoints, seeded };
    } catch (e) {
      const { formatErr } = await import("./initDb");
      return { ok: false as const, error: formatErr(e) };
    }
  }),
  /** DDL 诊断：判定"CREATE TABLE 成功但表不存在"是落错 schema 还是 DDL 子系统异常（每步独立 try/catch，全部跑完） */
  ddlProbe: publicQuery.query(async () => {
    const { formatErr } = await import("./initDb");
    const steps: Record<string, unknown> = {};
    const db = getDb();
    // 1. 当前会话落在哪个 schema / 哪个连接 / 什么版本
    try {
      const r = await db.execute(
        sql`SELECT DATABASE() AS dbname, CONNECTION_ID() AS connId, @@version AS version`,
      );
      steps.session = (r[0] as unknown as Record<string, unknown>[])[0] ?? null;
    } catch (e) {
      steps.session = `FAIL: ${formatErr(e)}`;
    }
    // 2. 建探针表前先看库里现有的全部表（判断历史 DDL 落库情况）
    try {
      const r = await db.execute(sql.raw("SHOW TABLES"));
      steps.tables = (r[0] as unknown as Record<string, unknown>[]).map(
        (row) => Object.values(row)[0],
      );
    } catch (e) {
      steps.tables = `FAIL: ${formatErr(e)}`;
    }
    // 3. 建探针表
    try {
      await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS ddl_probe (id bigint primary key)"));
      steps.create = "ok";
    } catch (e) {
      steps.create = `FAIL: ${formatErr(e)}`;
    }
    // 3. 同连接立刻 SHOW TABLES 查
    try {
      const r = await db.execute(sql.raw("SHOW TABLES LIKE 'ddl_probe'"));
      steps.showTablesRows = (r[0] as unknown as unknown[]).length;
    } catch (e) {
      steps.showTablesRows = `FAIL: ${formatErr(e)}`;
    }
    // 4. information_schema 里查（看是否落在别的 schema）
    try {
      const r = await db.execute(
        sql`SELECT TABLE_SCHEMA, TABLE_NAME FROM information_schema.tables WHERE TABLE_NAME = 'ddl_probe'`,
      );
      steps.infoSchema = r[0] as unknown as unknown[];
    } catch (e) {
      steps.infoSchema = `FAIL: ${formatErr(e)}`;
    }
    // 5. TiDB 近期 DDL 作业（无权限则记录错误）
    try {
      const r = await db.execute(sql.raw("ADMIN SHOW DDL JOBS 20"));
      steps.ddlJobs = r[0] as unknown as unknown[];
    } catch (e) {
      steps.ddlJobs = `FAIL: ${formatErr(e)}`;
    }
    // 6. 清理探针表
    try {
      await db.execute(sql.raw("DROP TABLE IF EXISTS ddl_probe"));
      steps.drop = "ok";
    } catch (e) {
      steps.drop = `FAIL: ${formatErr(e)}`;
    }
    return steps;
  }),
  /** 部署自检：把 OAuth 回调的每个环节原样跑一遍，回报各环节成败（不含任何真实凭据） */
  oauthDebug: publicQuery.query(async () => {
    const steps: Record<string, string> = {};
    const { env } = await import("./lib/env");
    // 1. 令牌端点可达性（假 code，服务器有任何响应即视为可达）
    try {
      const r = await fetch(`${env.kimiAuthUrl}/api/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "debug-fake-code",
          client_id: env.appId,
          redirect_uri: "https://debug.invalid/api/oauth/callback",
          client_secret: env.appSecret,
        }).toString(),
      });
      steps.tokenEndpoint = `reachable (${r.status})`;
    } catch (e) {
      steps.tokenEndpoint = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }
    // 2. JWKS 验签端点
    try {
      const r = await fetch(`${env.kimiAuthUrl}/api/.well-known/jwks.json`);
      steps.jwks = `reachable (${r.status})`;
    } catch (e) {
      steps.jwks = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }
    // 3. Kimi Open 资料接口（无 token，期望 401）
    try {
      const r = await fetch(`${env.kimiOpenUrl}/v1/users/me/profile`);
      steps.openProfile = `reachable (${r.status})`;
    } catch (e) {
      steps.openProfile = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }
    // 4. 写库路径（与登录回调同一个 upsertUser，写入后立即删除金丝雀行）
    try {
      const { upsertUser, findUserByUnionId } = await import("./queries/users");
      const schema = await import("@db/schema");
      await upsertUser({
        unionId: "__debug_canary__",
        name: "自检",
        lastSignInAt: new Date(),
      });
      const row = await findUserByUnionId("__debug_canary__");
      await getDb().delete(schema.users).where(eq(schema.users.unionId, "__debug_canary__"));
      steps.dbWrite = row ? "ok" : "FAIL: canary not found after insert";
    } catch (e) {
      steps.dbWrite = `FAIL: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`;
    }
    // 5. 会话签发
    try {
      const { signSessionToken } = await import("./kimi/session");
      const t = await signSessionToken({ unionId: "__debug__", clientId: env.appId });
      steps.signSession = t ? "ok" : "FAIL: empty token";
    } catch (e) {
      steps.signSession = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
    }
    return steps;
  }),
  auth: authRouter,
  admin: adminRouter,
  invite: inviteRouter,
  coach: coachRouter,
  org: orgRouter,
  analyze: analyzeRouter,
  graph: graphRouter,
  preview: previewRouter,
  gaps: gapsRouter,
  dashboard: dashboardRouter,
  profile: profileRouter,
  assessment: assessmentRouter,
  recording: recordingRouter,
  paper: paperRouter,
  treehole: treeholeRouter,
  plan: planRouter,
  guide: guideRouter,
  tutor: tutorRouter,
});

export type AppRouter = typeof appRouter;
