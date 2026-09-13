/**
 * 测评详细报告内容契约。
 * 所有内容面向初中校园场景书写：课堂听讲、自习作业、考试、小组合作、师生相处、同伴交往。
 * 口吻：报告正文用「你」（直接对学生说，鼓励感）；仅综合报告末尾「给家长的话」用「孩子」。
 */

/** MBTI 16 型详细报告 */
export type MbtiTypeReport = {
  /** 四字母代码，如 "ISFJ" */
  type: string;
  /** 画像名，如 "温暖的守护者" */
  name: string;
  /** 性格亮点一句话，如 "生活在自己理想世界的哲学家型" */
  headline: string;
  /** 性格标签 4 个 */
  tags: string[];
  /** 代表人物与语录 */
  figure: { name: string; title: string; quote: string };
  /** 性格特征 6 条 */
  traits: string[];
  /** 性格优势 4-5 条（每条 2-4 句，较详细） */
  strengths: string[];
  /** 性格潜在弱点 4-5 条（每条 1-3 句） */
  weaknesses: string[];
  /** 在学习与校园生活中的优势 6-9 条（每条一句，具体场景化） */
  studyStrengths: string[];
  /** 在学习与校园生活中可能的盲点 6-10 条（每条一句） */
  studyBlindspots: string[];
  /** 校园五幕：课堂听讲 / 自习与作业 / 小组合作 / 考试前后 / 与老师相处，各 1 段（2-4 句） */
  scenes: { scene: string; text: string }[];
  /** 发展建议 3-5 条 */
  suggestions: string[];
};

/** DISC 四型详细报告（校园个性与行为模式） */
export type DiscTypeReport = {
  type: "D" | "I" | "S" | "C";
  /** 型名，如 "稳健支持型" */
  name: string;
  /** 一句话定位 */
  headline: string;
  /** 程度特征词 10 个 */
  keywords: string[];
  /** 基本情况解读（1 段，4-6 句）：主导型的典型行为特征，校园化表达 */
  overview: string;
  /** 校园五幕：课堂上的你 / 写作业时的你 / 考场上的你 / 同学眼中的你 / 与老师相处，各 1 段（2-4 句） */
  scenes: { scene: string; text: string }[];
  /** 压力下的你（1 段，3-5 句）：压力下的变化、可能状态与信号 */
  underPressure: string;
  /** 可能阻碍你发展的行为 5-6 条 */
  obstacles: string[];
  /** 你需要的支持 6-7 条（家长/老师可给的具体支持） */
  supports: string[];
  /** 你最喜欢的老师风格（1 段） */
  teacherFit: string;
  /** 大家这样与你相处最有效 4-5 条 */
  communicationTips: string[];
};

/** DISC 通用科普（四个类型因子说明，报告中"测评介绍"板块用） */
export type DiscTheoryItem = { type: "D" | "I" | "S" | "C"; name: string; text: string };

/** 报告分级口径（V3.7）：≥3.8 正常（绿）/ ≥3.0 待提升（黄）/ <3.0 卡点（红）。 */
export type CombinedLevel = "正常" | "待提升" | "卡点";

/** 顶部概览卡；tone 为红黄绿着色（red=卡点/预警，amber=待提升/关注，green=正常）。 */
export type CombinedOverviewCard = {
  label: string;
  value: string;
  note: string;
  tone?: "red" | "amber" | "green";
};

/** 综合报告的章节结构（buildCombinedReport 返回值） */
export type CombinedSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  /** 九能逐条解读等特殊块 */
  items?: { heading: string; text: string; level?: CombinedLevel; big?: boolean }[];
  /** 「详细报告文字」折叠专属条款（V33.2）：items 留在可见区时，折叠内改放这里的详版内容（介绍+数据分析+详细建议），末尾再接答题明细。 */
  detailItems?: { heading: string; text: string; level?: CombinedLevel; big?: boolean }[];
  /** 章末收尾总论段（渲染在所有表格/条款之后，如「综合结论」章的概要总论收尾）。 */
  closing?: string[];
  /** 强制条款卡在可见区直接展示（默认：有结论段时条款收进「详细报告文字」折叠）。 */
  itemsVisible?: boolean;
};

export type CombinedReport = {
  title: string;
  subtitle: string;
  overviewCards: CombinedOverviewCard[];
  sections: CombinedSection[];
};
