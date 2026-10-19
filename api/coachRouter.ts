import { z } from "zod";
import { and, eq, inArray, desc, isNull, ne } from "drizzle-orm";
import { createRouter, tutorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { studentPrescriptions, studentProfile, users, academicRecords, organizations } from "@db/schema";
import { hashPassword } from "./auth-router";
import { ACADEMIC_SUBJECTS, type AcademicsData } from "@contracts/academics";
import { sanitizeModules } from "@contracts/studentModules";
import { normalizeAssessKinds } from "@contracts/invite";
import { getStudentDetail, listStudents } from "./studentDetail";
import { isMyStudent } from "./tutorAccess";
import { sameOrg } from "./tenant";
import { tryChat } from "./ai";
import { THREE_TIER_PLANS } from "@/data/training/threeTierPlans";
import { E3V37_ABILITY_TRAINING } from "@/data/training/e3v37Training";
import { METHOD_BY_ID } from "@/data/training/methods";

/** 伴学师工作台：只能看到分配给自己的学员（管理员可看全部）。 */
export const coachRouter = createRouter({
  /** 我名下的学员列表。管理员（兼伴学师）看本机构全部学员，可给每个学员做陪跑问诊。 */
  myStudents: tutorQuery.query(async ({ ctx }) => {
    const all = await listStudents(getDb(), ctx.user.orgId);
    if (ctx.user.role === "admin") return all;
    // V56：名下 = 主管伴学师 或 student_tutor 多对多分配
    return all.filter((s) => s.tutorId === ctx.user.id || s.tutorIds.includes(ctx.user.id));
  }),

  /** 学员详情（伴学师仅可查自己名下学员；管理员可查本机构任意学员）。 */
  studentDetail: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .query(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, input.userId))) {
        throw new Error("这位同学不在你的机构内");
      }
      return getStudentDetail(db, input.userId, ctx.user.orgId, { userId: ctx.user.id, role: ctx.user.role });
    }),

  /** 伴学师代学员填写成绩与目标（校验规则与学生端 profileRouter.saveAcademics 一致）。 */
  saveAcademics: tutorQuery
    .input(
      z.object({
        userId: z.number().int(),
        examName: z.string().max(64).default(""),
        subjects: z
          .array(
            z.object({
              name: z.enum(ACADEMIC_SUBJECTS),
              selfLevel: z.number().int().min(1).max(5).nullable(),
              fullScore: z.number().min(1).max(1500).nullable(),
              lastScore: z.number().min(0).max(1500).nullable(),
              targetScore: z.number().min(0).max(1500).nullable(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, input.userId))) {
        throw new Error("这位同学不在你的机构内");
      }
      const data: AcademicsData = { examName: input.examName, subjects: input.subjects, updatedAt: Date.now() };
      const value = data as unknown as Record<string, unknown>;
      if (existing) {
        await db.update(studentProfile).set({ academics: value }).where(eq(studentProfile.id, existing.id));
      } else {
        // 目标学员尚无档案记录时也允许创建（仅 admin 会走到这里）
        await db.insert(studentProfile).values({ userId: input.userId, academics: value });
      }
      /* 与学生端 V72 同口径：只要这次保存里有任何一科填了「最近分」，就追加一条历史（成绩曲线数据源）。
         只改目标分/自评、没填分数的不产生记录，避免把编辑误当一次新考试。 */
      const hasAnyScore = input.subjects.some((s) => s.lastScore != null);
      if (hasAnyScore) {
        await db.insert(academicRecords).values({
          userId: input.userId,
          examName: input.examName ?? "",
          subjects: input.subjects as unknown as Record<string, unknown>[],
        });
      }
      return { ok: true as const };
    }),

  /** 学员成绩历史（新→旧，最多 50 条）：成绩变化曲线与进步对比数据源。伴学师仅可查名下学员。 */
  academicRecords: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .query(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, input.userId))) {
        throw new Error("这位同学不在你的机构内");
      }
      const rows = await db
        .select()
        .from(academicRecords)
        .where(eq(academicRecords.userId, input.userId))
        .orderBy(desc(academicRecords.id))
        .limit(50);
      return rows.map((r) => ({
        id: r.id,
        examName: r.examName,
        createdAt: r.createdAt,
        subjects: (r.subjects ?? []) as {
          name: string;
          selfLevel: number | null;
          fullScore: number | null;
          lastScore: number | null;
          targetScore: number | null;
        }[],
      }));
    }),

  /** 开启/关闭学员端功能模块（测评中心恒可用；传空数组=恢复全功能）。伴学师只能管自己名下的学员。 */
  /** V53：伴学师/管理员帮学员重置登录密码（重置后为默认密码 123456，学员登录后应自行修改）。伴学师只能重置自己名下的学员。 */
  resetStudentPassword: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, input.userId))) {
        throw new Error("这位同学不在你的机构内");
      }
      const userRow = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!userRow) throw new Error("学员账号不存在");
      await db.update(users).set({ passwordHash: hashPassword("123456") }).where(eq(users.id, input.userId));
      return { ok: true as const, password: "123456" };
    }),

  /** V54：推送/收回学员报告。released=true 家长可直接查看全部报告；false 由伴学师把关（默认）。伴学师只能操作名下学员。 */
  setReportAccess: tutorQuery
    .input((v: unknown) => v as { userId: number; released: boolean })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      /* v189：入参防御——userId 缺失/非法时旧逻辑会插入 user_id=0 的孤儿档案行 */
      const uid = Number(input.userId);
      if (!Number.isInteger(uid) || uid <= 0) throw new Error("参数不对：缺少学员 ID");
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, uid)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, uid))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, uid))) {
        throw new Error("这位同学不在你的机构内");
      }
      /* V55：推送时清掉「请伴学师推送」请求标记 */
      const releasePatch = input.released ? { reportPushRequestedAt: null } : {};
      if (existing) {
        await db.update(studentProfile).set({ reportReleased: !!input.released, ...releasePatch }).where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId: uid, reportReleased: !!input.released, ...releasePatch });
      }
      return { ok: true as const, released: !!input.released };
    }),

  /**
   * v82：伴学师/管理员向学员「推送」额外开放的测评（对绑定了测评套餐的扫码注册学员，
   * 未在套餐内的测评默认隐藏；推送到 releasedAssessments 后该学员客户端可见可测）。
   * kinds 传完整目标集合（空数组=收回全部额外推送）。伴学师只能操作名下学员。
   */
  setReleasedAssessments: tutorQuery
    .input((v: unknown) => v as { userId: number; kinds: unknown })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      /* v189：入参防御——userId 缺失/非法时旧逻辑会插入 user_id=0 的孤儿档案行 */
      const uid = Number(input.userId);
      if (!Number.isInteger(uid) || uid <= 0) throw new Error("参数不对：缺少学员 ID");
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, uid))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, uid))) {
        throw new Error("这位同学不在你的机构内");
      }
      const kinds = normalizeAssessKinds(input.kinds);
      if (kinds == null) throw new Error("测评种类格式不对");
      const value = kinds.length === 0 ? null : kinds;
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, uid)).limit(1)
      )[0];
      if (existing) {
        await db.update(studentProfile).set({ releasedAssessments: value }).where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId: uid, releasedAssessments: value });
      }
      return { ok: true as const, released: kinds };
    }),

  setStudentModules: tutorQuery
    .input((v: unknown) => v as { userId: number; modules: string[] })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, input.userId))) {
        throw new Error("这位同学不在你的机构内");
      }
      const modules = sanitizeModules(input.modules);
      /* 只存「被关掉的之外、明确开启的」模块；传空数组表示恢复全功能（存 null） */
      const value = modules.length === 0 ? null : modules;
      if (existing) {
        await db.update(studentProfile).set({ enabledModules: value }).where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId: input.userId, enabledModules: value });
      }
      return { ok: true as const, modules: value };
    }),

  /**
   * V61：开方——伴学师勾选方案库训练方法（+自写补充方案），推送到学员端。
   * 伴学师限名下学员；管理员限本机构学员。
   */
  createPrescription: tutorQuery
    .input(
      z.object({
        userId: z.number().int(),
        methods: z
          .array(
            z.object({
              id: z.string().max(16),
              name: z.string().max(64),
              sub: z.string().max(64),
              board: z.string().max(4),
              ability: z.string().max(32).optional(),
            }),
          )
          .min(1)
          .max(30),
        customText: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, input.userId))) {
        throw new Error("这位同学不在你的机构内");
      }
      const target = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!target) throw new Error("学员账号不存在");
      await db.insert(studentPrescriptions).values({
        studentUserId: input.userId,
        tutorUserId: ctx.user.id,
        methods: input.methods,
        customText: input.customText?.trim() || null,
      });
      return { ok: true as const };
    }),

  /** V61：某学员的开方记录（伴学师限名下，管理员限本机构）。 */
  listPrescriptions: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .query(async ({ ctx, input }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, input.userId))) {
        throw new Error("这位同学不在你的机构内");
      }
      const rows = await db
        .select()
        .from(studentPrescriptions)
        .where(eq(studentPrescriptions.studentUserId, input.userId))
        .orderBy(studentPrescriptions.createdAt);
      const tutorIds = [...new Set(rows.map((r) => r.tutorUserId))];
      const tutorRows = tutorIds.length
        ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, tutorIds))
        : [];
      const tutorName = new Map(tutorRows.map((t) => [t.id, t.name ?? `伴学师${t.id}`]));
      return rows
        .map((r) => ({
          id: r.id,
          tutorName: tutorName.get(r.tutorUserId) ?? "伴学师",
          methods: (r.methods ?? []) as { id: string; name: string; sub: string; board: string; ability?: string }[],
          customText: r.customText ?? null,
          createdAt: r.createdAt,
        }))
        .reverse();
    }),

  /** V57：AI 陪跑问诊——描述孩子近期遇到的问题，AI 结合三阶九能训练方案库给对策。
   *  AI 不可用时降级为规则匹配（按关键词命中能力 → 典型问题 + 简要方案 + 训练方法），功能永不硬失败。 */
  askAdvice: tutorQuery
    .input(
      z.object({
        question: z.string().min(4).max(2000),
        /** 伴学师判断主要相关的能力（九能之一），可空 */
        ability: z.string().max(32).nullable().optional(),
        /** 关联学员（带入诊断上下文，可空） */
        userId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      let studentCtx: string | null = null;
      if (input.userId) {
        /* V59：管理员（兼伴学师）可带入本机构任意学员；伴学师仅限名下学员 */
        if (ctx.user.role !== "admin") {
          if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
            throw new Error("这位同学不在你的伴学名单里");
          }
        } else if (!(await sameOrg(db, ctx.user, input.userId))) {
          throw new Error("这位同学不在你的机构内");
        }
        const detail = await getStudentDetail(db, input.userId, ctx.user.orgId);
        const e3 = detail.assessments.e3 as { version?: string; abilities?: { label: string; score: number; level: string }[] } | undefined;
        const weak =
          e3?.version === "3.7" && e3.abilities
            ? e3.abilities.filter((a) => a.score < 3.8).map((a) => `${a.label} ${a.score}/5（${a.level}）`)
            : [];
        studentCtx = [
          `学员：${detail.profile?.name ?? detail.user.name ?? "未命名"}（${detail.profile?.grade ?? "年级未知"}${detail.profile?.school ? ` · ${detail.profile.school}` : ""}）`,
          e3?.version === "3.7"
            ? `学习力诊断弱项：${weak.join("、") || "无（九能全部 ≥3.8）"}`
            : e3
              ? "学习力诊断为旧版，建议请学员重测 V3.7"
              : "尚未做学习力诊断",
          detail.academics?.subjects?.length
            ? `学业现状与目标：${detail.academics.subjects.map((s) => `${s.name} ${s.lastScore ?? "?"}/${s.targetScore ?? "?"}`).join("、")}`
            : null,
        ].filter(Boolean).join("\n");
      }

      // 三阶九能方案库摘要（喂给 AI，保证口径与训练专栏一致）
      const libSummary = THREE_TIER_PLANS.map((p) => {
        const rx = E3V37_ABILITY_TRAINING[p.ability];
        return `- 【${p.tier}·${p.ability}】典型问题：${p.questions.join("；")}｜简要方案：${rx?.rationale ?? ""}`;
      }).join("\n");

      const sysPrompt = [
        "你是「三好学伴」的伴学教练，帮 K12 伴学师分析孩子近期遇到的学习问题并给出可执行对策。",
        "下面是本校的学习力陪跑训练方案库（三阶九能），你的对策必须与之一致：",
        libSummary,
        "",
        "回答规则：",
        "1. 先一句话判断问题主要对应哪一能（动力/信心/韧劲/学懂/记住/会用/计划/复盘/智学，或状态/关系/资源/注意力等工作记忆等条件学能）；",
        "2. 「现在就能做的三件事」——每件给出具体做法 + 频率 + 预计耗时，优先用方案库中的训练方法思路；",
        "3. 「一周观察点」——列出 2-3 个可观察的行为信号，判断对策是否起效；",
        "4. 「何时升级」——什么情况建议找更专业帮助或调整方案；",
        "5. 语气具体、温和、可操作，不要空话套话；不超过 600 字。",
      ].join("\n");
      const userPrompt = [
        studentCtx,
        input.ability ? `伴学师判断主要相关能力：${input.ability}` : null,
        `孩子近期遇到的问题：\n${input.question}`,
      ].filter(Boolean).join("\n\n");

      /* V61：无论 AI 还是规则兜底，都附带命中能力的方案库方法（结构化，前端可点开看详细做法） */
      const hit = matchAbility(input.question, input.ability ?? null);
      const rx = E3V37_ABILITY_TRAINING[hit.ability];
      const methods = (rx?.methodIds ?? [])
        .map((id) => METHOD_BY_ID.get(id))
        .filter((m) => m != null)
        .map((m) => ({ id: m.id, name: m.name, sub: m.sub, board: m.board }));

      const ai = await tryChat(
        [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        { timeoutMs: 45000, maxTokens: 2500 },
      );
      if (ai) return { answer: ai, ai: true as const, ability: hit.ability, methods };

      /* —— AI 不可用：规则兜底 —— */
      const plan = THREE_TIER_PLANS.find((p) => p.ability === hit.ability);
      const methodNames = methods.map((m) => `${m.name}（${m.sub}）`).join("、");
      const fallback = [
        `（AI 通道暂不可用，以下为方案库规则匹配结果）`,
        `问题判断：主要对应【${hit.tier}·${hit.ability}】。`,
        plan ? `典型表现：${plan.questions.join("；")}` : null,
        `简要方案：${rx?.rationale ?? "结合学员诊断结果匹配训练方法。"}`,
        methodNames ? `建议训练方法：${methodNames}` : null,
        rx?.note ? `补充约定：${rx.note}` : null,
      ].filter(Boolean).join("\n");
      return { answer: fallback, ai: false as const, ability: hit.ability, methods };
    }),

  /**
   * v96：删除学员（软删）——users.deleted_at 打时间戳。学员立即从列表消失、无法登录；
   * 数据保留 2 个月，期间可在回收站恢复，到期自动物理清除。伴学师限名下学员，管理员限本机构。
   * v201：「按机构移除」守卫——只移出本机构，绝不动全局身份：
   * ① v210 起角色口径放开：学员/伴学师/教务均可移出机构，仅管理员/超管绝对不可移出；
   * ② v210 起无机构账号（orgId IS NULL）也允许移出——进入回收站（公海），平台超管可恢复/处置；
   *    v206 的误删防护由 ① 的角色守卫承接（超管=admin 角色，与机构无关）；
   * ③ 同手机号名下还有其他机构账号时，本次只软删本机构这一行（其他机构账号照常登录），
   *    响应里带 siblingOrgs 告知前端「仅移出本机构」。
   */
  deleteStudent: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        if (!(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, input.userId))) {
        throw new Error("这位同学不在你的机构内");
      }
      const target = (
        await db
          .select({ id: users.id, deletedAt: users.deletedAt, role: users.role, orgId: users.orgId, phone: users.phone })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1)
      )[0];
      if (!target) throw new Error("学员账号不存在");
      if (target.deletedAt) throw new Error("该学员已在回收站里");
      const profile = (
        await db.select({ id: studentProfile.id }).from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      /* v210：伴学师/教务无需档案可直接移出机构 */
      if (!profile && target.role === "user") throw new Error("只有学员（有学员档案的账号）可以删除");
      /* v210：仅管理员/超管不可移出；伴学师、教务与学员一样可移出机构。
         无机构账号（orgId IS NULL）同样允许移出——进入回收站（公海），由平台超管恢复/处置 */
      if (target.role === "admin") throw new Error("该账号是管理员/超管，不能移出机构；如需调整请联系平台超管");
      /* v201：同手机号多机构账号 → 只软删本机构这一行，返回其他机构名供前端提示 */
      let siblingOrgs: string[] = [];
      if (target.phone) {
        const siblings = await db
          .select({ orgId: users.orgId })
          .from(users)
          .where(and(eq(users.phone, target.phone), isNull(users.deletedAt), ne(users.id, target.id)));
        if (siblings.length > 0) {
          const orgIds = [...new Set(siblings.map((s) => s.orgId).filter((v): v is number => v != null))];
          if (orgIds.length > 0) {
            const orgRows = await db.select().from(organizations).where(inArray(organizations.id, orgIds));
            siblingOrgs = orgRows.map((o) => o.brandName || o.name);
          }
        }
      }
      /* v99：记录删除人——回收站按"谁删的"做伴学师可见性判定 */
      await db.update(users).set({ deletedAt: new Date(), deletedBy: ctx.user.id }).where(eq(users.id, input.userId));
      return { ok: true as const, removedOrgOnly: siblingOrgs.length > 0, siblingOrgs };
    }),

  /** v96：从回收站恢复学员（清除 deleted_at）。权限同删除（v99：含"我删的"）。 */
  restoreStudent: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const target = (
        await db.select({ id: users.id, deletedAt: users.deletedAt, deletedBy: users.deletedBy }).from(users).where(eq(users.id, input.userId)).limit(1)
      )[0];
      if (!target) throw new Error("学员账号不存在");
      if (!target.deletedAt) throw new Error("该学员不在回收站里");
      if (ctx.user.role !== "admin") {
        /* 伴学师：名下学员、扫自己码注册的学员、或自己删的学员才可恢复 */
        if (target.deletedBy !== ctx.user.id && !(await isMyStudent(db, ctx.user.id, input.userId))) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      } else if (!(await sameOrg(db, ctx.user, input.userId))) {
        throw new Error("这位同学不在你的机构内");
      }
      await db.update(users).set({ deletedAt: null, deletedBy: null }).where(eq(users.id, input.userId));
      return { ok: true as const };
    }),

  /**
   * v96：回收站——已删除、尚在 2 个月保留期内的学员。打开时先惰性清扫一次到期数据。
   * 管理员看本机构（超管看全量）；v99：伴学师只看「自己删的 / 名下 / 扫自己码注册的」学员。
   */
  recycleBin: tutorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const { purgeExpiredStudents, listDeletedStudents, visibleDeletedStudentIds } = await import("./recycle");
    const purged = await purgeExpiredStudents(db);
    const all = await listDeletedStudents(db, ctx.user.orgId);
    if (ctx.user.role === "admin") return { items: all, purged };
    const visible = await visibleDeletedStudentIds(db, ctx.user.id);
    return { items: all.filter((s) => visible.has(s.userId)), purged };
  }),
});

/** 规则兜底：伴学师指定能力优先；否则按关键词命中典型问题。 */
function matchAbility(question: string, prefer: string | null): { tier: string; ability: string } {
  const all = THREE_TIER_PLANS.map((p) => ({ tier: p.tier, ability: p.ability, questions: p.questions }));
  if (prefer) {
    const p = all.find((x) => x.ability === prefer);
    if (p) return { tier: p.tier, ability: p.ability };
  }
  let best: { tier: string; ability: string; score: number } | null = null;
  for (const p of all) {
    let score = 0;
    for (const q of p.questions) {
      for (let len = 4; len >= 2; len--) {
        for (let i = 0; i + len <= q.length; i++) {
          if (question.includes(q.slice(i, i + len))) score += len;
        }
      }
    }
    if (question.includes(p.ability)) score += 6;
    if (!best || score > best.score) best = { tier: p.tier, ability: p.ability, score };
  }
  return best && best.score > 0 ? { tier: best.tier, ability: best.ability } : { tier: "乐学", ability: "动力" };
}
