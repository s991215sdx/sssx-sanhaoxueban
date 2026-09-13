import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import fs from "node:fs";
import crypto from "node:crypto";
import { env } from "./lib/env";
import { runSeed, runSkeletonSeed } from "../db/seed-core";

const MIGRATIONS_DIR = "db/migrations";

type JournalEntry = { idx: number; when: number; tag: string };

function readJournalEntries(): JournalEntry[] {
  const j = JSON.parse(
    fs.readFileSync(`${MIGRATIONS_DIR}/meta/_journal.json`, "utf8"),
  ) as { entries: JournalEntry[] };
  return j.entries;
}

function migrationHash(tag: string): string {
  const content = fs.readFileSync(`${MIGRATIONS_DIR}/${tag}.sql`, "utf8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

type Db = ReturnType<typeof drizzle>;

/** 把 e.message 与逐层 cause 的 message 拼起来（mysql2/TiDB 的真实报错常藏在 cause 里），限长 800 */
export function formatErr(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  const seen = new Set<unknown>();
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    parts.push(cur instanceof Error ? cur.message : String(cur));
    cur = cur instanceof Error ? (cur as { cause?: unknown }).cause : undefined;
  }
  return parts.join(" <- ").slice(0, 800);
}

/** 启动初始化的实时状态，供探针读取（无法看服务器日志时的唯一窗口） */
export const initStatus = {
  ready: false,
  attempts: 0,
  lastError: null as string | null,
  readyAt: null as number | null,
};

async function tableExists(db: Db, name: string): Promise<boolean> {
  // 注意：drizzle mysql2 走服务端预处理协议，TiDB 对 SHOW 里的 ? 占位符
  // 支持不稳定，表名本就是硬编码常量，转义后直接内联
  const safe = name.replace(/['\\]/g, "");
  const r = await db.execute(sql.raw(`SHOW TABLES LIKE '${safe}'`));
  return (r[0] as unknown as unknown[]).length > 0;
}

async function columnExists(db: Db, table: string, column: string): Promise<boolean> {
  const r = await db.execute(
    sql`SELECT COUNT(*) AS c FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ${table} AND column_name = ${column}`,
  );
  return Number((r[0] as unknown as { c: number }[])[0]?.c ?? 0) > 0;
}

async function indexExists(db: Db, table: string, index: string): Promise<boolean> {
  const r = await db.execute(
    sql`SELECT COUNT(*) AS c FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ${table} AND index_name = ${index}`,
  );
  return Number((r[0] as unknown as { c: number }[])[0]?.c ?? 0) > 0;
}

/**
 * 修复"部分应用"的迁移：TiDB 的 DDL 会隐式提交，若某次迁移中途失败，
 * 已执行的 DDL 会留存但迁移记录被回滚，导致官方迁移器之后每次都在
 * 第一条语句（如 CREATE TABLE users）上报"已存在"而永远卡死。
 * 这里逐效果核对实际落库状态，缺什么补什么，然后补登记迁移记录。
 */
export async function reconcileMigrations(db: Db) {
  if (!(await tableExists(db, "__drizzle_migrations"))) return; // 全新库，交给迁移器
  const rows = await db.execute(sql`SELECT created_at FROM __drizzle_migrations`);
  const applied = new Set(
    (rows[0] as unknown as { created_at: number }[]).map((r) => Number(r.created_at)),
  );
  const entries = readJournalEntries();
  const e2 = entries.find((e) => e.tag.startsWith("0002"));
  const e3 = entries.find((e) => e.tag.startsWith("0003"));

  // 0002：users 表已存在但迁移未登记 → 曾部分应用
  if (e2 && !applied.has(e2.when) && (await tableExists(db, "users"))) {
    console.warn("[initDb] reconciling partially-applied migration", e2.tag);
    const userIdTables = [
      "assessment_results", "attempts", "chat_messages", "daily_plans",
      "error_logs", "guide_sessions", "mastery", "mood_entries",
      "papers", "preview_sessions", "recordings", "student_profile",
    ];
    for (const t of userIdTables) {
      if ((await tableExists(db, t)) && !(await columnExists(db, t, "user_id"))) {
        await db.execute(
          sql.raw(`ALTER TABLE \`${t}\` ADD \`user_id\` bigint unsigned DEFAULT 0 NOT NULL`),
        );
      }
    }
    if (await indexExists(db, "daily_plans", "daily_plans_date_unique")) {
      await db.execute(sql.raw("ALTER TABLE `daily_plans` DROP INDEX `daily_plans_date_unique`"));
    }
    await db.execute(
      sql`INSERT INTO __drizzle_migrations (\`hash\`, \`created_at\`) VALUES (${migrationHash(e2.tag)}, ${e2.when})`,
    );
  }

  // 0003：tutor_sessions 已建或索引已删但迁移未登记 → 曾部分应用
  if (e3 && !applied.has(e3.when)) {
    const hasTutorSessions = await tableExists(db, "tutor_sessions");
    const masteryIndexGone = !(await indexExists(db, "mastery", "mastery_kp_id_unique"));
    if (hasTutorSessions || masteryIndexGone) {
      console.warn("[initDb] reconciling partially-applied migration", e3.tag);
      if (!masteryIndexGone) {
        await db.execute(sql.raw("ALTER TABLE `mastery` DROP INDEX `mastery_kp_id_unique`"));
      }
      if (!hasTutorSessions) {
        await db.execute(sql.raw(`CREATE TABLE \`tutor_sessions\` (
          \`id\` serial AUTO_INCREMENT NOT NULL,
          \`user_id\` bigint unsigned DEFAULT 0 NOT NULL,
          \`error_id\` bigint unsigned NOT NULL,
          \`kp_id\` bigint unsigned NOT NULL,
          \`question_id\` bigint unsigned,
          \`phase\` enum('review','quiz','tutor','done') NOT NULL DEFAULT 'review',
          \`concepts_hit\` json NOT NULL,
          \`messages\` json NOT NULL,
          \`turn\` int NOT NULL DEFAULT 0,
          \`understood\` boolean NOT NULL DEFAULT false,
          \`created_at\` timestamp NOT NULL DEFAULT (now()),
          CONSTRAINT \`tutor_sessions_id\` PRIMARY KEY(\`id\`)
        )`));
      }
      await db.execute(
        sql`INSERT INTO __drizzle_migrations (\`hash\`, \`created_at\`) VALUES (${migrationHash(e3.tag)}, ${e3.when})`,
      );
    }
  }

  // 0004：phone/password_hash 已加但迁移未登记 → 曾部分应用
  const e4 = entries.find((e) => e.tag.startsWith("0004"));
  if (e4 && !applied.has(e4.when) && (await tableExists(db, "users"))) {
    const hasPhone = await columnExists(db, "users", "phone");
    const hasPwHash = await columnExists(db, "users", "password_hash");
    if (hasPhone || hasPwHash) {
      console.warn("[initDb] reconciling partially-applied migration", e4.tag);
      if (!hasPhone) await db.execute(sql.raw("ALTER TABLE `users` ADD `phone` varchar(20)"));
      if (!hasPwHash) await db.execute(sql.raw("ALTER TABLE `users` ADD `password_hash` varchar(255)"));
      await db.execute(
        sql`INSERT INTO __drizzle_migrations (\`hash\`, \`created_at\`) VALUES (${migrationHash(e4.tag)}, ${e4.when})`,
      );
    }
  }

  // 反向核对：日志已登记但关键效果缺失（新库只登记了日志、DDL 没落库）→
  // 删掉该条登记，让 migrate 重跑对应迁移把 DDL 真正落库
  const effects: Record<string, () => Promise<boolean>> = {
    "0000": () => tableExists(db, "knowledge_points"),
    // 0001 无关键效果（仅索引/微调），跳过抽查
    "0002": () => tableExists(db, "users"),
    "0003": () => tableExists(db, "tutor_sessions"),
    "0004": async () => columnExists(db, "users", "phone"),
    "0007": async () => columnExists(db, "knowledge_points", "grade"),
  };
  for (const entry of entries) {
    const prefix = entry.tag.slice(0, 4);
    const check = effects[prefix];
    if (!check || !applied.has(entry.when)) continue;
    if (!(await check())) {
      console.warn(
        "[initDb] migration registered but effect missing, unregistering:",
        entry.tag,
      );
      await db.execute(
        sql`DELETE FROM __drizzle_migrations WHERE created_at = ${entry.when}`,
      );
      applied.delete(entry.when);
    }
  }

  // 无条件幂等修复：0003 的"删 mastery 唯一索引"在事务吞 DDL 时期可能被
  // 跳过却仍被登记，遗留的唯一索引会让 adjustMastery 二次写入同一知识点时报
  // 1062 重复键。这里不看日志、直接按实际状态删，两个库通用。
  // 这两个库曾出现 information_schema 与实际索引状态不一致的幻影，
  // 所以 DROP 一律 best-effort：失败只告警、绝不阻塞迁移流程
  try {
    if (
      (await tableExists(db, "mastery")) &&
      (await indexExists(db, "mastery", "mastery_kp_id_unique"))
    ) {
      console.warn("[initDb] dropping leftover unique index mastery_kp_id_unique");
      await db.execute(
        sql.raw("ALTER TABLE `mastery` DROP INDEX `mastery_kp_id_unique`"),
      );
    }
  } catch (e) {
    console.warn("[initDb] drop mastery_kp_id_unique skipped:", formatErr(e));
  }
  try {
    if (
      (await tableExists(db, "daily_plans")) &&
      (await indexExists(db, "daily_plans", "daily_plans_date_unique"))
    ) {
      console.warn("[initDb] dropping leftover unique index daily_plans_date_unique");
      await db.execute(
        sql.raw("ALTER TABLE `daily_plans` DROP INDEX `daily_plans_date_unique`"),
      );
    }
  } catch (e) {
    console.warn("[initDb] drop daily_plans_date_unique skipped:", formatErr(e));
  }
}

/** 可被容错跳过的幂等冲突错误码（表/列/索引已存在，或删不存在的索引/列） */
const TOLERABLE_ERRNOS = new Set([1050, 1060, 1061, 1091]);

function errNo(e: unknown): number | undefined {
  const anyE = e as { cause?: { errno?: number }; errno?: number } | null;
  return anyE?.cause?.errno ?? anyE?.errno;
}

/**
 * 自研迁移执行器：drizzle 官方 migrator 把所有语句包在事务里执行，
 * 而 TiDB 不支持事务内 DDL（部分 CREATE TABLE 被静默吞掉但日志照样落库）。
 * 这里逐条语句独立执行、独立容错、不用任何事务，幂等可重跑。
 */
export async function runMigrations(db: Db) {
  await db.execute(
    sql.raw(
      "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id serial primary key, hash text not null, created_at bigint)",
    ),
  );
  const rows = await db.execute(sql`SELECT created_at FROM __drizzle_migrations`);
  const applied = new Set(
    (rows[0] as unknown as { created_at: number }[]).map((r) => Number(r.created_at)),
  );
  for (const entry of readJournalEntries()) {
    if (applied.has(entry.when)) continue;
    const content = fs.readFileSync(`${MIGRATIONS_DIR}/${entry.tag}.sql`, "utf8");
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      try {
        await db.execute(sql.raw(stmt));
      } catch (e) {
        const errno = errNo(e);
        if (errno != null && TOLERABLE_ERRNOS.has(errno)) {
          console.warn(`[migrate] tolerating errno ${errno} in ${entry.tag}`);
          continue;
        }
        throw new Error(`migration ${entry.tag} failed: ${formatErr(e)}`);
      }
    }
    await db.execute(
      sql`INSERT INTO __drizzle_migrations (\`hash\`, \`created_at\`) VALUES (${migrationHash(entry.tag)}, ${entry.when})`,
    );
  }
}

/**
 * 生产环境启动时自动初始化数据库：
 * 1. 应用 db/migrations 下的建表迁移
 * 2. 若 knowledge_points 为空则灌入种子数据
 * 带重试（应对 Serverless 数据库冷启动）。
 */
export async function initDb(maxAttempts = 5) {
  let lastErr: unknown;
  let i = 0;
  // Serverless 数据库冷启动可能耗时数分钟：先快速重试，之后转入每分钟一次的
  // 慢速重试（最多约 30 分钟），期间服务保持可用，数据库就绪后自动恢复。
  const maxSlowAttempts = 30;
  while (i < maxAttempts + maxSlowAttempts) {
    i++;
    const slow = i > maxAttempts;
    initStatus.attempts = i;
    try {
      const db = drizzle(env.databaseUrl, { mode: "planetscale" });
      await reconcileMigrations(db);
      await runMigrations(db);
      // 深度种子每次启动都跑：按 code 幂等 upsert，内容随发布更新（题目按知识点重铺）
      {
        const { getDb } = await import("./queries/connection");
        const n = await runSeed(getDb());
        console.log(`[initDb] deep seed upserted ${n} knowledge points`);
      }
      // 全学段知识骨架：幂等（只插不更新），每次启动都跑，新骨架文件随发布自动铺入
      {
        const { getDb } = await import("./queries/connection");
        const added = await runSkeletonSeed(getDb());
        if (added > 0) console.log(`[initDb] skeleton seeded ${added} knowledge points`);
      }
      initStatus.ready = true;
      initStatus.readyAt = Date.now();
      initStatus.lastError = null;
      console.log("[initDb] database ready");
      return;
    } catch (err) {
      lastErr = err;
      initStatus.lastError = formatErr(err);
      const waitMs = slow ? 60_000 : Math.min(i * 5000, 20_000);
      console.warn(
        `[initDb] attempt ${i} failed, retrying in ${waitMs / 1000}s...`,
        initStatus.lastError,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  console.error("[initDb] gave up initializing database", lastErr);
}
