/**
 * 多元智能测评（加德纳八大智能）题库与计分器。
 *
 * 本量表以加德纳（Howard Gardner）多元智能理论为框架，参照 MIDAS
 * 自陈式量表的编写思路设计：题干全部改写为可观察的校园/生活行为描述
 * （而非「我逻辑很强」这类抽象自评），每维 5 题聚合求均分以保证基本的
 * 内部一致性，并穿插 6 道反向题抑制「一路打钩」的作答偏差。
 * 测评结果为发展倾向的参考，而非智力高低的定论。
 *
 * 前后端共享：纯类型、纯数据、纯函数，不依赖服务端或 React。
 */

export type MultiKey =
  | "linguistic"
  | "logicalMath"
  | "spatial"
  | "musical"
  | "bodily"
  | "interpersonal"
  | "intrapersonal"
  | "naturalist";

/** 固定维序（并列排序、结果展示均以此为基准顺序）。 */
export const MULTI_DIM_ORDER: MultiKey[] = [
  "linguistic",
  "logicalMath",
  "spatial",
  "musical",
  "bodily",
  "interpersonal",
  "intrapersonal",
  "naturalist",
];

/** 维度中文名（供报告与结果卡展示）。 */
export const MULTI_DIM_LABEL: Record<MultiKey, string> = {
  linguistic: "语言智能",
  logicalMath: "逻辑数学",
  spatial: "空间智能",
  musical: "音乐智能",
  bodily: "身体动觉",
  interpersonal: "人际沟通",
  intrapersonal: "自我认知",
  naturalist: "自然观察",
};

/** 每维一句优势描述（供结果卡展示）。 */
export const MULTI_DIM_TRAIT: Record<MultiKey, string> = {
  linguistic: "你善于用语言表达和倾听，讲故事、说想法都清楚有条理",
  logicalMath: "你喜欢推理和找规律，遇到问题习惯一步步分析清楚",
  spatial: "你善于在头脑中构图，对图形、路线和空间关系很敏感",
  musical: "你对声音、节奏和旋律很敏感，容易记住听过的东西",
  bodily: "你动手能力强、动作学得快，在操作和体验中学得最好",
  interpersonal: "你善于理解别人的情绪和想法，在合作中很受欢迎",
  intrapersonal: "你了解自己、善于复盘，能清楚说出自己的感受和目标",
  naturalist: "你善于观察自然与环境的细微变化，分类和辨别能力强",
};

/** 每维对应的学习方式建议（summary 引用）。 */
const MULTI_DIM_ADVICE: Record<MultiKey, string> = {
  linguistic: "可以多用「讲出来」的方式学习：把知识点复述给同学或家长听，用写小结、编口诀来加深记忆",
  logicalMath: "可以多用「找规律、画逻辑链」的方式学习：做题后追问每一步为什么，用思维导图梳理因果",
  spatial: "可以多用图象和几何直观记知识：画示意图、用颜色分区、把抽象概念「画」出来",
  musical: "可以把要记的内容配上节奏或旋律：编顺口溜、打着拍子背诵，利用听觉记忆优势",
  bodily: "可以边动边学：用实验、角色扮演、手势比划来理解知识，学习间隙安排适量活动",
  interpersonal: "可以多讲题给别人听、参加学习小组：在讨论和教别人的过程中自己会理解得更透",
  intrapersonal: "可以坚持写学习日记复盘：记录今天哪里学得好、哪里卡住，自己给自己定小目标",
  naturalist: "可以用分类、比较的方法整理知识：把知识点像观察自然一样分门别类、找异同",
};

export type MultiRating = {
  no: number;
  text: string;
  /** 反向题（计分时按 6 - 原值 换算）。 */
  reverse: boolean;
  dim: MultiKey;
};

export type MultiResult = {
  /** 每维均分（反向题换算后），保留 1 位小数。 */
  dims: Record<MultiKey, number>;
  /** 均分最高的前三维（并列按 MULTI_DIM_ORDER 固定维序）。 */
  top3: MultiKey[];
  summary: string;
};

type MultiItem = { text: string; reverse?: boolean };

/* 每维 5 题：行为化题干（可观察的校园/生活情境），▲ 为反向题。 */
const MULTI_BANK: Record<MultiKey, MultiItem[]> = {
  linguistic: [
    { text: "我讲故事或转述事情时，别人很容易听明白" },
    { text: "写作文或发言时，我常常想半天也找不出合适的词", reverse: true },
    { text: "读完一篇课文或课外书，我能说出它的主要内容" },
    { text: "老师口头布置的事情，我听一遍就能记住" },
    { text: "和同学聊天时，我总能把自己的意思表达清楚" },
  ],
  logicalMath: [
    { text: "我喜欢琢磨数独、推理题或找规律的游戏" },
    { text: "做数学题时，我能说出每一步「为什么这样算」" },
    { text: "看到一串数字或图形，我常会下意识去找规律" },
    { text: "买东西算钱、算折扣时，我很快就能算清楚" },
    { text: "听到一个说法时，我会想「这个道理站得住脚吗」" },
  ],
  spatial: [
    { text: "看地图或示意图找地方，对我来说不难" },
    { text: "玩拼图、搭积木或折纸时，我上手很快" },
    { text: "我能在脑子里「转动」一个立体图形，想象它的另一面" },
    { text: "做题时配上图形辅助（如画线段图），我会解得更顺" },
    { text: "走过一遍的路线，我通常能记住怎么走回去" },
  ],
  musical: [
    { text: "一首歌听几遍，我就能跟着哼出旋律" },
    { text: "我很少注意到周围环境里的声音和节奏", reverse: true },
    { text: "别人唱歌或演奏跑调时，我能听得出来" },
    { text: "走路或做事时，我常常不自觉地打拍子" },
    { text: "背东西时，我喜欢编成顺口溜或有节奏的念法" },
  ],
  bodily: [
    { text: "体育课上的新动作，我看几遍就能学会" },
    { text: "做手工、实验操作或使用工具时，我的手很灵巧" },
    { text: "坐着不动太久我会难受，总想起来活动一下" },
    { text: "学习新动作（比如新的操、新的舞蹈）时，我常常跟不上别人", reverse: true },
    { text: "我喜欢用比划、手势来帮助自己表达或记东西" },
  ],
  interpersonal: [
    { text: "同学有心事时，常常愿意来找我聊" },
    { text: "小组合作时，我能察觉谁被冷落了，并照顾到他" },
    { text: "讨论问题时，我常常听不进别人的意见", reverse: true },
    { text: "我比较容易看出别人是高兴还是不高兴" },
    { text: "比起一个人做，我更喜欢和别人一起完成任务" },
  ],
  intrapersonal: [
    { text: "考完试我会想「这次哪里做得好、哪里要改」" },
    { text: "我清楚自己擅长什么、不擅长什么" },
    { text: "情绪不好的时候，我能说出自己为什么不开心" },
    { text: "我会给自己定小目标，并检查有没有做到" },
    { text: "被问到「你为什么这样做」时，我常常答不上来", reverse: true },
  ],
  naturalist: [
    { text: "我能说出好几种常见动植物的名字和特点" },
    { text: "我会注意到天气、季节变化带来的细微不同" },
    { text: "养植物或小动物时，我能发现它们的状态变化" },
    { text: "走在熟悉的路上，我很少留意周围花草树木的变化", reverse: true },
    { text: "我喜欢观察昆虫、星空或自然现象，并想知道为什么" },
  ],
};

/**
 * 打散的维度出场顺序（5 轮 × 8 维，每维恰好 5 次；
 * 任意相邻题不同维，全卷分布均匀）。
 */
export const MULTI_DIM_SEQUENCE: MultiKey[] = [
  "linguistic", "logicalMath", "spatial", "musical", "bodily", "interpersonal", "intrapersonal", "naturalist",
  "spatial", "bodily", "linguistic", "naturalist", "logicalMath", "interpersonal", "musical", "intrapersonal",
  "musical", "intrapersonal", "bodily", "logicalMath", "naturalist", "linguistic", "interpersonal", "spatial",
  "interpersonal", "naturalist", "intrapersonal", "spatial", "musical", "bodily", "logicalMath", "linguistic",
  "bodily", "musical", "naturalist", "intrapersonal", "spatial", "interpersonal", "linguistic", "logicalMath",
];

/**
 * 多元智能题库：40 道 Likert 5 点评分题
 * （1=完全不符合，2=不太符合，3=不确定/一般，4=比较符合，5=完全符合），
 * 八个维度各 5 题，含 6 道反向题，顺序已按 MULTI_DIM_SEQUENCE 打散。
 */
export const MULTI_RATINGS: MultiRating[] = (() => {
  const cursor: Record<MultiKey, number> = {
    linguistic: 0,
    logicalMath: 0,
    spatial: 0,
    musical: 0,
    bodily: 0,
    interpersonal: 0,
    intrapersonal: 0,
    naturalist: 0,
  };
  return MULTI_DIM_SEQUENCE.map((dim, i) => {
    const item = MULTI_BANK[dim][cursor[dim]++];
    return { no: i + 1, text: item.text, reverse: item.reverse ?? false, dim };
  });
})();

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * 多元智能计分。ratings[i]：第 i+1 题的圈选值（1-5）；长度须为 40。
 * - 反向题按 6 - 圈选值 换算；
 * - dims 为各维 5 题（换算后）的均分，保留 1 位小数；
 * - top3 按均分降序，并列时按 MULTI_DIM_ORDER 固定维序取先；
 * - summary 以「你」的口吻点出最强 1-2 维并给出学习方式建议。
 */
export function scoreMulti(ratings: number[]): MultiResult {
  if (ratings.length !== MULTI_RATINGS.length) {
    throw new Error(`多元智能评分题数量应为 ${MULTI_RATINGS.length}，实际 ${ratings.length}`);
  }
  const sums: Record<MultiKey, number> = {
    linguistic: 0,
    logicalMath: 0,
    spatial: 0,
    musical: 0,
    bodily: 0,
    interpersonal: 0,
    intrapersonal: 0,
    naturalist: 0,
  };
  ratings.forEach((raw, i) => {
    if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
      throw new Error(`第 ${i + 1} 题的评分应在 1-5 之间，实际 ${raw}`);
    }
    const q = MULTI_RATINGS[i];
    sums[q.dim] += q.reverse ? 6 - raw : raw;
  });
  const dims = MULTI_DIM_ORDER.reduce((acc, key) => {
    acc[key] = round1(sums[key] / 5);
    return acc;
  }, {} as Record<MultiKey, number>);

  const ranked = [...MULTI_DIM_ORDER].sort(
    (a, b) => dims[b] - dims[a] || MULTI_DIM_ORDER.indexOf(a) - MULTI_DIM_ORDER.indexOf(b),
  );
  const top3 = ranked.slice(0, 3);
  const [first, second] = top3;
  const tied = dims[first] === dims[second];

  const s1 = `你最突出的是「${MULTI_DIM_LABEL[first]}」：${MULTI_DIM_TRAIT[first]}。`;
  const s2 = tied
    ? `同时你的「${MULTI_DIM_LABEL[second]}」也很强：${MULTI_DIM_TRAIT[second]}。`
    : `比较突出的还有「${MULTI_DIM_LABEL[second]}」，可以搭配着发挥。`;
  const s3 = `学习建议：${MULTI_DIM_ADVICE[first]}${tied ? `；此外，${MULTI_DIM_ADVICE[second]}` : ""}。`;
  return { dims, top3, summary: s1 + s2 + s3 };
}
