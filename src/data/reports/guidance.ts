/**
 * V72：升学指导综合报告——霍兰德职业兴趣 + 职业锚 + MBTI + DISC + 多元智能五项 五合一，
 * 回答「选什么科、学什么专业、进什么行业」。用于选科指导与升学指导场景。
 * 与学习力综合报告分离：那边只管「怎么学得更好」，这边管「往哪里去」。
 */
import type { MbtiResult } from "@contracts/types";
import type { DiscResult } from "@contracts/types";
import type { Multi5Result, Multi5Key } from "@contracts/multi5";
import { MULTI5_DIM_LABEL } from "@contracts/multi5";
import type { HollandResult, HollandKey } from "@contracts/holland";
import { HOLLAND_LABEL, buildHollandReport } from "@contracts/holland";
import type { AnchorResult } from "@contracts/careerAnchor";
import { ANCHOR_LABEL, buildAnchorReport } from "@contracts/careerAnchor";
import { MBTI_REPORTS } from "@/data/reports";
import { DISC_REPORTS } from "@/data/reports/disc";
import { buildMulti5Report } from "@contracts/multi5";

/* ---------------------------------- MBTI 升学向简表 ---------------------------------- */

type MbtiGuidance = {
  /** 专业/领域倾向（一段）。 */
  fieldSlant: string;
  /** 学习风格 3 条（选科/学法参考）。 */
  studyStyle: string[];
};

const MBTI_GUIDANCE: Record<string, MbtiGuidance> = {
  ISTJ: {
    fieldSlant: "适合规则清晰、重准确与责任的领域：财会审计、法律、医学检验、档案/信息管理、工程质量、公务员体系。",
    studyStyle: ["按清单推进最稳，给每科列「必拿分清单」", "错题本对你性价比极高", "选科优先考虑能稳定积累、评分客观的科目组合"],
  },
  ISFJ: {
    fieldSlant: "适合服务与照护导向的领域：护理与康复、师范教育、人力资源、社会保障、行政事务、儿童相关专业。",
    studyStyle: ["在安静稳定的环境里效率最高", "把大目标拆成每日小任务会少很多焦虑", "擅长长期陪伴式积累，别怕慢"],
  },
  INFJ: {
    fieldSlant: "适合意义感强、能影响人的领域：心理学、教育学、文学与传媒、社会学、公共政策、艺术设计。",
    studyStyle: ["理解式记忆远胜死记硬背", "给自己留出整块不被打断的思考时间", "选科可偏向能写、能表达、能探究的科目"],
  },
  INTJ: {
    fieldSlant: "适合战略与系统构建的领域：计算机/人工智能、数学与基础科学、金融工程、建筑与城市规划、研究与开发。",
    studyStyle: ["先搭知识框架再填细节，效率翻倍", "适合自学深水区内容，竞赛/拓展是你的主场", "选科建议保留物理/数学类硬科目，路子最宽"],
  },
  ISTP: {
    fieldSlant: "适合动手与实战的领域：机械/电子工程、汽车与飞行器、信息技术运维、临床医学（外科方向）、体育科学、刑侦技术。",
    studyStyle: ["做题/实验比听课学得快", "把知识点变成「可操作步骤」记得最牢", "选科搭配一门动手型科目（实验/技术类）更出彩"],
  },
  ISFP: {
    fieldSlant: "适合审美与体验导向的领域：视觉传达与设计、音乐与表演、动画与游戏美术、园艺与景观、护理与疗愈、手作与工艺。",
    studyStyle: ["在轻松无压的环境里才有好状态", "用图像/色彩整理笔记效果最好", "选科别硬挤纯理论组合，留一门能表达的"],
  },
  INFP: {
    fieldSlant: "适合价值与创作导向的领域：文学与写作、心理咨询、教育、新闻传播、公益与社会创新、艺术策展、游戏叙事。",
    studyStyle: ["先认同「为什么学」，才学得好", "把知识点编成故事/比喻记得最牢", "选科可发挥语文英语优势，再配一门真爱科目"],
  },
  INTP: {
    fieldSlant: "适合探究与理论构建的领域：数学、物理、计算机科学、哲学、生物信息、经济学研究、数据科学。",
    studyStyle: ["搞懂原理就能一通百通，别死记", "给自己留「乱想时间」，好点子都在这出来", "选科强烈建议保留数理组合，天花板最高"],
  },
  ESTP: {
    fieldSlant: "适合行动与应变导向的领域：市场营销、创业与商务、体育与赛事、应急管理、刑侦与安保、工程现场管理。",
    studyStyle: ["刷题+限时训练提分最快", "把学习目标变成「 measurable 的挑战」", "选科挑能快速看到反馈的科目组合"],
  },
  ESFP: {
    fieldSlant: "适合人际与活力导向的领域：学前教育、旅游与酒店管理、演艺与主持、医疗美容、销售与客户成功、活动运营。",
    studyStyle: ["和同学组队学比一个人钻效率高", "把知识点讲给别人听=最好的复习", "选科保留一门能展示表达优势的科目"],
  },
  ENFP: {
    fieldSlant: "适合创意与连接导向的领域：广告与创意策划、新媒体、心理咨询、教育创新、人力资源、公共关系、文旅策划。",
    studyStyle: ["兴趣驱动明显：喜欢的科学得飞快", "多变环境下用「主题月」法聚焦", "选科宜「一稳一热」：一门稳拿分+一门真热爱"],
  },
  ENTP: {
    fieldSlant: "适合创新与辩论导向的领域：产品/创业、法律咨询、科技媒体、战略咨询、政治学与外交、科研转化。",
    studyStyle: ["越练难题越兴奋，别只做基础题", "用思维导图辩论式整理知识", "选科组合越灵活越好，别把路走窄"],
  },
  ESTJ: {
    fieldSlant: "适合组织与管理导向的领域：工商管理、会计与审计、法学、公共管理、工程项目管理、军警院校方向。",
    studyStyle: ["计划表就是你的外挂，严格照表执行", "标准化考试是你的强项，答题规范再抠细一点", "选科选主流硬组合，资源和路径都成熟"],
  },
  ESFJ: {
    fieldSlant: "适合协调与服务导向的领域：师范教育、护理与临床、社会工作、人力资源、客户服务管理、文旅服务。",
    studyStyle: ["有同伴一起学效果最好", "把知识点讲给别人听=最好的复习", "选科选稳妥组合，发挥稳定优势"],
  },
  ENFJ: {
    fieldSlant: "适合领导与启发导向的领域：教育管理与师范、组织管理、传媒与播音、政治学与社会运动、品牌与市场、人力资源管理。",
    studyStyle: ["在「为别人而学」的目标下动力最强", "小组里当小老师，双赢", "选科可发挥语文英语表达优势，再补一门逻辑型科目"],
  },
  ENTJ: {
    fieldSlant: "适合决策与开创导向的领域：金融与投资、企业管理、法学、计算机与科技管理、临床医学、公共治理、战略咨询。",
    studyStyle: ["目标倒推法：先定分数目标再拆到每周", "竞争环境是你的燃料，找个对手", "选科保留数理硬组合，未来选择面最大"],
  },
};

/* ---------------------------------- DISC 升学向简表 ---------------------------------- */

const DISC_GUIDANCE: Record<string, { roleStyle: string; scene: string }> = {
  D: {
    roleStyle: "天然的推进者与决策者：在团队里适合做牵头人、竞赛队长、项目组长。",
    scene: "升学路径上适合「冲目标型」打法：锁定一所学校/一个分数段，集中火力突破。注意给自己留备选方案，别让冲劲变成孤注一掷。",
  },
  I: {
    roleStyle: "氛围制造者与连接者：擅长演讲、答辩、社团组织，在面试类/展示类环节优势明显。",
    scene: "升学路径上适合「展示型」打法：综合素质评价、面试、自主招生/强基面试都是你的舞台。书面基本功要刻意补，别让表达遮住了扎实度。",
  },
  S: {
    roleStyle: "稳定的支撑者：擅长长期陪伴式协作、服务性工作，是团队里最可靠的存在。",
    scene: "升学路径上适合「稳打稳扎型」打法：按节奏积累，靠稳定输出取胜。可以适当挑战高一点的目标，你的持续力比你自己以为的更强。",
  },
  C: {
    roleStyle: "品质守门员：擅长分析、校对、研究型任务，精确性要求高的岗位非你莫属。",
    scene: "升学路径上适合「精度型」打法：理科/信息类竞赛、研究性学习报告是你的赛道。考试时注意「完成比完美重要」，别在一道题上过度打磨。",
  },
};

/* ---------------------------------- 霍兰德 → 关联学科 ---------------------------------- */

const HOLLAND_SUBJECTS: Record<HollandKey, string[]> = {
  R: ["物理", "化学", "技术/信息技术", "体育"],
  I: ["数学", "物理", "化学", "生物"],
  A: ["语文", "艺术/美术", "音乐", "英语"],
  S: ["道德与法治/政治", "历史", "生物", "英语"],
  E: ["道德与法治/政治", "历史", "地理", "语文"],
  C: ["数学", "地理", "信息技术", "英语"],
};

/* ---------------------------------- 五项智能 → 学科加成 ---------------------------------- */

const MULTI5_SUBJECT_BOOST: Record<Multi5Key, string[]> = {
  reasoning: ["数学", "物理", "化学"],
  detail: ["语文", "英语", "生物"],
  number: ["数学", "物理", "化学"],
  verbal: ["语文", "英语", "历史"],
  spatial: ["地理", "物理", "美术/设计"],
};

/* ---------------------------------- 报告类型与构建 ---------------------------------- */

export type GuidanceReport = {
  /** 报告生成依据（已完成的测评）。 */
  basedOn: string[];
  /** 还缺的测评（报告会更准）。 */
  missing: string[];
  headline: string;
  mbtiBlock: { type: string; name: string; fieldSlant: string; studyStyle: string[] } | null;
  discBlock: { primary: string; name: string; roleStyle: string; scene: string } | null;
  multi5Block: { label: string; score: number; feature: string; career: string[] }[] | null;
  anchorBlock: { label: string; score: number; workStyle: string; careerFields: string[] }[] | null;
  hollandBlock: { code: string; top3: { key: HollandKey; label: string; score: number; careers: string[]; majors: string[] }[] } | null;
  /** 选科建议（按年级措辞）。 */
  subjectAdvice: string[];
  /** 推荐专业方向（含理由）。 */
  majors: { name: string; why: string }[];
  /** 推荐行业方向。 */
  industries: { name: string; why: string }[];
  /** 行动建议。 */
  actionTips: string[];
};

const countBy = <T extends string>(items: T[]): [T, number][] => {
  const m = new Map<T, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

export function buildGuidanceReport(input: {
  grade?: string | null;
  mbti?: MbtiResult | null;
  disc?: DiscResult | null;
  multi5?: Multi5Result | null;
  anchor?: AnchorResult | null;
  holland?: HollandResult | null;
}): GuidanceReport | null {
  const { mbti, disc, multi5, anchor, holland } = input;
  if (!mbti && !disc && !multi5 && !anchor && !holland) return null;
  const basedOn: string[] = [];
  const missing: string[] = [];
  if (holland) basedOn.push(`霍兰德职业兴趣（${holland.code}）`); else missing.push("霍兰德职业兴趣");
  if (anchor) basedOn.push(`职业锚（第一锚 ${ANCHOR_LABEL[anchor.top2[0]]}）`); else missing.push("职业锚");
  if (mbti) basedOn.push(`MBTI（${mbti.type}）`); else missing.push("MBTI 性格");
  if (disc) basedOn.push(`DISC（${disc.primary} 型）`); else missing.push("DISC 行为风格");
  if (multi5) basedOn.push(`多元智能五项（综合 ${multi5.overall}）`); else missing.push("多元智能五项");

  const mg = mbti ? MBTI_GUIDANCE[mbti.type] ?? null : null;
  const mbtiBlock = mbti && mg ? { type: mbti.type, name: MBTI_REPORTS[mbti.type]?.name ?? "", fieldSlant: mg.fieldSlant, studyStyle: mg.studyStyle } : null;
  const dg = disc ? DISC_GUIDANCE[disc.primary] ?? null : null;
  const discBlock = disc && dg ? { primary: disc.primary, name: DISC_REPORTS[disc.primary as "D" | "I" | "S" | "C"]?.name ?? "", roleStyle: dg.roleStyle, scene: dg.scene } : null;

  let multi5Block: GuidanceReport["multi5Block"] = null;
  if (multi5) {
    const rep = buildMulti5Report(multi5);
    multi5Block = rep.dims
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((d) => ({ label: d.label, score: d.score, feature: d.feature, career: d.careerAdvice.slice(0, 2) }));
  }

  let anchorBlock: GuidanceReport["anchorBlock"] = null;
  if (anchor) {
    const ar = buildAnchorReport(anchor);
    anchorBlock = ar.top2.map((t) => ({ label: t.label, score: t.score, workStyle: t.workStyle, careerFields: t.careerFields }));
  }

  let hollandBlock: GuidanceReport["hollandBlock"] = null;
  if (holland) {
    const hr = buildHollandReport(holland);
    hollandBlock = {
      code: holland.code,
      top3: holland.top3.map((key) => {
        const dd = hr.dims.find((x) => x.key === key);
        return {
          key,
          label: HOLLAND_LABEL[key],
          score: holland.dims[key],
          careers: dd?.careers.slice(0, 5) ?? [],
          majors: dd?.majors.slice(0, 5) ?? [],
        };
      }),
    };
  }

  /* ---- 选科建议：霍兰德兴趣学科 × 五项优势学科 × 年级 ---- */
  const subjectAdvice: string[] = [];
  const grade = input.grade ?? "";
  const isSenior = /高中|高一|高二|高三/.test(grade);
  const isJunior = /初中|初一|初二|初三|七年级|八年级|九年级/.test(grade);
  const interestSubjects = holland ? holland.top3.flatMap((k) => HOLLAND_SUBJECTS[k]) : [];
  const boostSubjects = multi5
    ? (Object.entries(multi5.dims) as [Multi5Key, number][])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .flatMap(([k]) => MULTI5_SUBJECT_BOOST[k])
    : [];
  const interestTop = countBy(interestSubjects).slice(0, 3).map(([s]) => s);
  const boostTop = countBy(boostSubjects).slice(0, 3).map(([s]) => s);
  if (isSenior && interestTop.length > 0) {
    subjectAdvice.push(
      `高中选科参考（兴趣×能力双匹配）：${[...new Set([...interestTop, ...boostTop])].slice(0, 4).join("、")}。` +
        `兴趣决定你能不能学得开心，能力决定你能不能学得轻松——两边都占的科目优先级最高。`,
    );
  }
  if (!isSenior && interestTop.length > 0) {
    subjectAdvice.push(
      `兴趣和能力的交汇点出现在：${[...new Set([...interestTop, ...boostTop])].slice(0, 4).join("、")}。` +
        (isJunior ? "初中阶段先把这些科目打造成「优势学科」，高中选科时它们就是候选组合的核心。" : "小学阶段不用急着定方向，多在以上这些方向上体验和尝试。"),
    );
  }
  if (anchor) {
    subjectAdvice.push(
      `职业锚提示：你的第一锚「${ANCHOR_LABEL[anchor.top2[0]]}」意味着长期投入比短期分数更重要——选科时给「愿意一直学下去的科目」加权重，别只盯眼下哪科好拿分。`,
    );
  }

  /* ---- 专业方向：霍兰德 majors 为主，MBTI 领域倾向调味 ---- */
  const majorVotes: { name: string; why: string }[] = [];
  if (hollandBlock) {
    hollandBlock.top3.forEach((t, i) => {
      t.majors.forEach((m) => {
        majorVotes.push({ name: m, why: `霍兰德${i + 1}位「${t.label}」匹配专业` });
      });
    });
  }
  if (mg && mbti) {
    majorVotes.push({ name: mg.fieldSlant.split("：")[1]?.split(/[，,、]/)[0] ?? "", why: `${mbti.type} 型领域倾向` });
  }
  const majors = majorVotes
    .filter((m) => m.name && m.name.length <= 12)
    .filter((m, i, arr) => arr.findIndex((x) => x.name === m.name) === i)
    .slice(0, 6);

  /* ---- 行业方向：职业锚 careerFields + 霍兰德 careers + DISC ---- */
  const industryVotes: { name: string; why: string }[] = [];
  anchorBlock?.forEach((a, i) => a.careerFields.slice(0, 3).forEach((f) => industryVotes.push({ name: f, why: `职业锚「${a.label}」第${i + 1}锚` })));
  hollandBlock?.top3.forEach((t) => t.careers.slice(0, 3).forEach((c) => industryVotes.push({ name: c, why: `霍兰德「${t.label}」典型职业` })));
  if (discBlock) industryVotes.push({ name: DISC_GUIDANCE[disc!.primary].roleStyle.split("：")[0], why: `DISC ${disc!.primary} 型的团队角色` });
  const industries = countBy(industryVotes.map((v) => v.name))
    .slice(0, 6)
    .map(([name]) => ({ name, why: industryVotes.find((v) => v.name === name)?.why ?? "" }));

  /* ---- 行动建议 ---- */
  const actionTips: string[] = [];
  if (mbtiBlock) actionTips.push(`学法上：${mbtiBlock.studyStyle[0]}。`);
  if (discBlock) actionTips.push(`升学打法上：${discBlock.scene.split("：")[1] ?? discBlock.scene}`);
  if (multi5Block && multi5Block.length > 0) actionTips.push(`能力补给上：${multi5Block[0].label}是你当前的相对强项（${multi5Block[0].score}），可向对应学科/竞赛倾斜；相对弱项每周给 20 分钟刻意练习。`);
  if (anchorBlock) actionTips.push(`动力管理上：${anchorBlock[0].workStyle}——把「为什么学」和这个目标挂钩，比任何打卡都管用。`);
  actionTips.push(
    isSenior
      ? "本阶段最重要的一步：用 2-3 个周末，把上面出现的专业方向各找一篇「学长真实就读体验」读完，比排名表有用一百倍。"
      : "本阶段最重要的一步：别急着定方向——每学期在「推荐方向」里挑 1-2 个做深度体验（竞赛/社团/职业访谈），用排除法找到自己的真爱。",
  );

  return {
    basedOn,
    missing,
    headline: `兴趣代码 ${holland?.code ?? "—"} · ${anchor ? `第一锚 ${ANCHOR_LABEL[anchor.top2[0]]}` : ""} · ${mbti?.type ?? ""}型 · ${disc?.primary ?? ""}型`.replace(/·\s*·/g, "·").replace(/[·\s]+$/, ""),
    mbtiBlock,
    discBlock,
    multi5Block,
    anchorBlock,
    hollandBlock,
    subjectAdvice,
    majors,
    industries,
    actionTips,
  };
}
