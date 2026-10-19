import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { desc, eq, or, sql } from "drizzle-orm";
import { INVITE_CHANNEL_KINDS, INVITE_ASSESS_KINDS, normalizeInviteCode, normalizeReportKinds, normalizeAssessKinds } from "@contracts/invite";
import { DEFAULT_INVITE_MODULES } from "@contracts/studentModules";
import { inviteChannels, inviteRegistrations, organizations, studentProfile, studentTutor, users } from "@db/schema";
import { createRouter, authedQuery, publicQuery, tutorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { hashPassword, setSessionCookie } from "./auth-router";
import { signSessionToken } from "./kimi/session";
import { env } from "./lib/env";

const PHONE_RE = /^1[3-9]\d{9}$/;
/* 渠道码字母表：去掉 0/o、1/l/i 等易混淆字符，10 位约 2.8e15 空间 */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newInviteCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

/** v82：校验当前用户能否修改该渠道（伴学师只能动自己的码，机构管理员限本机构，平台超管全部）。 */
async function assertChannelEditable(db: ReturnType<typeof getDb>, ctx: { user: { role: string; id: number; orgId: number | null } }, id: number) {
  if (ctx.user.role !== "admin") {
    const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.id, id)).limit(1))[0];
    if (!ch || (ch.tutorId !== ctx.user.id && ch.createdBy !== ctx.user.id)) {
      badRequest("这张二维码不在你名下");
    }
  } else if (ctx.user.orgId != null) {
    const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.id, id)).limit(1))[0];
    if (!ch || (ch.orgId ?? null) !== ctx.user.orgId) badRequest("这张二维码不在你机构内");
  }
}

export const inviteRouter = createRouter({
  /** 管理员/伴学师：新建注册邀请渠道（返回含渠道码的记录，前端据此生成二维码）。伴学师建的码归属自己。 */
  createChannel: tutorQuery
    .input((v: unknown) => v as { name: string; kind: string; note?: string; reportAccess?: boolean; reportKinds?: unknown; assessmentAccess?: boolean; assessmentKinds?: unknown; campus?: boolean })
    .mutation(async ({ ctx, input }) => {
      const name = (input.name ?? "").trim();
      if (name.length < 2 || name.length > 64) badRequest("渠道名 2～64 个字，比如「地推-万达广场点位」");
      const kind = (INVITE_CHANNEL_KINDS as readonly string[]).includes(input.kind) ? input.kind : "其他";
      const note = (input.note ?? "").trim().slice(0, 255) || null;
      /* v191 校园模式：本渠道为学校专用入口（注册免手机号，只填姓名+班级+年级） */
      const campus = !!input.campus;
      /* v80：测评报告功能开关 + 开放的报告种类（注册学员客户端直接可见） */
      const reportAccess = !!input.reportAccess;
      const reportKinds = reportAccess ? normalizeReportKinds(input.reportKinds) : [];
      if (reportKinds == null) badRequest("报告种类格式不对");
      /* v82：测评套餐开关 + 绑定的测评种类（注册学员注册后一站式连做，其余隐藏） */
      const assessmentAccess = !!input.assessmentAccess;
      const assessmentKinds = assessmentAccess ? normalizeAssessKinds(input.assessmentKinds) : [];
      if (assessmentKinds == null) badRequest("测评种类格式不对");
      const tutorId = ctx.user.role === "tutor" ? ctx.user.id : null;
      /* V59：发码人所属机构随码记录，注册学员继承该机构 */
      const orgId = ctx.user.orgId ?? null;
      const db = getDb();
      for (let i = 0; i < 5; i++) {
        const code = newInviteCode();
        try {
          await db.insert(inviteChannels).values({ code, name, kind, note, tutorId, orgId, createdBy: ctx.user.id, reportAccess, reportKinds, assessmentAccess, assessmentKinds, campus });
          const row = (await db.select().from(inviteChannels).where(eq(inviteChannels.code, code)).limit(1))[0];
          if (row) return row;
        } catch {
          /* 渠道码极小概率撞车：换码重试 */
        }
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "生成渠道码失败，请再试一次" });
    }),

  /**
   * v80 管理员/伴学师：修改已有渠道的测评报告开关与开放种类（不动其他字段）。
   * 权限口径与 setChannelActive 一致：伴学师只能动自己的码，机构管理员限本机构，平台超管全部。
   */
  setChannelReports: tutorQuery
    .input((v: unknown) => v as { id: number; reportAccess: boolean; reportKinds?: unknown })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.id, input.id)).limit(1))[0];
        if (!ch || (ch.tutorId !== ctx.user.id && ch.createdBy !== ctx.user.id)) {
          badRequest("这张二维码不在你名下");
        }
      } else if (ctx.user.orgId != null) {
        const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.id, input.id)).limit(1))[0];
        if (!ch || (ch.orgId ?? null) !== ctx.user.orgId) badRequest("这张二维码不在你机构内");
      }
      const reportAccess = !!input.reportAccess;
      const reportKinds = reportAccess ? normalizeReportKinds(input.reportKinds) : [];
      if (reportKinds == null) badRequest("报告种类格式不对");
      await db
        .update(inviteChannels)
        .set({ reportAccess, reportKinds })
        .where(eq(inviteChannels.id, input.id));
      return { ok: true as const };
    }),

  /**
   * v80 学员端：当前账号经哪个渠道注册、该渠道开放了哪些测评报告。
   * 未扫码注册（老账号/后台建号）返回 enabled=false；客户端据此外加放行对应报告栏目。
   */
  myReportAccess: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const reg = (
      await db
        .select({ channelId: inviteRegistrations.channelId })
        .from(inviteRegistrations)
        .where(eq(inviteRegistrations.userId, ctx.user.id))
        .orderBy(desc(inviteRegistrations.id))
        .limit(1)
    )[0];
    if (!reg) return { enabled: false as const, kinds: [] as string[] };
    const ch = (
      await db
        .select({ reportAccess: inviteChannels.reportAccess, reportKinds: inviteChannels.reportKinds })
        .from(inviteChannels)
        .where(eq(inviteChannels.id, reg.channelId))
        .limit(1)
    )[0];
    if (!ch || !ch.reportAccess) return { enabled: false as const, kinds: [] as string[] };
    return { enabled: true as const, kinds: normalizeReportKinds(ch.reportKinds) ?? [] };
  }),

  /**
   * v82 学员端：当前账号经哪个渠道注册、该渠道绑定了哪些测评（测评套餐）。
   * 未扫码注册（老账号/后台建号）返回 enabled=false（客户端不隐藏任何测评，fail-open）。
   * kinds 含 "all" 表示全部测评。
   */
  myAssessmentAccess: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const reg = (
      await db
        .select({ channelId: inviteRegistrations.channelId })
        .from(inviteRegistrations)
        .where(eq(inviteRegistrations.userId, ctx.user.id))
        .orderBy(desc(inviteRegistrations.id))
        .limit(1)
    )[0];
    if (!reg) return { enabled: false as const, kinds: [] as string[], campus: false as const, orgName: null as string | null, brandName: null as string | null };
    const ch = (
      await db
        .select({ assessmentAccess: inviteChannels.assessmentAccess, assessmentKinds: inviteChannels.assessmentKinds, campus: inviteChannels.campus, orgName: organizations.name, brandName: organizations.brandName })
        .from(inviteChannels)
        .leftJoin(organizations, eq(organizations.id, inviteChannels.orgId))
        .where(eq(inviteChannels.id, reg.channelId))
        .limit(1)
    )[0];
    if (!ch || !ch.assessmentAccess) return { enabled: false as const, kinds: [] as string[], campus: false as const, orgName: null as string | null, brandName: null as string | null };
    return { enabled: true as const, kinds: normalizeAssessKinds(ch.assessmentKinds) ?? [], campus: !!ch.campus, orgName: ch.orgName ?? null, brandName: ch.brandName ?? null };
  }),

  /**
   * v199：报告页栏目裁剪用——查看对象（默认本人）是否经校园渠道注册。
   * 权限：本人，或 伴学师/管理员 查看学员时。校园渠道学员的报告页只显示 选科及升学规划/职业兴趣/成绩与目标。
   */
  studentCampus: authedQuery.input((v: unknown) => v as { userId?: number }).query(async ({ ctx, input }) => {
    const target = input?.userId ?? ctx.user.id;
    if (target !== ctx.user.id && ctx.user.role === "user") return { campus: false as const };
    const db = getDb();
    const reg = (
      await db
        .select({ channelId: inviteRegistrations.channelId })
        .from(inviteRegistrations)
        .where(eq(inviteRegistrations.userId, target))
        .orderBy(desc(inviteRegistrations.id))
        .limit(1)
    )[0];
    if (!reg) return { campus: false as const, brand: null as string | null };
    const ch = (
      await db
        .select({ campus: inviteChannels.campus, orgName: organizations.name, brandName: organizations.brandName })
        .from(inviteChannels)
        .leftJoin(organizations, eq(organizations.id, inviteChannels.orgId))
        .where(eq(inviteChannels.id, reg.channelId))
        .limit(1)
    )[0];
    /* v208：校园渠道学生附带机构品牌（报告页脚署名用，如「东莞粤华学校 · 生涯规划测评」） */
    return { campus: !!ch?.campus, brand: ch?.campus ? (ch.brandName || ch.orgName || null) : null };
  }),

  /**
   * v82 管理员/伴学师：修改已有渠道的测评套餐开关与绑定种类（不动其他字段）。
   * 权限口径与 setChannelReports 一致。
   */
  setChannelAssessments: tutorQuery
    .input((v: unknown) => v as { id: number; assessmentAccess: boolean; assessmentKinds?: unknown })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await assertChannelEditable(db, ctx, input.id);
      const assessmentAccess = !!input.assessmentAccess;
      const assessmentKinds = assessmentAccess ? normalizeAssessKinds(input.assessmentKinds) : [];
      if (assessmentKinds == null) badRequest("测评种类格式不对");
      await db
        .update(inviteChannels)
        .set({ assessmentAccess, assessmentKinds })
        .where(eq(inviteChannels.id, input.id));
      return { ok: true as const };
    }),

  /** 管理员看本机构全部渠道（V60：平台超管看全部机构渠道）；伴学师只看自己创建的（含各渠道累计注册数 + 最近 50 条注册记录）。 */
  channels: tutorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const where =
      ctx.user.role === "admin"
        ? ctx.user.orgId == null
          ? undefined /* 平台超管 god mode：全部渠道 */
          : eq(inviteChannels.orgId, ctx.user.orgId)
        : or(eq(inviteChannels.tutorId, ctx.user.id), eq(inviteChannels.createdBy, ctx.user.id));
    const [channels, counts, recent] = await Promise.all([
      db.select().from(inviteChannels).where(where).orderBy(desc(inviteChannels.createdAt)),
      db
        .select({ channelId: inviteRegistrations.channelId, c: sql<number>`count(*)` })
        .from(inviteRegistrations)
        .groupBy(inviteRegistrations.channelId),
      db.select().from(inviteRegistrations).orderBy(desc(inviteRegistrations.createdAt)).limit(50),
    ]);
    const totalMap = new Map(counts.map((r) => [Number(r.channelId), Number(r.c)]));
    const mine = new Set(channels.map((c) => c.id));
    return {
      channels: channels.map((c) => ({ ...c, registrations: totalMap.get(c.id) ?? 0 })),
      /* 只看得到自己权限范围内渠道的注册记录（V59：管理员也限本机构，不看全局） */
      recent: recent.filter((r) => mine.has(r.channelId)),
    };
  }),

  /** 管理员/伴学师：停用/启用渠道——停用后对应二维码立即失效，不再接受新注册。伴学师只能动自己的码。 */
  setChannelActive: tutorQuery
    .input((v: unknown) => v as { id: number; active: boolean })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.id, input.id)).limit(1))[0];
        if (!ch || (ch.tutorId !== ctx.user.id && ch.createdBy !== ctx.user.id)) {
          badRequest("这张二维码不在你名下");
        }
      } else if (ctx.user.orgId != null) {
        /* V59/V60：机构管理员只能动本机构的码；平台超管（orgId=null）可管全部 */
        const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.id, input.id)).limit(1))[0];
        if (!ch || (ch.orgId ?? null) !== ctx.user.orgId) badRequest("这张二维码不在你机构内");
      }
      await db.update(inviteChannels).set({ active: !!input.active }).where(eq(inviteChannels.id, input.id));
      return { ok: true as const };
    }),

  /** 公开：扫码落地页校验渠道码（回渠道名与类型；校园渠道额外回机构品牌信息，不泄露其他信息）。 */
  channelInfo: publicQuery
    .input((v: unknown) => v as { code: string })
    .query(async ({ input }) => {
      const code = normalizeInviteCode(input.code ?? "");
      if (!code) badRequest("二维码无效");
      const db = getDb();
      const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.code, code)).limit(1))[0];
      if (!ch) throw new TRPCError({ code: "NOT_FOUND", message: "二维码无效，请确认是否扫对了" });
      if (!ch.active) badRequest("这张二维码已停用，请联系发码的工作人员换一张新的");
      /* v191 校园模式：回传机构品牌（校徽/校名），落地页按学校品牌展示 */
      let org: { name: string; brandName: string; logoUrl: string | null } | null = null;
      if (ch.campus && ch.orgId != null) {
        const row = (await db.select().from(organizations).where(eq(organizations.id, ch.orgId)).limit(1))[0];
        if (row) org = { name: row.name, brandName: row.brandName, logoUrl: row.logoUrl ?? null };
      }
      return { name: ch.name, kind: ch.kind, campus: !!ch.campus, org };
    }),

  /**
   * v191 公开：校园模式注册（学校专用系统入口，免手机号）。
   * 学生打开学校专属链接 → 只填姓名+班级+年级（学校随渠道固定）→ 完成注册并直接登录。
   * 同渠道同姓名同班级 = 同一账号：再次填写即免密回到原账号（换设备/清缓存场景）。
   * 账号体系：users.phone 留空、密码为随机散列（不可用于密码登录），unionId  deterministic。
   */
  registerCampus: publicQuery
    .input((v: unknown) => v as { code: string; name: string; className: string; grade?: string })
    .mutation(async ({ ctx, input }) => {
      const code = normalizeInviteCode(input.code ?? "");
      const name = (input.name ?? "").trim();
      const className = (input.className ?? "").trim();
      const grade = (input.grade ?? "高一").trim();
      if (!code) badRequest("二维码无效");
      if (name.length < 2 || name.length > 32) badRequest("姓名 2～32 个字");
      if (!className || className.length > 20) badRequest("请填写班级（20 个字以内），如 3 班 / 高一(3)班");
      if (!["高一", "高二", "高三"].includes(grade)) badRequest("年级只支持 高一 / 高二 / 高三");

      const db = getDb();
      const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.code, code)).limit(1))[0];
      if (!ch) throw new TRPCError({ code: "NOT_FOUND", message: "二维码无效，请确认是否扫对了" });
      if (!ch.active) badRequest("这张二维码已停用，请联系老师换一张新的");
      if (!ch.campus) badRequest("这个入口不是校园专用链接");

      const org =
        ch.orgId != null
          ? (await db.select().from(organizations).where(eq(organizations.id, ch.orgId)).limit(1))[0]
          : undefined;
      const unionId = `campus:${ch.id}:${name}:${className}`;

      /* 同姓名同班级 = 老用户回来：直接发会话（免密）。 */
      const existing = (await db.select().from(users).where(eq(users.unionId, unionId)).limit(1))[0];
      if (existing) {
        if (existing.deletedAt) badRequest("这个账号已被删除，请联系老师恢复");
        await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, existing.id));
        const token = await signSessionToken({ unionId: existing.unionId, clientId: env.appId });
        setSessionCookie(ctx, token);
        const rawKinds0 = ch.assessmentAccess ? (normalizeAssessKinds(ch.assessmentKinds) ?? []) : [];
        const assessQueue0 = rawKinds0.includes("all")
          ? ["subject4d", ...INVITE_ASSESS_KINDS.map((k) => k.key).filter((k) => k !== "multi5" && k !== "subject4d")]
          : ["subject4d", ...rawKinds0.filter((k) => k !== "multi5" && k !== "subject4d")];
        return { ok: true as const, isNewUser: false, name: existing.name ?? name, assessQueue: assessQueue0 };
      }

      /* 新注册：users.phone 留空（免手机号），密码随机不可登录，姓名即账号标识。 */
      const passwordHash = hashPassword(randomBytes(18).toString("hex"));
      let userId = 0;
      try {
        const [{ id }] = await db
          .insert(users)
          .values({ unionId, phone: null, passwordHash, name, orgId: ch.orgId ?? null, lastSignInAt: new Date() })
          .$returningId();
        userId = Number(id);
      } catch {
        /* 并发撞 unionId：按老用户处理，重查一次 */
        const again = (await db.select().from(users).where(eq(users.unionId, unionId)).limit(1))[0];
        if (!again) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "注册失败，请重试" });
        const token = await signSessionToken({ unionId: again.unionId, clientId: env.appId });
        setSessionCookie(ctx, token);
        return { ok: true as const, isNewUser: false, name: again.name ?? name, assessQueue: [] as string[] };
      }
      try {
        await db.insert(studentProfile).values({
          userId,
          name,
          grade,
          className,
          /* 学校随机构固定，写进档案供报告展示 */
          school: org?.name ?? null,
          enabledModules: DEFAULT_INVITE_MODULES,
          tutorId: ch.tutorId ?? null,
          /* 校园版：注册即视为完成引导（学校/年级已固定），报告中心直接开放 */
          onboarded: true,
          reportReleased: true,
        });
      } catch {
        /* 档案建失败不阻断注册，welcome 引导兜底 */
      }
      /* 伴学师渠道：同步挂名 + 报告权限随该伴学师的「邀请学员默认可看报告」配置（与手机号注册同口径） */
      if (ch.tutorId != null) {
        try {
          const tutor = (
            await db.select({ inviteReportDefault: users.inviteReportDefault }).from(users).where(eq(users.id, ch.tutorId)).limit(1)
          )[0];
          await db.insert(studentTutor).values({
            studentUserId: userId,
            tutorUserId: ch.tutorId,
            reportAccess: tutor?.inviteReportDefault ?? false,
            reportAccessExpiresAt: null,
          });
        } catch {
          /* 已有分配记录或迁移未就绪：保持现状 */
        }
      }
      /* invite_registrations.phone 为历史 NOT NULL 列：校园注册无手机号，置空串占位；
         该表同时是 myReportAccess / myAssessmentAccess（学员端报告与测评放行）的数据源，必须写入。 */
      await db.insert(inviteRegistrations).values({ channelId: ch.id, channelCode: ch.code, phone: "", studentName: name, grade, userId });

      const token = await signSessionToken({ unionId, clientId: env.appId });
      setSessionCookie(ctx, token);
      /* 测评队列与手机号注册同口径（学科四维置顶，多元智能五项选做不进队列） */
      const rawKinds = ch.assessmentAccess ? (normalizeAssessKinds(ch.assessmentKinds) ?? []) : [];
      const assessQueue = rawKinds.includes("all")
        ? ["subject4d", ...INVITE_ASSESS_KINDS.map((k) => k.key).filter((k) => k !== "multi5" && k !== "subject4d")]
        : ["subject4d", ...rawKinds.filter((k) => k !== "multi5" && k !== "subject4d")];
      return { ok: true as const, isNewUser: true, name, assessQueue };
    }),

  /**
   * 公开：扫码注册（邀请制唯一注册入口）。
   * V51：极简注册——只填手机号 + 密码即完成注册；不再收集家长称呼/学生姓名/年级，
   * 档案用占位姓名（后续可在测评中心/引导页里补）。注册后默认只开测评中心，伴学师渠道自动挂名。
   */
  registerWithInvite: publicQuery
    .input((v: unknown) => v as { code: string; phone: string; password: string })
    .mutation(async ({ ctx, input }) => {
      const code = normalizeInviteCode(input.code ?? "");
      const phone = (input.phone ?? "").trim();
      const password = input.password ?? "";

      if (!PHONE_RE.test(phone)) badRequest("手机号格式不对，检查一下");
      if (password.length < 6 || password.length > 64) badRequest("密码需要 6～64 个字符");

      const db = getDb();
      const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.code, code)).limit(1))[0];
      if (!ch) throw new TRPCError({ code: "NOT_FOUND", message: "二维码无效，请确认是否扫对了" });
      if (!ch.active) badRequest("这张二维码已停用，请联系发码的工作人员换一张新的");

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
      if (existing[0]) badRequest("这个手机号已经注册过了，直接去登录页登录就好");

      /* V51 极简注册：不采集家长称呼/学生姓名/年级，档案姓名用尾号占位，欢迎引导里再补全 */
      const studentName = `同学${phone.slice(-4)}`;
      const passwordHash = hashPassword(password);
      let userId = 0;
      try {
        const [{ id }] = await db
          .insert(users)
          .values({ unionId: `phone:${phone}`, phone, passwordHash, name: studentName, orgId: ch.orgId ?? null, lastSignInAt: new Date() })
          .$returningId();
        userId = Number(id);
      } catch {
        badRequest("这个手机号已经注册过了，直接去登录页登录就好");
      }
      try {
        await db.insert(studentProfile).values({
          userId,
          name: studentName,
          enabledModules: DEFAULT_INVITE_MODULES,
          tutorId: ch.tutorId ?? null,
          onboarded: true,
        });
      } catch {
        /* 档案建失败不阻断注册，welcome 引导会兜底补齐 */
      }
      /* v170：伴学师渠道的注册学员同步写多对多分配表，报告权限随该伴学师的「邀请学员默认可看报告」配置。
         之后管理员仍可在分配/分配报告里对该学员单独覆盖。失败不阻断注册（容错：迁移未就绪时跳过）。 */
      if (ch.tutorId != null) {
        try {
          const tutor = (
            await db
              .select({ inviteReportDefault: users.inviteReportDefault })
              .from(users)
              .where(eq(users.id, ch.tutorId))
              .limit(1)
          )[0];
          await db.insert(studentTutor).values({
            studentUserId: userId,
            tutorUserId: ch.tutorId,
            reportAccess: tutor?.inviteReportDefault ?? false,
            reportAccessExpiresAt: null,
          });
        } catch {
          /* 已有分配记录或迁移未就绪：保持现状 */
        }
      }
      await db
        .insert(inviteRegistrations)
        .values({ channelId: ch.id, channelCode: ch.code, phone, userId });

      const token = await signSessionToken({ unionId: `phone:${phone}`, clientId: env.appId });
      setSessionCookie(ctx, token);
      /* v82：渠道绑定了测评套餐时，随注册响应返回测评队列，客户端注册成功后一站式连做。
         v176：注册后默认先做学科四维测评（置顶）；多元智能五项改为选做、不进注册队列（伴学师可后台推送）；
         客户端落地时还会按已测结果过滤（如已做过霍兰德则不再重做）。 */
      const rawKinds = ch.assessmentAccess ? (normalizeAssessKinds(ch.assessmentKinds) ?? []) : [];
      const assessQueue = rawKinds.includes("all")
        ? ["subject4d", ...INVITE_ASSESS_KINDS.map((k) => k.key).filter((k) => k !== "multi5" && k !== "subject4d")]
        : ["subject4d", ...rawKinds.filter((k) => k !== "multi5" && k !== "subject4d")];
      return { ok: true as const, name: studentName, assessQueue };
    }),
});
