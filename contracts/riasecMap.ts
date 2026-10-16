/**
 * v178 霍兰德六型 → 学科专业大类 / 核心能力映射（RIASEC 学科群经典划分）。
 * 三好生涯报告、升学指导报告、霍兰德报告的「六型学科地图」图共用。
 */
export type HollandFieldInfo = {
  /** 学科群简称（工/理/文/人/商/事）。 */
  track: string;
  /** 学科群全称。 */
  trackName: string;
  /** 对应的学科专业大类。 */
  fields: string[];
  /** 该型突出所需的核心能力。 */
  abilities: string[];
};

export const HOLLAND_FIELD_MAP: Record<string, HollandFieldInfo> = {
  R: {
    track: "工",
    trackName: "工科",
    fields: ["医药卫生", "农林渔牧", "工程", "信息"],
    abilities: ["操作能力", "机械能力", "计算能力", "科学能力", "抽象推理"],
  },
  I: {
    track: "理",
    trackName: "理科",
    fields: ["数理化", "生命科学", "地球与环境", "建筑设计"],
    abilities: ["科学能力", "操作能力", "空间关系", "抽象推理"],
  },
  A: {
    track: "文",
    trackName: "文科",
    fields: ["大众传播", "文史哲", "艺术设计"],
    abilities: ["艺术使用", "语文运用", "文艺创作", "文书写作"],
  },
  S: {
    track: "人",
    trackName: "人文社科",
    fields: ["教育", "社会心理", "公共服务"],
    abilities: ["语文运用", "助人能力", "亲和力"],
  },
  E: {
    track: "商",
    trackName: "商科",
    fields: ["管理", "法政", "财经", "市场营销"],
    abilities: ["领导能力", "销售能力", "文书确度", "组织能力"],
  },
  C: {
    track: "事",
    trackName: "事务",
    fields: ["财经", "行政文书", "数据统计"],
    abilities: ["计算能力", "组织能力", "文书确度"],
  },
};

/** 六型在六边形地图上的排列顺序（从左上顺时针：工→理→文→人→商→事）。 */
export const HOLLAND_MAP_ORDER = ["R", "I", "A", "S", "E", "C"] as const;
