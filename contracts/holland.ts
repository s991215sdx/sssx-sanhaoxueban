/**
 * 霍兰德职业兴趣测评（Holland SDS 思路）题库、计分器与报告文案生成。
 *
 * 理论依据：霍兰德（John L. Holland）职业兴趣理论将人的职业兴趣分为
 * 六种类型——现实型 R、研究型 I、艺术型 A、社会型 S、企业型 E、常规型 C；
 * 六型在六边形模型中存在相邻（相似）、相隔（中性）、相对（差异最大）
 * 的关系，兴趣代码取得分最高的前三型字母（如 SEI）。
 *
 * 本量表面向中学生改写：题干均为中学生可理解的「活动偏好」描述，
 * Likert 5 级自评（1=完全不喜欢 … 5=非常喜欢），每型 6 题聚合求均分。
 * 测评结果为兴趣倾向的参考，而非职业方向的定论。
 *
 * 前后端共享：纯类型、纯数据、纯函数，不依赖服务端或 React。
 */

export type HollandKey = "R" | "I" | "A" | "S" | "E" | "C";

/** 固定型序（并列排序、结果展示均以此为基准顺序）。 */
export const HOLLAND_ORDER: HollandKey[] = ["R", "I", "A", "S", "E", "C"];

/** 各型中文名。 */
export const HOLLAND_LABEL: Record<HollandKey, string> = {
  R: "现实型",
  I: "研究型",
  A: "艺术型",
  S: "社会型",
  E: "企业型",
  C: "常规型",
};

/** 各型个性关键词（组合 top3 生成整体关键词）。 */
export const HOLLAND_KEYWORDS: Record<HollandKey, string> = {
  R: "务实 · 动手 · 坚毅",
  I: "好奇 · 理性 · 钻研",
  A: "创意 · 表达 · 敏感",
  S: "热心 · 亲和 · 合作",
  E: "果断 · 自信 · 领导",
  C: "细致 · 严谨 · 可靠",
};

export type HollandRating = {
  no: number;
  text: string;
  key: HollandKey;
};

export type HollandResult = {
  /** 每型均分，保留 1 位小数，范围 1-5。 */
  dims: Record<HollandKey, number>;
  /** 均分最高的前三型（并列按 HOLLAND_ORDER 固定型序）。 */
  top3: HollandKey[];
  /** 职业兴趣代码：前三型字母（如 SEI）。 */
  code: string;
  /** 个性关键词（由 top3 各型关键词组合）。 */
  keywords: string;
  summary: string;
};

/* 每型 6 题：中学生可理解的活动偏好描述。 */
const HOLLAND_BANK: Record<HollandKey, string[]> = {
  R: [
    "拆装、修理小物件（自行车、玩具、小电器）",
    "做手工、拼模型或搭乐高",
    "参加户外运动或体力类活动",
    "在实验室动手做操作类实验",
    "种植花草、饲养小动物",
    "使用工具完成一件看得见的实物作品",
  ],
  I: [
    "琢磨「为什么」：追问现象背后的原理",
    "读科普书、看科学纪录片",
    "做数学题或推理、解谜类游戏",
    "自己设计一个小实验验证想法",
    "研究星座、地图、数据表格里的规律",
    "查资料把一个好奇的问题搞个水落石出",
  ],
  A: [
    "画画、做手账或设计海报",
    "写故事、诗歌或歌词",
    "唱歌、演奏乐器或参加文艺表演",
    "拍照片、剪视频，把生活做出美感",
    "布置房间或搭配服装，做出自己的风格",
    "欣赏画展、音乐剧或设计类展览",
  ],
  S: [
    "给同学讲题，帮别人解决学习困难",
    "组织或参与班级、社团的服务活动",
    "倾听朋友的烦恼并安慰、出主意",
    "认识新朋友，和不同的人聊天",
    "参加志愿者、公益活动",
    "在小组合作中照顾每个人的感受",
  ],
  E: [
    "在班级活动中负责组织和拍板",
    "说服别人接受自己的一个想法",
    "参加竞选、演讲或辩论",
    "尝试小生意或跳蚤市场摆摊",
    "带领小组完成一个有挑战的任务",
    "关注商业新闻、创业故事",
  ],
  C: [
    "把书桌、书包整理得井井有条",
    "核对账单、统计数字并做到分毫不差",
    "按清单和流程一步步完成任务",
    "做表格、记台账，把信息整理清楚",
    "整理错题本并保持格式工整",
    "完成需要耐心和精确度的重复性任务",
  ],
};

/** 霍兰德题库：36 道 Likert 题，每型 6 题，按型分组排列。 */
export const HOLLAND_RATINGS: HollandRating[] = HOLLAND_ORDER.flatMap((key) =>
  HOLLAND_BANK[key].map((text) => ({ key, text })),
).map((q, i) => ({ no: i + 1, ...q }));

/** 每型题数。 */
export const HOLLAND_PER_DIM = 6;

/* ---------------- 计分 ---------------- */

/**
 * 霍兰德计分。ratings[i]：第 i+1 题自评分（1-5）；长度须为 36。
 * 每型均分保留 1 位小数；top3 为均分最高的三型（并列按 HOLLAND_ORDER
 * 固定型序）；code 为前三型字母；keywords 由 top3 各型关键词组合。
 */
export function scoreHolland(ratings: number[]): HollandResult {
  if (ratings.length !== HOLLAND_RATINGS.length) {
    throw new Error(`霍兰德测评题数应为 ${HOLLAND_RATINGS.length}，实际 ${ratings.length}`);
  }
  const sum: Record<HollandKey, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const cnt: Record<HollandKey, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  ratings.forEach((raw, i) => {
    if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
      throw new Error(`第 ${i + 1} 题分值应为 1-5，实际 ${raw}`);
    }
    const k = HOLLAND_RATINGS[i].key;
    sum[k] += raw;
    cnt[k] += 1;
  });
  const dims = Object.fromEntries(
    HOLLAND_ORDER.map((k) => [k, Math.round((sum[k] / cnt[k]) * 10) / 10]),
  ) as Record<HollandKey, number>;
  const top3 = [...HOLLAND_ORDER]
    .sort((a, b) => dims[b] - dims[a] || HOLLAND_ORDER.indexOf(a) - HOLLAND_ORDER.indexOf(b))
    .slice(0, 3);
  const code = top3.join("");
  const keywords = top3.map((k) => HOLLAND_KEYWORDS[k]).join("；");
  const summary =
    `你的职业兴趣代码是「${code}」——${top3.map((k) => HOLLAND_LABEL[k]).join("、")}的组合。` +
    "兴趣代码不是给你定型，而是告诉你：靠近这些类型的活动和学科，你更容易「学得进去、做得长久」。";
  return { dims, top3, code, keywords, summary };
}

/* ---------------- 报告内容 ---------------- */

type HollandContent = {
  /** 兴趣画像。 */
  trait: string;
  /** 该兴趣类型对学习的影响与学科关联。 */
  studyImpact: string[];
  /** 匹配职业方向（4-6 个）。 */
  careers: string[];
  /** 对应大学专业举例（3-6 个）。 */
  majors: string[];
};

const HOLLAND_CONTENT: Record<HollandKey, HollandContent> = {
  R: {
    trait:
      "你是「动手实干派」：喜欢看得见摸得着的成果，动手做一遍胜过听讲十遍。你耐得住性子、脚踏实地，工具和实物在你手里特别听话。",
    studyImpact: [
      "理科学习多动手：实验、画图、摆模型，把抽象知识变成「可操作的东西」",
      "生物、地理等科目用实物和观察来学：标本、地图、实验记录都是你的好帮手",
      "背书坐不住时，边写边画边摆弄——身体参与进来的记忆对你最有效",
    ],
    careers: ["机械/工程技术人员", "建筑与工程", "农业与园艺技术", "航空/设备技师", "运动与康复训练"],
    majors: ["机械工程", "土木工程", "电气工程", "车辆工程", "农学"],
  },
  I: {
    trait:
      "你是「好奇钻研派」：对世界的「为什么」充满兴趣，喜欢观察、推理和验证，把一个问题想透是你最享受的时刻。",
    studyImpact: [
      "数学、物理、化学是你的主场：多问「这一步为什么成立」，追根究底正是你的优势",
      "预习时先读原理和推导，再用例题验证——「先懂再用」的顺序最适合你",
      "给自己留一个「自由研究时间」：每周查一个好奇的问题，保持求知欲的火苗",
    ],
    careers: ["科研工作者", "医生", "程序员/算法工程师", "数据分析师", "药剂师/检验师"],
    majors: ["数学", "物理学", "计算机科学与技术", "临床医学", "生物科学"],
  },
  A: {
    trait:
      "你是「创意表达派」：对美和表达敏感，点子多、感受力强，喜欢用文字、图像、声音把内心世界做出来给人看。",
    studyImpact: [
      "语文、英语、艺术学科是你的能量场：作文、演讲、配音，表达欲就是你的学习力",
      "给理科知识「做包装」：画知识海报、编口诀歌，创作过程会帮你记得更牢",
      "用审美驱动细节：漂亮的笔记、整洁的版面不是形式主义，是你进入状态的仪式感",
    ],
    careers: ["设计师（平面/产品/服装）", "作家/编辑", "音乐人与表演者", "影视与短视频创作", "建筑设计师"],
    majors: ["视觉传达设计", "汉语言文学", "音乐学", "建筑学", "数字媒体艺术"],
  },
  S: {
    trait:
      "你是「热心合作派」：喜欢和人打交道，善于理解和帮助别人，在合作与分享中你最有能量，也最被信任。",
    studyImpact: [
      "讲题给别人听是你最高效的复习：把同学讲懂的那一刻，你自己才真正学透",
      "参加学习小组、结对打卡：有人同行的学习路，你走得又快又稳",
      "语文、英语、政治历史等人文科目借「共情」来学：代入人物和情境，理解自然变深",
    ],
    careers: ["教师/教育工作者", "心理咨询师", "社会工作者", "护士/健康服务", "人力资源"],
    majors: ["教育学", "心理学", "社会工作", "护理学", "学前教育"],
  },
  E: {
    trait:
      "你是「目标领导派」：有主见、敢表达、喜欢影响和带动别人，定下一个目标然后调动一切资源拿下它，是你的拿手好戏。",
    studyImpact: [
      "把学习目标「当众说出来」：公开承诺会点燃你的好胜心和行动力",
      "在小组里认领组织角色：分配任务、盯进度，领导别人会倒逼你自己先做到",
      "辩论、演讲、竞选类活动多参加：这些舞台既是你的兴趣，也在悄悄练你的表达与逻辑",
    ],
    careers: ["创业者/企业管理者", "市场营销", "律师", "项目经理", "媒体与公关"],
    majors: ["工商管理", "市场营销", "法学", "金融学", "公共管理"],
  },
  C: {
    trait:
      "你是「严谨细致派」：喜欢清晰、有序、精确，清单、表格和流程是你的朋友，交给你的事总能按时按质地完成。",
    studyImpact: [
      "用清单和表格管理学习：任务打勾、进度可视化，会给你稳稳的掌控感",
      "错题本、笔记保持工整格式：你的复习资料质量常常是全班的标杆",
      "考试中的「细节分」是你的金矿：审题、计算、书写的严谨，能让你稳定多拿分",
    ],
    careers: ["会计师/审计师", "银行与金融职员", "行政与档案管理", "统计与数据处理", "图书与信息管理"],
    majors: ["会计学", "审计学", "财务管理", "信息管理与信息系统", "统计学"],
  },
};

/** 六型详细分析条目。 */
export type HollandDimReport = {
  key: HollandKey;
  label: string;
  /** 兴趣画像。 */
  trait: string;
  /** 该型均分。 */
  score: number;
  studyImpact: string[];
  careers: string[];
  majors: string[];
  /** 是否属于 top3。 */
  isTop: boolean;
};

export type HollandReport = {
  code: string;
  keywords: string;
  /** 相邻/相隔/相对关系说明。 */
  relationNote: string;
  dims: HollandDimReport[];
  /** top3 重点解读。 */
  top3: { key: HollandKey; label: string; score: number; focus: string }[];
};

/** top3 各型的重点解读（兴趣代码中的位置含义）。 */
const TOP_FOCUS: Record<HollandKey, string> = {
  R: "动手与实做是你学习的「最佳入口」——所有科目都尽量给它配一个可操作、可动手的环节，你会学得又稳又扎实。",
  I: "「搞懂原理」是你学习的发动机——允许自己多问为什么，追根究底的习惯会把你带向真正有区分度的高度。",
  A: "创造力是你学习的调色盘——给知识加上你自己的表达和包装，你会惊喜地发现自己记得又快又牢。",
  S: "「与人同行」是你学习的加速器——讲题、讨论、结伴打卡，别人眼中的热心肠，其实是你最聪明的学习策略。",
  E: "目标感和舞台感是你的燃料——把学习变成一场自己领衔的战役，你的行动力会让所有人刮目相看。",
  C: "秩序感是你学习的底盘——清单、错题本、工整的笔记，这些你天然擅长的习惯，正是成绩稳定的关键。",
};

/**
 * 生成霍兰德报告：六型得分与详细分析（兴趣画像 / 对学习的影响 /
 * 匹配职业方向 / 大学专业举例）+ top3 重点解读 + 相邻/相隔/相对关系说明。
 */
export function buildHollandReport(result: HollandResult): HollandReport {
  const dims = HOLLAND_ORDER.map((key) => {
    const c = HOLLAND_CONTENT[key];
    return {
      key,
      label: HOLLAND_LABEL[key],
      trait: c.trait,
      score: result.dims[key],
      studyImpact: c.studyImpact,
      careers: c.careers,
      majors: c.majors,
      isTop: result.top3.includes(key),
    };
  });
  const top3 = result.top3.map((key) => ({
    key,
    label: HOLLAND_LABEL[key],
    score: result.dims[key],
    focus: TOP_FOCUS[key],
  }));
  const relationNote =
    "霍兰德六型在六边形模型中存在「相邻、相隔、相对」三种关系：相邻的两型（如 S 与 E、I 与 A）相似度高，常一起出现；相隔为中性；相对的两型（如 R 与 S、I 与 E、A 与 C）差异最大，若同时得分高，说明你兴趣面很宽。你的代码「" +
    result.code +
    "」越靠前的字母，代表与你越契合的方向。";
  return { code: result.code, keywords: result.keywords, relationNote, dims, top3 };
}
