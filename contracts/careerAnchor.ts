/**
 * 职业锚测评（施恩 Schein 职业锚理论）题库、计分器与报告文案生成。
 *
 * 理论依据：职业锚理论由埃德加·施恩（Edgar H. Schein，麻省理工学院
 * 斯隆管理学院）提出，指一个人在长期职业选择中「无论如何都不愿放弃」
 * 的核心价值观与动机。施恩将其归纳为八种类型：技术/职能、管理、
 * 自主/独立、安全/稳定、创造/创业、服务/奉献、挑战、生活。
 *
 * 本量表面向中学生改写：题干全部改写为可观察的校园/生活行为偏好，
 * Likert 5 级自评（1=完全不符合 … 5=非常符合），每型 5 题聚合求均分，
 * 并穿插反向题抑制「一路打钩」的作答偏差。
 * 测评结果为职业价值观倾向的参考，而非职业方向的定论。
 *
 * 前后端共享：纯类型、纯数据、纯函数，不依赖服务端或 React。
 */

export type AnchorKey = "TF" | "GM" | "AU" | "SE" | "EC" | "SV" | "CH" | "LS";

/** 固定型序（并列排序、结果展示均以此为基准顺序）。 */
export const ANCHOR_ORDER: AnchorKey[] = ["TF", "GM", "AU", "SE", "EC", "SV", "CH", "LS"];

/** 各型中文名（含斜杠全称）。 */
export const ANCHOR_LABEL: Record<AnchorKey, string> = {
  TF: "技术/职能型",
  GM: "管理型",
  AU: "自主/独立型",
  SE: "安全/稳定型",
  EC: "创造/创业型",
  SV: "服务/奉献型",
  CH: "挑战型",
  LS: "生活型",
};

export type AnchorRating = {
  no: number;
  text: string;
  /** 反向题（计分时按 6 - 原值 换算）。 */
  reverse: boolean;
  anchor: AnchorKey;
};

export type AnchorResult = {
  /** 每型均分（反向题换算后），保留 1 位小数，范围 1-5。 */
  dims: Record<AnchorKey, number>;
  /** 均分最高的前两型（并列按 ANCHOR_ORDER 固定型序）。 */
  top2: AnchorKey[];
  summary: string;
};

type AnchorItem = { text: string; reverse?: boolean };

/* 每型 5 题：行为化题干（可观察的校园/生活情境），▲ 为反向题（共 6 道）。 */
const ANCHOR_BANK: Record<AnchorKey, AnchorItem[]> = {
  TF: [
    { text: "把一件事做到「班里没人比我更懂」，比当班干部更让我有成就感" },
    { text: "我喜欢反复打磨一项技能（乐器、编程、某项运动），直到明显比别人强" },
    { text: "别人夸我「这件事做得真专业」比夸我「真会带人」更让我开心" },
    { text: "我不太在乎自己某项本事练得好不好", reverse: true },
    { text: "遇到难题时，我更想靠自己钻研出方法，而不是先找人帮忙" },
  ],
  GM: [
    { text: "小组活动时，我常常自然地成为分工和拿主意的那个人" },
    { text: "我喜欢把大家组织起来完成一件事，并乐意对结果负责" },
    { text: "带着团队赢，比自己一个人赢更让我兴奋" },
    { text: "遇到意见分歧时，我敢拍板，也愿意承担拍板的责任" },
    { text: "我很不愿意替集体做决定、承担责任", reverse: true },
  ],
  AU: [
    { text: "学习计划由我自己定的时候，我的执行率最高" },
    { text: "被管得太细、每一步都被安排，会让我特别难受" },
    { text: "我喜欢自己选择用什么方式完成任务，而不是照别人的方法做" },
    { text: "我做事完全需要别人安排好，自己拿主意会觉得不安", reverse: true },
    { text: "比起被表扬「听话」，我更希望被承认「这是他自己做到的」" },
  ],
  SE: [
    { text: "每天固定的作息和学习流程，会让我学得特别安心" },
    { text: "规则清晰、要求明确的任务，我完成得又快又好" },
    { text: "面对陌生的环境或突然的变化，我需要一点时间才能适应" },
    { text: "我特别喜欢冒险和充满不确定的事情，越刺激越好", reverse: true },
    { text: "别人说我「靠谱、交给他的事不会出岔子」，我会很受用" },
  ],
  EC: [
    { text: "我脑子里经常冒出新点子，并特别想把它做出来看看" },
    { text: "做一个属于自己的「作品」（视频、模型、小发明），比考高分更让我兴奋" },
    { text: "我喜欢给熟悉的事物想出不一样的新玩法" },
    { text: "我很少有什么新点子，照着现成的做就挺好", reverse: true },
    { text: "如果一件事没人做过，我会特别想当第一个做成的人" },
  ],
  SV: [
    { text: "同学遇到不会的题来问我，帮到他我会特别开心" },
    { text: "做志愿者或帮到别人的事，即使没报酬我也愿意投入" },
    { text: "我希望将来做的事能真真切切地帮到一些人" },
    { text: "别人过得好不好跟我关系不大，我很少放在心上", reverse: true },
    { text: "班级有需要出力的活动时，我常常主动报名" },
  ],
  CH: [
    { text: "题目越难，我越想把它攻下来" },
    { text: "和别人比拼（竞赛、排名、游戏）会让我状态特别好" },
    { text: "「这件事你肯定做不到」这种话，反而会激起我的斗志" },
    { text: "我喜欢不断给自己设定更高的目标，然后超越它" },
    { text: "轻松就能完成的事，做久了我反而会提不起劲" },
  ],
  LS: [
    { text: "学习和玩、休息、爱好之间的平衡，对我来说特别重要" },
    { text: "如果忙得完全没有自己的时间，我会很快状态变差" },
    { text: "我希望将来工作和生活能兼顾，而不是只有工作" },
    { text: "效率高一点、早点完成任务，然后安心去玩，是我最舒服的节奏" },
    { text: "家人、朋友和兴趣爱好，在我心里的分量不比成绩轻" },
  ],
};

/** 职业锚题库：40 道 Likert 题，每型 5 题，按型分组排列。 */
export const ANCHOR_RATINGS: AnchorRating[] = ANCHOR_ORDER.flatMap((anchor) =>
  ANCHOR_BANK[anchor].map((q) => ({ ...q, anchor })),
).map((q, i) => ({ no: i + 1, text: q.text, reverse: q.reverse === true, anchor: q.anchor }));

/** 每型题数。 */
export const ANCHOR_PER_DIM = 5;

/* ---------------- 计分 ---------------- */

/**
 * 职业锚计分。ratings[i]：第 i+1 题自评分（1-5）；长度须为 40。
 * 反向题按 6 - 原值 换算；每型均分保留 1 位小数；
 * top2 为均分最高的两型（并列按 ANCHOR_ORDER 固定型序）。
 */
export function scoreAnchor(ratings: number[]): AnchorResult {
  if (ratings.length !== ANCHOR_RATINGS.length) {
    throw new Error(`职业锚测评题数应为 ${ANCHOR_RATINGS.length}，实际 ${ratings.length}`);
  }
  const sum: Record<AnchorKey, number> = { TF: 0, GM: 0, AU: 0, SE: 0, EC: 0, SV: 0, CH: 0, LS: 0 };
  const cnt: Record<AnchorKey, number> = { TF: 0, GM: 0, AU: 0, SE: 0, EC: 0, SV: 0, CH: 0, LS: 0 };
  ratings.forEach((raw, i) => {
    if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
      throw new Error(`第 ${i + 1} 题分值应为 1-5，实际 ${raw}`);
    }
    const q = ANCHOR_RATINGS[i];
    const v = q.reverse ? 6 - raw : raw;
    sum[q.anchor] += v;
    cnt[q.anchor] += 1;
  });
  const dims = Object.fromEntries(
    ANCHOR_ORDER.map((k) => [k, Math.round((sum[k] / cnt[k]) * 10) / 10]),
  ) as Record<AnchorKey, number>;
  const top2 = [...ANCHOR_ORDER]
    .sort((a, b) => dims[b] - dims[a] || ANCHOR_ORDER.indexOf(a) - ANCHOR_ORDER.indexOf(b))
    .slice(0, 2);
  const summary =
    `你的职业锚 Top2 是「${ANCHOR_LABEL[top2[0]]}」（${dims[top2[0]]} 分）和「${ANCHOR_LABEL[top2[1]]}」（${dims[top2[1]]} 分）。` +
    "职业锚是你内心深处「最不愿放弃」的东西，它决定什么工作能让你长久地有干劲。现在的倾向不代表定型，但它能帮你提前看懂：什么样的努力方式最适合你。";
  return { dims, top2, summary };
}

/* ---------------- 报告内容 ---------------- */

type AnchorContent = {
  /** 八型简表一句话特征。 */
  trait: string;
  /** 典型特征解析。 */
  feature: string;
  /** 更愿意从事的工作。 */
  workStyle: string;
  /** 期望被认可的方式。 */
  recognition: string;
  /** 该职业锚对孩子学习动机/方式的影响与建议（落到学习场景）。 */
  studyImpact: string[];
  /** 主要职业领域。 */
  careerFields: string[];
};

const ANCHOR_CONTENT: Record<AnchorKey, AnchorContent> = {
  TF: {
    trait: "最看重把一门本事练到顶尖，靠专业实力立足",
    feature:
      "你最在意的是在自己选定的领域里不断精进，成为「这件事找我就对了」的那个人。比起管人、出名或赚快钱，把专业做深带来的成就感和尊严感，才是你最大的动力来源。",
    workStyle:
      "更愿意长期从事需要扎实专业功底、能持续精进技能的工作：工程师、医生、教师、科研人员、设计师、程序员等——靠真本事吃饭，越资深越有价值。",
    recognition: "希望别人认可的是你的专业水准本身——「他/她在这方面是真懂」，而不是职位有多高、场面有多大。",
    studyImpact: [
      "把「掌握感」当作你的核心动力：给自己定「把这个章节彻底吃透」的目标，比「考第几名」更能点燃你",
      "选一门优势学科往深挖，成为班里的「小专家」，这份专业自信会反过来带动其他学科",
      "遇到短板科目时，把它也看成一项「可以练出来的技能」，用拆解、刻意练习代替畏难情绪",
    ],
    careerFields: ["工程与技术", "医疗与卫生", "教育与科研", "设计与专业创作"],
  },
  GM: {
    trait: "喜欢带团队、做决策，追求更大的责任与影响力",
    feature:
      "你喜欢把事情组织起来、带着一群人达成目标。做决定、担责任对你来说不是负担而是兴奋点，你天然会关注「怎么让大家一起赢」。",
    workStyle:
      "更愿意从事带团队、定方向、协调资源的工作：项目负责人、管理者、创业者、组织者——责任越大、舞台越大，你越来劲。",
    recognition: "希望被认可的是领导力和责任心——「这个团队交给他/她，放心」。",
    studyImpact: [
      "在小组学习中主动认领「组长」角色：分工、盯进度、做总结——组织别人会逼你自己先学会",
      "把学习目标当项目管：定里程碑、做复盘、调整计划，用管理的方式管理自己的学习",
      "多给同学讲题：「教」是最深度的「学」，还能同时练出你最看重的带队能力",
    ],
    careerFields: ["工商管理", "公共管理", "项目与运营管理", "组织与人力资源"],
  },
  AU: {
    trait: "最看重按自己的节奏和方式做事，讨厌被管得太死",
    feature:
      "你最在意自由和掌控感：时间怎么安排、事情用什么方式做，希望由自己说了算。外部约束越多你越难受，而自主权一旦到手，你反而会比谁都自律。",
    workStyle:
      "更愿意从事时间弹性、成果导向、能自主安排的工作：自由职业者、顾问、独立设计师、远程开发者、作家——用成果说话，而不是用坐班说话。",
    recognition: "希望被认可的是独立完成的成果——「这是他/她自己做到的」，而不是「真听话」。",
    studyImpact: [
      "把学习的「选择权」握在手里：自己定计划表并签字确认——自己定的计划，你的执行率最高",
      "和家长老师约定「自主试验区」：某一科由你全权安排，用结果换取更多自主权",
      "被催得烦时，把「别人的要求」改写成「自己的目标」，同一件事，动力会完全不同",
    ],
    careerFields: ["自由创作与自媒体", "咨询与顾问", "独立执业（律师/医师/设计师）", "远程技术岗位"],
  },
  SE: {
    trait: "看重稳定可预期的环境，安全感足才能安心发挥",
    feature:
      "你最在意的是稳定和可预期：熟悉的环境、清晰的规则、踏实的积累让你安心。你不是怕努力，而是需要在「心里有底」的状态下才能稳定输出。",
    workStyle:
      "更愿意从事制度完善、发展路径清晰、风险较低的工作：公务员、教师、大型机构或企事业单位的岗位——稳稳地把事情做好、把路走长。",
    recognition: "希望被认可的是可靠和稳定——「交给他/她的事，不会出岔子」。",
    studyImpact: [
      "用固定节奏换安全感：每天同一时段、同一流程学习，稳定的仪式感就是你的加油站",
      "大考前心里没底时，回到「熟悉的题」里热身几组，稳定感会帮你找回状态",
      "每周加一道「可控的冒险」：试一道略超舒适区的题——稳定不等于原地踏步",
    ],
    careerFields: ["公共事务与公务员体系", "教育", "金融与会计", "大型企事业单位"],
  },
  EC: {
    trait: "满脑子新点子，最想把想法变成现实、做出属于自己的东西",
    feature:
      "你最兴奋的是从零到一：冒出新点子、把它做出来、看着它一点点长大。「创造一个属于自己的东西」带给你的满足，超过任何现成的东西。",
    workStyle:
      "更愿意从事创造新产品、新作品、新玩法的工作：创业者、产品经理、发明者、原创内容创作者——从无到有，由你定义。",
    recognition: "希望被认可的是原创成果——「这个东西是他/她创造的」。",
    studyImpact: [
      "用「做作品」的方式学：把知识做成思维导图、科普小视频、小模型——输出让学习变得好玩",
      "一题多解、自编题目是你的菜：给课本知识「发明」新玩法，理解会深得多",
      "点子多也要落地：给自己定「每周完成一个小作品」的纪律——创造力需要执行力护航",
    ],
    careerFields: ["创业与新产品开发", "产品策划与设计", "传媒与内容创作", "科技创新"],
  },
  SV: {
    trait: "最看重帮到别人，做有意义、对社会有贡献的事",
    feature:
      "你最在意的是意义感：做的事能不能真真切切帮到别人、让世界好一点，决定了你觉得值不值。别人的一句「多亏了你」，比很多奖励都更能滋养你。",
    workStyle:
      "更愿意从事直接帮助他人的工作：医生、教师、社工、心理咨询师、公益从业者——用自己的能力回应别人的需要。",
    recognition: "希望被认可的是带来的改变——「因为有他/她，别人更好了」。",
    studyImpact: [
      "把学习和「意义」挂钩：想想学好它将来能帮到谁——意义感是你最持久的燃料",
      "主动帮同学讲题、组织互助小组：利他这件事，会同时提升你的成绩和动力",
      "记得别过度消耗自己：先照顾好自己的状态，帮助别人才可持续",
    ],
    careerFields: ["医疗与护理", "教育", "社会工作与公益", "心理与健康服务"],
  },
  CH: {
    trait: "越难越兴奋，专治各种不可能，赢的感觉最重要",
    feature:
      "你最享受的是挑战本身：难题、竞争、甚至一句「你做不到」，都能瞬间点燃你。对你来说，翻过的高墙才是风景，平坦的大路反而无聊。",
    workStyle:
      "更愿意从事高挑战、高竞争、不断有新难题的工作：竞赛与竞技、销售与市场攻坚、应急岗位、高精尖技术攻关——永远有下一座山。",
    recognition: "希望被认可的是「打赢了硬仗」——「这么难的事，他/她做到了」。",
    studyImpact: [
      "把学习变成「打怪升级」：给每章设一道 BOSS 题、记录自己的「通关率」，你会越战越勇",
      "找一个旗鼓相当的「对手」：和同学约定良性比拼——竞争是你的兴奋剂",
      "警惕「只爱难题、嫌弃基础」：真正的挑战者，会把基础题正确率也刷到 100%",
    ],
    careerFields: ["竞赛与竞技", "市场与销售攻坚", "应急与攻坚岗位", "前沿技术攻关"],
  },
  LS: {
    trait: "工作是为了更好地生活，最看重平衡与生活质量",
    feature:
      "你最在意的是平衡：努力很重要，但生活、兴趣、家人朋友同样不能被牺牲。你追求的是「既能把事做好，也能把日子过好」的完整人生。",
    workStyle:
      "更愿意从事节奏合理、能为生活留出空间的工作：重视氛围与生活质量，不盲目挤高强度赛道，用效率而非时长取胜。",
    recognition: "希望被认可的是「活得好」——既能把事情做好，也能把生活过好。",
    studyImpact: [
      "用「高效换自由」：用番茄钟把学习效率拉满，省下的时间理直气壮地玩和休息",
      "把兴趣当成学习的缓冲区：状态差时先做喜欢的事回血，再回到书桌",
      "平衡不是躺平：给学习定「每天必做的三件事」作为最低保障线，其余时间自由安排",
    ],
    careerFields: ["文化与休闲产业", "环境与设计", "公共事业", "弹性工作制的专业岗位"],
  },
};

/** 最突出两型的详细解析。 */
export type AnchorTopReport = {
  key: AnchorKey;
  /** 型别代码（同 key）。 */
  code: AnchorKey;
  label: string;
  /** 该型均分。 */
  score: number;
  feature: string;
  workStyle: string;
  recognition: string;
  studyImpact: string[];
  careerFields: string[];
};

/** 八型简表行。 */
export type AnchorTableRow = {
  key: AnchorKey;
  code: AnchorKey;
  label: string;
  score: number;
  trait: string;
  /** 是否进入 Top2。 */
  isTop: boolean;
};

export type AnchorReport = {
  top2: AnchorTopReport[];
  table: AnchorTableRow[];
  theoryNote: string;
};

/**
 * 生成职业锚报告：最突出两型的详细解析（特征 / 更愿意从事的工作 /
 * 期望被认可的方式 / 对学习的影响与建议 / 主要职业领域）+ 八型简表 + 理论依据。
 */
export function buildAnchorReport(result: AnchorResult): AnchorReport {
  const top2 = result.top2.map((key) => {
    const c = ANCHOR_CONTENT[key];
    return {
      key,
      code: key,
      label: ANCHOR_LABEL[key],
      score: result.dims[key],
      feature: c.feature,
      workStyle: c.workStyle,
      recognition: c.recognition,
      studyImpact: c.studyImpact,
      careerFields: c.careerFields,
    };
  });
  const table = ANCHOR_ORDER.map((key) => ({
    key,
    code: key,
    label: ANCHOR_LABEL[key],
    score: result.dims[key],
    trait: ANCHOR_CONTENT[key].trait,
    isTop: result.top2.includes(key),
  }));
  const theoryNote =
    "理论依据：职业锚（Career Anchor）理论由埃德加·施恩（Edgar H. Schein）于美国麻省理工学院（MIT）斯隆管理学院提出——每个人在职业选择中都有一根「锚」，即无论如何都不愿放弃的核心价值观与动机；看清自己的锚，才能选择让自己长久有干劲的方向。";
  return { top2, table, theoryNote };
}
