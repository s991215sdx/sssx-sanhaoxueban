/**
 * 人才测评报告：把分数翻译成「这人放在哪个岗位、会卡在哪、怎么带」。
 *
 * 两条写作原则：
 * 1）不给结论性标签（「他不适合做销售」），只描述行为与成本（「每天要打的陌生电话，他要额外消耗」）。
 * 2）每条判断都指回具体维度分，读者能自己复核。
 */

import {
  EQ_DIM_LABEL,
  EQ_FACTOR_LABEL,
  EQ_FACTOR_DIMS,
  EQ_STANDALONE_DIMS,
  BIGFIVE_DIM_LABEL,
  VALUE_DIM_LABEL,
  type EqDim,
  type EqFactor,
} from "./bank";
import {
  allFits,
  FIT_BAND_LABEL,
  FIT_BAND_TEXT,
  CORE_GAP_LINE,
  WEAK_LINE,
  DIM_LABEL,
  DIM_SOURCE,
  JOB_LABEL,
  JOB_BLURB,
  JOB_WEIGHTS,
  JOB_DUTY_PACK,
  WEIGHT_LABEL,
  type JobFit,
  type JobKey,
  type TalentDim,
  type TalentDims,
  type BigFiveScores,
  type ValueScores,
  type DiscWorkScores,
  type EqScores,
  type Weight,
} from "./score";
import { PART_META, DUTY_PACKS, type DutyPackKey } from "./bank";

/* ------------------------------ 维度解读 ------------------------------ */

type Level = "high" | "mid" | "low";
const levelOf = (s: number): Level => (s >= 65 ? "high" : s >= 35 ? "mid" : "low");

/** 十维的三档解读。high 写「这样在岗位上是什么样」，low 写「代价是什么」，不写褒贬。 */
const DIM_TEXT: Record<TalentDim, Record<Level, string>> = {
  influence: {
    high: "开口就能把事推着走，讲方案时对方容易跟着他的节奏想。丢给他一个不熟的客户，他敢先聊起来。",
    mid: "该说的时候能说清楚，但不会主动去争。需要说服的场合，准备好材料他就能顶住。",
    low: "更愿意把话讲准确，而不是讲动人。让他硬推一个家长当场签约，他会难受，效果也一般。",
  },
  empathy: {
    high: "会先顺着对方的情绪走一段，家长发火时不容易被点着。代价是有时候太顾及人，该收口的时候收不住。",
    mid: "能照顾到对方感受，但不会为此改变自己的判断。多数沟通场景够用。",
    low: "更关注事情本身对不对，不太接得住情绪。遇到情绪重的家长，容易越解释越僵。",
  },
  order: {
    high: "台账、记录、跟进表会做得很干净，交出去的东西基本不用返工。",
    mid: "该记的会记，但不会为格式较真。事情多的时候偶尔会漏。",
    low: "讨厌繁琐，台账容易断。要靠工具和流程兜，不能靠他自觉。",
  },
  drive: {
    high: "盯着结果不放，被拒绝也不太影响下一步动作。目标清楚的时候，他能自己往前推。",
    mid: "有目标就动，没目标就等安排。需要有人把数字明确给他。",
    low: "不太主动冲量，更愿意把交代的事情做好。放到纯结果岗上会很吃力。",
  },
  stable: {
    high: "被否定、被投诉之后能比较快回到正常状态，不会把一天的活都拖垮。",
    mid: "多数时候稳得住，连续的坏消息会明显影响状态。",
    low: "情绪回弹慢，一次冲突可能要缓一两天。天天要接投诉、扛业绩的岗位，得有人在背后接住他。",
  },
  duty: {
    high: "答应的事会自己盯到闭环，不用人催。细节上不太需要别人复核。",
    mid: "该做的会做完，遇到麻烦会先问一句再动。",
    low: "开头热、收尾松，长期项目容易烂尾。需要拆小节点、定期检查。",
  },
  achieve: {
    high: "自己要往上走，愿意接有难度的活。给成长空间比给钱更管用。",
    mid: "有成长机会会接，但不主动找。需要有人推一把。",
    low: "更看重当下稳定，不太愿意为「以后更好」多付出。用成长话术激励他没用。",
  },
  rule: {
    high: "流程清楚他才安心，按制度办不会有心理摩擦。适合要守规矩的岗位。",
    mid: "能守规矩，也能接受偶尔变通。",
    low: "讨厌被流程束缚，喜欢自己找路子。放到强合规岗位会天天顶牛。",
  },
  lead: {
    high: "愿意坐那个要管人的位置，指出问题、处理矛盾不会躲。",
    mid: "能带人，但更愿意自己干。团队小、事情清楚的时候可以。",
    low: "对管人没有兴趣，甚至排斥。硬提到管理岗，通常两头都做不好。",
  },
  detail: {
    high: "数字、名单、时间这类东西他天然会多看一眼，出错率低。",
    mid: "一般不会错，但在赶时间的时候会漏。",
    low: "快比准重要，重复核对让他痛苦。要配复核机制。",
  },
};

/* ------------------------------ 情商解读 ------------------------------ */

/** 15 维的短板建议（只在低分时给）。每条都落到具体动作，不是「多练习」。 */
const EQ_TIPS: Record<EqDim, string> = {
  AD: "换流程、换负责人这类变动，提前给他一版书面说明：变什么、不变什么、什么时候定。信息缺口比变动本身更耗他。",
  AS: "每周挑一次例会，让他把「我不同意的地方」讲完，不用先铺垫。练习的是「说出来不惹事」的经验。",
  SC: "把任务拆到他能看到自己做成的小节点，每完成一个当面确认一次。自信靠证据堆，不靠鼓励。",
  MO: "给他一个不用汇报、自己定节奏的小项目，一个月后只看结果。被盯着做事的人很难长出内驱。",
  EE: "养成「先复述、再回应」的习惯：把对方的话用自己的话说一遍，问一句「我理解得对吗」。",
  EM: "先从「让场面降温」这一件事练：不解决问题，只把人从情绪里捞出来，比如先倒杯水、换个地方。",
  ER: "情绪上来时先做一件机械的事（记要点、倒水、走到窗边），给自己 60 秒，再决定说什么。",
  EX: "把「我觉得」换成「我担心的是」——表达立场比表达情绪更容易被接住，也不容易被当成抱怨。",
  IC: "重要消息发出前，强制自己放 10 分钟再发。他的问题不是不懂，是太快。",
  RE: "给他一份「需要定期维护的人」清单（10 个以内），每月一次简短联系。关系靠节奏，不靠热情。",
  SA: "进新场合前，先弄清三件事：这里谁说了算、大家怎么称呼、什么话不能在这说。",
  SM: "压力大的时候先做「减法」而不是「加油」：把手上事情列出来，划掉三件不必须的。",
  TE: "遇到不认同的人，先写一句「他这么做，可能是为了……」，写完再回应。",
  HA: "把工作里让他舒服的具体事情记下来（哪类活、和谁搭），每周至少安排一件。",
  OP: "对担心的事写「最坏会怎样、概率多大、我能做什么」三行。悲观本身不是问题，悬着才是。",
};

/* ------------------------------ 岗位带人建议 ------------------------------ */

const JOB_COACHING: Record<JobKey, string[]> = {
  sales: [
    "前两周不要只压数字，先让他把话术跑顺：每天陪听 3 通电话，当天给一条具体改法。",
    "把「被拒绝」正常化：晨会公开讲昨天最难的一通电话怎么接的，把挫败变成素材。",
    "名单要分层给：先给意向度高的，让他先尝到成的感觉，再放冷名单。",
    "结果指标之外加一个过程指标（有效沟通数），否则他会被成单率打击到不敢打。",
  ],
  service: [
    "给他一套「家长情绪升级」的处理脚本：什么话必须说、什么话绝对不能说。",
    "明确「哪些要求可以答应、哪些必须上报」，否则他会为了平息情绪乱承诺。",
    "每周一次 20 分钟的个案复盘，只聊一个最难缠的家长，帮他把情绪和方法分开。",
    "续费和满意度之外，看他的跟进记录质量——这是他这类岗位的真实功底。",
  ],
  admin: [
    "把流程写成清单给他，不要口头交代。这类人靠清单稳定，不靠记性。",
    "允许他问「为什么要这样」，回答清楚一次，以后就不用再管。",
    "排课、金额这类高风险动作，设一道复核，别指望人不出错。",
    "临时插事要提前说，突然改计划对他是最大的消耗。",
  ],
  mgmt: [
    "先给他一个 3—5 人的小团队，别一上来给大摊子。",
    "明确「你的考核是团队的结果，不是你个人的业绩」，否则他会回去抢单。",
    "第一次处理人的矛盾，陪他过一遍，事后复盘他怎么开的口。",
    "给他决策的边界：哪些他自己定、哪些必须报，边界不清他会一直往上推。",
  ],
};

/* ------------------------------ 面试追问 ------------------------------ */

const JOB_INTERVIEW: Record<JobKey, string[]> = {
  sales: [
    "讲一个你被连续拒绝之后，还继续跟进并最终成交的例子。当时第几天最难熬，你怎么过的？",
    "家长说「我再考虑一下」，你接下来会做什么？请具体到你会说的第一句话。",
    "你上一个周期没完成目标，差多少？你怎么判断差在哪一环？",
  ],
  service: [
    "讲一次家长把不是你的责任推给你，你当时怎么回的？事后怎么处理自己的情绪？",
    "有没有答应过家长一件你其实做不到的事？后来怎么收的场？",
    "同时有三个家长找你，其中两个在发火，你先处理哪个？为什么？",
  ],
  admin: [
    "给你一份排课表和一个退费单，你第一眼看什么？（现场给材料，看他从哪查起）",
    "讲一次你发现的差错，是你自己发现的还是别人发现的？怎么发现的？",
    "事情堆在一起、又有人催，你怎么排先后？举个最近的例子。",
  ],
  mgmt: [
    "你现在带几个人？其中最难带的是谁，你做了什么，结果如何？",
    "讲一次你不得不告诉下属「你做得不好」的谈话。你第一句话怎么说的？",
    "你做过的最冒险的一个决定是什么？如果重来，你会改哪一步？",
  ],
};

/* ------------------------------ 报告数据 ------------------------------ */

export type TalentReportInput = {
  name: string;
  position: JobKey;
  generatedAt: string;
  /** 已完成的作答部分 */
  parts: {
    bigfive?: BigFiveScores;
    value?: ValueScores;
    discwork?: DiscWorkScores;
    eq?: EqScores;
    duty?: { pack: DutyPackKey; score: number; answered: number } | null;
  };
  dims: TalentDims;
  details: { key: TalentDim; label: string; score: number; basis: "measured" | "estimated"; source: string }[];
  answered: { bigfive?: number; value?: number; discwork?: number; eq?: number; duty?: number };
};

export type TalentReport = {
  meta: { name: string; position: JobKey; positionLabel: string; generatedAt: string };
  completeness: { done: string[]; missing: string[]; pct: number };
  fits: JobFit[];
  current: JobFit;
  currentBand: { key: string; label: string; text: string };
  dims: { key: TalentDim; label: string; score: number; level: Level; text: string; source: string; basis: string }[];
  weights: { dim: TalentDim; label: string; source: string; values: Record<JobKey, Weight> }[];
  strengths: { label: string; score: number; text: string }[];
  risks: { label: string; score: number; text: string; isCore: boolean }[];
  bigger: { bigfive: BigFiveScores | null; value: ValueScores | null; disc: DiscWorkScores | null };
  eq: {
    overall: number;
    level: string;
    factors: { key: EqFactor; label: string; score: number; dims: { dim: EqDim; label: string; score: number }[] }[];
    standalone: { dim: EqDim; label: string; score: number }[];
    low3: { dim: EqDim; label: string; score: number; tip: string }[];
    high3: { dim: EqDim; label: string; score: number }[];
    /** 情商与岗位的交点：这个岗位最吃哪几个情商维 */
  } | null;
  coaching: string[];
  interview: string[];
  caveats: string[];
};

/** 岗位最吃的情商维（用于把情商分数接到岗位上，而不是孤立地看） */
export const JOB_EQ_FOCUS: Record<JobKey, EqDim[]> = {
  sales: ["OP", "SM", "EM", "AS"],
  service: ["ER", "TE", "SM", "RE"],
  admin: ["IC", "AD", "SM", "SC"],
  mgmt: ["EM", "AS", "SC", "MO"],
};

const eqLevelText = (s: number) =>
  s >= 75 ? "高于平均水平" : s >= 45 ? "平均水平" : "低于平均水平";

export function buildTalentReport(input: TalentReportInput): TalentReport {
  const { dims, details, parts, answered, position } = input;

  const done: string[] = [];
  const missing: string[] = [];
  const partKeys: { key: DutyPackKey | "bigfive" | "value" | "discwork" | "eq"; n: number; need: number }[] = [
    { key: "bigfive", n: answered.bigfive ?? 0, need: 16 },
    { key: "value", n: answered.value ?? 0, need: 14 },
    { key: "discwork", n: answered.discwork ?? 0, need: 20 },
    { key: "eq", n: answered.eq ?? 0, need: 24 },
    { key: JOB_DUTY_PACK[position], n: answered.duty ?? 0, need: 8 },
  ];
  for (const p of partKeys) {
    const meta = PART_META[p.key as keyof typeof PART_META];
    if (p.n >= p.need) done.push(meta.name);
    else missing.push(meta.name);
  }
  const completeness = {
    done,
    missing,
    pct: Math.round((done.length / partKeys.length) * 100),
  };

  const fits = allFits(dims);
  const current = fits.find((f) => f.job === position) ?? fits[0];
  const band = current.band;

  const dimRows = details.map((d) => {
    const level = levelOf(d.score);
    return { key: d.key, label: d.label, score: d.score, level, text: DIM_TEXT[d.key][level], source: d.source, basis: d.basis };
  });

  const weights = (Object.keys(DIM_LABEL) as TalentDim[]).map((dim) => ({
    dim,
    label: DIM_LABEL[dim],
    source: DIM_SOURCE[dim],
    values: Object.fromEntries((Object.keys(JOB_LABEL) as JobKey[]).map((j) => [j, JOB_WEIGHTS[j][dim]])) as Record<JobKey, Weight>,
  }));

  /* 强项：优先给「当前岗位权重 ≥2 且分高」的，读的人才用得上 */
  const w = JOB_WEIGHTS[position];
  const ranked = [...dimRows].sort((a, b) => b.score - a.score);
  const strengths = ranked
    .filter((d) => d.score >= 60)
    .sort((a, b) => w[b.key] - w[a.key] || b.score - a.score)
    .slice(0, 3)
    .map((d) => ({ label: d.label, score: d.score, text: d.text }));

  const risks = ranked
    .filter((d) => d.score < 55)
    .sort((a, b) => w[b.key] - w[a.key] || a.score - b.score)
    .slice(0, 3)
    .map((d) => ({ label: d.label, score: d.score, text: d.text, isCore: w[d.key] === 3 }));

  const eq = parts.eq
    ? (() => {
        const e = parts.eq!;
        const dimRowsEq = (Object.keys(EQ_DIM_LABEL) as EqDim[]).map((d) => ({ dim: d, label: EQ_DIM_LABEL[d], score: e.dims[d] }));
        const sorted = [...dimRowsEq].sort((a, b) => a.score - b.score);
        return {
          overall: e.overall,
          level: eqLevelText(e.overall),
          factors: (Object.keys(EQ_FACTOR_LABEL) as EqFactor[]).map((f) => ({
            key: f,
            label: EQ_FACTOR_LABEL[f],
            score: e.factors[f],
            dims: EQ_FACTOR_DIMS[f].map((d) => ({ dim: d, label: EQ_DIM_LABEL[d], score: e.dims[d] })),
          })),
          standalone: EQ_STANDALONE_DIMS.map((d) => ({ dim: d, label: EQ_DIM_LABEL[d], score: e.dims[d] })),
          low3: sorted.slice(0, 3).map((x) => ({ ...x, tip: EQ_TIPS[x.dim] })),
          high3: sorted.slice(-3).reverse(),
        };
      })()
    : null;

  const coaching = [...JOB_COACHING[position]];
  /* 有硬缺口的，第一条建议直接指向缺口，别让读者自己去对表 */
  if (current.gaps.length) {
    const g = current.gaps[0];
    coaching.unshift(`${g.label}只有 ${g.score} 分，这是这个岗位的核心项——不要靠"多提醒"解决，得改流程或配人补位。`);
  }

  const caveats = [
    "本报告用的是自编题本，结构参考大五、DISC、特质情绪智力的公开框架，不是任何商业量表的授权版本，没有外部常模。分数是「和自己比、和同事比」的参考，不是百分位排名。",
    "自评题会被美化，越是在意的维度越容易答高。关键判断请结合工作样本（试讲、模拟电话、现场校对）和结构化面试。",
    "「成就动机」「规则遵从」两项来自工作价值观，测的是「多看重」而不是「多强」。看重不等于做得到。",
    ...(missing.length ? [`本次未完成：${missing.join("、")}。相关维度用相邻数据估了值，报告中已标「估算」，结论请打折看。`] : []),
    "测评不作为录用或淘汰的唯一依据，也不解释为心理诊断。",
  ];

  return {
    meta: { name: input.name, position, positionLabel: JOB_LABEL[position], generatedAt: input.generatedAt },
    completeness,
    fits,
    current,
    currentBand: { key: band, label: FIT_BAND_LABEL[band], text: FIT_BAND_TEXT[band] },
    dims: dimRows,
    weights,
    strengths,
    risks,
    bigger: { bigfive: parts.bigfive ?? null, value: parts.value ?? null, disc: parts.discwork ?? null },
    eq,
    coaching,
    interview: JOB_INTERVIEW[position],
    caveats,
  };
}

/* ------------------------------ 供 UI 复用的元信息 ------------------------------ */

export { JOB_LABEL, JOB_BLURB, JOB_WEIGHTS, WEIGHT_LABEL, DIM_LABEL, DIM_SOURCE, FIT_BAND_LABEL, FIT_BAND_TEXT, CORE_GAP_LINE, WEAK_LINE };
export { DUTY_PACKS, PART_META, BIGFIVE_DIM_LABEL, VALUE_DIM_LABEL };
