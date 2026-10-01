/**
 * 学科能力测评（V78）：9 科 × 听懂/记住/运用(+特定) 学习环节自评量表。
 * 题库转写自《学科能力测评自评表（打印版）》，每题 1-5 级自评；
 * 计分口径同《汇总总览》：环节均分 → 综合均分 → 4.5/3.5/2.5 定级。
 * 前后端共享：纯类型、纯数据、纯函数。
 */

export const SUBJECT_ORDER = ["语文","数学","英语","物理","化学","生物","历史","政治","地理"] as const;
export type SubjectName = (typeof SUBJECT_ORDER)[number];

export const SUBJECT_STAGE_ORDER = ["听懂","记住","运用","特定"] as const;
export type SubjectStage = (typeof SUBJECT_STAGE_ORDER)[number];

export const SUBJECT_STAGE_LABEL: Record<SubjectStage, string> = {
  听懂: "听懂 · 课堂输入",
  记住: "记住 · 复习巩固",
  运用: "运用 · 练习输出",
  特定: "学科特定规划",
};

export type SubjectItem = {
  stage: SubjectStage;
  /** 学习行为（如 预习 / 听课 / 复习·记忆积累）。 */
  behavior: string;
  /** 学科任务明细。 */
  task: string;
  /** 能力目标（自评测评点，题面）。 */
  point: string;
  /** 目标阶段 1-3 阶。 */
  level: 1 | 2 | 3;
};

export const SUBJECT_BANK: Record<SubjectName, SubjectItem[]> = {
  语文: [
    { stage: "听懂", behavior: "预习", task: "古诗文", point: "尝试通读全文，并校准字音 根据书下注释大致理解文章意思", level: 1 },
    { stage: "听懂", behavior: "预习", task: "古诗文", point: "尝试理解诗词写作背景和作者的一贯写作风格", level: 3 },
    { stage: "听懂", behavior: "预习", task: "现代文", point: "尝试通读全文，并校准字音、字形 深刻体会文章大意，分析、概括、表述文章内容", level: 1 },
    { stage: "听懂", behavior: "听课", task: "专注不走神", point: "上课全程专注、紧跟老师思路，偶尔走神能马上自我提醒拉回来", level: 1 },
    { stage: "听懂", behavior: "听课", task: "课堂互动", point: "主动举手回答老师提问，积极参与课堂讨论，每周课堂发言不少于 2 次", level: 2 },
    { stage: "听懂", behavior: "听课", task: "高效记笔记", point: "笔记抓知识框架和关键词，重点记书上没有的内容，不照抄板书和课本", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每节课记录疑问点，当天弄懂或标记后请教老师", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每周主动向老师或同学提问不少于 3 次，提问有记录、有跟进落实", level: 3 },
    { stage: "记住", behavior: "复习·思维导图", task: "思维导图整理", point: "每学完一个单元，画 1 张思维导图梳理知识结构，标注薄弱环节", level: 2 },
    { stage: "记住", behavior: "复习·回忆", task: "清晰课上知识内容", point: "能够逻辑完整、思路清晰地讲解当天课上的所有内容", level: 2 },
    { stage: "记住", behavior: "复习·回归不懂的知识点", task: "回归薄弱知识点", point: "每周汇总提问与错题中暴露的薄弱知识点，回归课本和笔记重新学习，并做二次自测确认掌握", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "古诗文背诵", point: "能够熟读全文，能够默写全文或重点背诵部分", level: 1 },
    { stage: "记住", behavior: "复习·记忆积累", task: "古诗文背诵", point: "能够完全掌握需要背诵篇目的全文翻译", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "文言实词积累", point: "能够把所有做过的文言文阅读整理起来，对重点句子的翻译做积累", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "文言实词积累", point: "能够把中学段课本上的所有古诗文的书下注释完全积累背诵", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "现代文阅读答题模板", point: "熟悉现代文阅读主观题答题模板、套路", level: 2 },
    { stage: "记住", behavior: "复习·记忆积累", task: "成语病句等语言基础积累", point: "能够打好语言文字基础，对于类似成语、病句、扩写、仿写等题目类型做好知识积累，保证题目准确率", level: 2 },
    { stage: "记住", behavior: "复习·记忆积累", task: "定期积累作文素材", point: "每次月考、期中期末考的作文都能认真对待，不糊弄，考试后，每篇考场作文都要查阅资料，对比借鉴范文、同学好文反复修改三次以上", level: 3 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够及时高效的完成作业", level: 1 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够对不会的内容做好标记", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题整理", point: "每周整理错题，标注错误原因、涉及知识点与正确解题思路", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题重练", point: "每周重做本周及上周错题，同类题重做正确率达到 90% 以上", level: 3 },
    { stage: "运用", behavior: "考试·试卷分析", task: "试卷分析", point: "每次考试后 3 天内完成试卷分析，对错题进行归类归因", level: 2 },
    { stage: "运用", behavior: "考试·试卷分析", task: "考后改进", point: "根据试卷分析制定下一阶段针对性练习计划，并在下次考试中验证改进效果", level: 3 },
  ],
  数学: [
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "精读教材，尝试理解定义概念、定理推论、公式等内容。", level: 1 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "自主完成课后习题", level: 1 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "能够对不懂的地方做好标记", level: 1 },
    { stage: "听懂", behavior: "听课", task: "专注不走神", point: "上课全程专注、紧跟老师思路，偶尔走神能马上自我提醒拉回来", level: 1 },
    { stage: "听懂", behavior: "听课", task: "课堂互动", point: "主动举手回答老师提问，积极参与课堂讨论，每周课堂发言不少于 2 次", level: 2 },
    { stage: "听懂", behavior: "听课", task: "高效记笔记", point: "笔记抓知识框架和关键词，重点记书上没有的内容，不照抄板书和课本", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每节课记录疑问点，当天弄懂或标记后请教老师", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每周主动向老师或同学提问不少于 3 次，提问有记录、有跟进落实", level: 3 },
    { stage: "记住", behavior: "复习·思维导图", task: "思维导图整理", point: "每学完一个单元，画 1 张思维导图梳理知识结构，标注薄弱环节", level: 2 },
    { stage: "记住", behavior: "复习·回忆", task: "清晰课上知识内容", point: "能够逻辑完整、思路清晰地讲解当天课上的所有内容", level: 2 },
    { stage: "记住", behavior: "复习·回归不懂的知识点", task: "漏洞复盘", point: "每周进行一次学科周总结，反思是否存在知识漏洞，并找到解决办法，能够做到知识周周清，无遗留", level: 3 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够及时高效的完成作业", level: 1 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够对不会的内容做好标记", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题回顾", point: "能够每周进行一次错题回顾，重做本周及之前的错题，避免遗忘，提高熟练度，保证同类型的题目下次遇到不在犯错", level: 3 },
    { stage: "运用", behavior: "考试·试卷分析", task: "试卷分析", point: "每次考试后 3 天内完成试卷分析：失分按\"知识漏洞、审题失误、计算失误、时间不足\"分类统计", level: 2 },
    { stage: "运用", behavior: "考试·试卷分析", task: "考后改进", point: "根据试卷分析制定下一阶段针对性练习计划，并在下次考试中验证改进效果", level: 3 },
  ],
  英语: [
    { stage: "听懂", behavior: "预习", task: "课前自主预习", point: "提前通读教材，标记不理解的概念与问题，带着问题去听课", level: 1 },
    { stage: "听懂", behavior: "预习", task: "课前自主预习", point: "每周完成预习不少于 3 次，完成教材配套预习思考题", level: 2 },
    { stage: "听懂", behavior: "听课", task: "专注不走神", point: "上课全程专注、紧跟老师思路，偶尔走神能马上自我提醒拉回来", level: 1 },
    { stage: "听懂", behavior: "听课", task: "课堂互动", point: "主动举手回答老师提问，积极参与课堂讨论，每周课堂发言不少于 2 次", level: 2 },
    { stage: "听懂", behavior: "听课", task: "高效记笔记", point: "笔记抓知识框架和关键词，重点记书上没有的内容，不照抄板书和课本", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每周主动向老师或同学提问不少于 3 次，提问有记录、有跟进落实", level: 3 },
    { stage: "记住", behavior: "复习·思维导图", task: "思维导图整理", point: "每学完一个单元，画 1 张思维导图梳理知识结构，标注薄弱环节", level: 2 },
    { stage: "记住", behavior: "复习·回忆", task: "独立回忆", point: "课后当天合上书独立回忆所学内容，能复述 80% 以上核心知识点，回忆不出的及时回归课本", level: 2 },
    { stage: "记住", behavior: "复习·回归不懂的知识点", task: "回归薄弱知识点", point: "每周汇总提问与错题中暴露的薄弱知识点，回归课本和笔记重新学习，并做二次自测确认掌握", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "课标词汇", point: "能够有计划的进行英文单词背诵，高一要达到3000词的水平", level: 1 },
    { stage: "记住", behavior: "复习·记忆积累", task: "阅读完型高频词汇", point: "能够有计划的对整理的阅读、完型高频词汇进行背诵", level: 3 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够及时高效的完成作业", level: 1 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够对不会的内容做好标记", level: 1 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题整理", point: "每周整理错题，标注错误原因、涉及知识点与正确解题思路", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题重练", point: "每周重做本周及上周错题，同类题重做正确率达到 90% 以上", level: 3 },
    { stage: "运用", behavior: "考试·试卷分析", task: "试卷分析", point: "每次考试后 3 天内完成试卷分析：失分按\"知识漏洞、审题失误、计算失误、时间不足\"分类统计", level: 2 },
    { stage: "运用", behavior: "考试·试卷分析", task: "考后改进", point: "根据试卷分析制定下一阶段针对性练习计划，并在下次考试中验证改进效果", level: 3 },
    { stage: "特定", behavior: "翻译练习", task: "课文英译汉", point: "能够主动把英语课文翻译成中文，锻炼阅读翻译能力", level: 3 },
    { stage: "特定", behavior: "翻译练习", task: "课文汉译英", point: "能够主动把中文翻译二次译回英文，锻炼写作运用能力", level: 3 },
    { stage: "特定", behavior: "坚持训练", task: "每日一练", point: "每天一次组合练习35min（阅读+完型+七选五+短文填空）", level: 2 },
    { stage: "特定", behavior: "坚持训练", task: "口语练习", point: "每天读书一篇课内文章10min", level: 1 },
    { stage: "特定", behavior: "坚持训练", task: "听力练习", point: "每周听力原版英文音频须达到60min", level: 2 },
    { stage: "特定", behavior: "坚持训练", task: "听力练习", point: "听力同时能够尝试跟读模仿", level: 2 },
    { stage: "特定", behavior: "写作能力提升", task: "作文好句积累", point: "能够每周积累一句作文好句", level: 2 },
    { stage: "特定", behavior: "写作能力提升", task: "作文练习", point: "每周完成一篇英语作文练习", level: 2 },
  ],
  物理: [
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "精读教材，尝试理解定义概念、定理推论、公式等内容。", level: 1 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "自主完成课后习题", level: 1 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "能够对不懂的地方做好标记", level: 1 },
    { stage: "听懂", behavior: "听课", task: "专注不走神", point: "上课全程专注、紧跟老师思路，偶尔走神能马上自我提醒拉回来", level: 1 },
    { stage: "听懂", behavior: "听课", task: "课堂互动", point: "主动举手回答老师提问，积极参与课堂讨论，每周课堂发言不少于 2 次", level: 2 },
    { stage: "听懂", behavior: "听课", task: "高效记笔记", point: "笔记抓知识框架和关键词，重点记书上没有的内容，不照抄板书和课本", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每节课记录疑问点，当天弄懂或标记后请教老师", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每周主动向老师或同学提问不少于 3 次，提问有记录、有跟进落实", level: 3 },
    { stage: "记住", behavior: "复习·思维导图", task: "思维导图整理", point: "每学完一个单元，画 1 张思维导图梳理知识结构，标注薄弱环节", level: 2 },
    { stage: "记住", behavior: "复习·回忆", task: "清晰课上知识内容", point: "能够逻辑完整、思路清晰地讲解当天课上的所有内容", level: 2 },
    { stage: "记住", behavior: "复习·回归不懂的知识点", task: "漏洞复盘", point: "每周进行一次学科周总结，反思是否存在知识漏洞，并找到解决办法，能够做到知识周周清，无遗留", level: 3 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够及时高效的完成作业", level: 1 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够对不会的内容做好标记", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题回顾", point: "能够每周进行一次错题回顾，重做本周及之前的错题，避免遗忘，提高熟练度，保证同类型的题目下次遇到不在犯错", level: 3 },
    { stage: "运用", behavior: "考试·试卷分析", task: "试卷分析", point: "每次考试后 3 天内完成试卷分析：失分按\"知识漏洞、审题失误、计算失误、时间不足\"分类统计", level: 2 },
    { stage: "运用", behavior: "考试·试卷分析", task: "考后改进", point: "根据试卷分析制定下一阶段针对性练习计划，并在下次考试中验证改进效果", level: 3 },
  ],
  化学: [
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "精读教材，尝试理解定义概念、实验步骤、化学方程式等内容。", level: 1 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "自主完成课后习题", level: 1 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "能够对不懂的地方做好标记", level: 1 },
    { stage: "听懂", behavior: "听课", task: "专注不走神", point: "上课全程专注、紧跟老师思路，偶尔走神能马上自我提醒拉回来", level: 1 },
    { stage: "听懂", behavior: "听课", task: "课堂互动", point: "主动举手回答老师提问，积极参与课堂讨论，每周课堂发言不少于 2 次", level: 2 },
    { stage: "听懂", behavior: "听课", task: "高效记笔记", point: "笔记抓知识框架和关键词，重点记书上没有的内容，不照抄板书和课本", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每节课记录疑问点，当天弄懂或标记后请教老师", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每周主动向老师或同学提问不少于 3 次，提问有记录、有跟进落实", level: 3 },
    { stage: "记住", behavior: "复习·思维导图", task: "思维导图整理", point: "每学完一个单元，画 1 张思维导图梳理知识结构，标注薄弱环节", level: 2 },
    { stage: "记住", behavior: "复习·回忆", task: "清晰课上知识内容", point: "能够逻辑完整、思路清晰地讲解当天课上的所有内容", level: 2 },
    { stage: "记住", behavior: "复习·回归不懂的知识点", task: "漏洞复盘", point: "每周进行一次学科周总结，反思是否存在知识漏洞，并找到解决办法，能够做到知识周周清，无遗留", level: 3 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够及时高效的完成作业", level: 1 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够对不会的内容做好标记", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题回顾", point: "能够每周进行一次错题回顾，重做本周及之前的错题，避免遗忘，提高熟练度，保证同类型的题目下次遇到不在犯错", level: 3 },
    { stage: "运用", behavior: "考试·试卷分析", task: "试卷分析", point: "每次考试后 3 天内完成试卷分析：失分按\"知识漏洞、审题失误、计算失误、时间不足\"分类统计", level: 2 },
    { stage: "运用", behavior: "考试·试卷分析", task: "考后改进", point: "根据试卷分析制定下一阶段针对性练习计划，并在下次考试中验证改进效果", level: 3 },
  ],
  生物: [
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "精读教材，尝试理解定义概念、例题、反应过程等内容", level: 1 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "自主完成课后习题", level: 1 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "能够对不懂的地方做好标记", level: 1 },
    { stage: "听懂", behavior: "听课", task: "专注不走神", point: "上课全程专注、紧跟老师思路，偶尔走神能马上自我提醒拉回来", level: 1 },
    { stage: "听懂", behavior: "听课", task: "课堂互动", point: "主动举手回答老师提问，积极参与课堂讨论，每周课堂发言不少于 2 次", level: 2 },
    { stage: "听懂", behavior: "听课", task: "高效记笔记", point: "笔记抓知识框架和关键词，重点记书上没有的内容，不照抄板书和课本", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每节课记录疑问点，当天弄懂或标记后请教老师", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每周主动向老师或同学提问不少于 3 次，提问有记录、有跟进落实", level: 3 },
    { stage: "记住", behavior: "复习·思维导图", task: "思维导图整理", point: "每学完一个单元，画 1 张思维导图梳理知识结构，标注薄弱环节", level: 2 },
    { stage: "记住", behavior: "复习·回忆", task: "清晰课上知识内容", point: "能够逻辑完整、思路清晰地讲解当天课上的所有内容", level: 2 },
    { stage: "记住", behavior: "复习·回归不懂的知识点", task: "漏洞复盘", point: "每周进行一次学科周总结，反思是否存在知识漏洞，并找到解决办法，能够做到知识周周清，无遗留", level: 3 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够及时高效的完成作业", level: 1 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够对不会的内容做好标记", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题回顾", point: "能够每周进行一次错题回顾，重做本周及之前的错题，避免遗忘，提高熟练度，保证同类型的题目下次遇到不在犯错", level: 3 },
    { stage: "运用", behavior: "考试·试卷分析", task: "试卷分析", point: "每次考试后 3 天内完成试卷分析：失分按\"知识漏洞、审题失误、计算失误、时间不足\"分类统计", level: 2 },
    { stage: "运用", behavior: "考试·试卷分析", task: "考后改进", point: "根据试卷分析制定下一阶段针对性练习计划，并在下次考试中验证改进效果", level: 3 },
  ],
  历史: [
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "精读教材，尝试理解并总结历史史实的起因、影响等内容", level: 1 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "能够对史实之间的关联性和差异性进行比较思考", level: 2 },
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "能够勤于思考，尝试提出预习问题，如“布尔什维克发动十月革命，建立苏维埃政权”中什么是布尔什维克？苏维埃是什么？为什么苏维埃暗含着巴黎公社式的政权形式？为什么有人认为巴黎公社是无政府主义？等", level: 3 },
    { stage: "听懂", behavior: "听课", task: "专注不走神", point: "上课全程专注、紧跟老师思路，偶尔走神能马上自我提醒拉回来", level: 1 },
    { stage: "听懂", behavior: "听课", task: "课堂互动", point: "主动举手回答老师提问，积极参与课堂讨论，每周课堂发言不少于 2 次", level: 2 },
    { stage: "听懂", behavior: "听课", task: "高效记笔记", point: "笔记抓知识框架和关键词，重点记书上没有的内容，不照抄板书和课本", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每节课记录疑问点，当天弄懂或标记后请教老师", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每周主动向老师或同学提问不少于 3 次，提问有记录、有跟进落实", level: 3 },
    { stage: "记住", behavior: "复习·思维导图", task: "思维导图整理", point: "每学完一个单元，画 1 张思维导图梳理知识结构，标注薄弱环节", level: 2 },
    { stage: "记住", behavior: "复习·回忆", task: "清晰课上知识内容", point: "能够逻辑完整、思路清晰地讲解当天课上的所有内容", level: 1 },
    { stage: "记住", behavior: "复习·回归不懂的知识点", task: "漏洞复盘", point: "每周进行一次学科周总结，反思是否存在知识漏洞，并找到解决办法，能够做到知识周周清，无遗留", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "历史史实记忆", point: "能够及时背诵相关知识点，并有计划、有节奏的复习", level: 1 },
    { stage: "记住", behavior: "复习·记忆积累", task: "规范答题话术", point: "能够规范使用标准的历史学答题话术", level: 2 },
    { stage: "记住", behavior: "复习·记忆积累", task: "历史素养提升", point: "能够每周坚持抽出时间阅读历史书籍、观看历史学纪录片", level: 3 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够及时高效的完成作业", level: 1 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够对不会的内容做好标记", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题回顾", point: "能够每周进行一次错题回顾，重做本周及之前的错题，避免遗忘，提高熟练度，保证同类型的题目下次遇到不在犯错", level: 3 },
    { stage: "运用", behavior: "考试·试卷分析", task: "试卷分析", point: "每次考试后 3 天内完成试卷分析：失分按\"知识漏洞、审题失误、计算失误、时间不足\"分类统计", level: 2 },
    { stage: "运用", behavior: "考试·试卷分析", task: "考后改进", point: "根据试卷分析制定下一阶段针对性练习计划，并在下次考试中验证改进效果", level: 3 },
  ],
  政治: [
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "精读教材，尝试理解并总结课内讲解的知识内容", level: 1 },
    { stage: "听懂", behavior: "听课", task: "专注不走神", point: "上课全程专注、紧跟老师思路，偶尔走神能马上自我提醒拉回来", level: 1 },
    { stage: "听懂", behavior: "听课", task: "课堂互动", point: "主动举手回答老师提问，积极参与课堂讨论，每周课堂发言不少于 2 次", level: 2 },
    { stage: "听懂", behavior: "听课", task: "高效记笔记", point: "笔记抓知识框架和关键词，重点记书上没有的内容，不照抄板书和课本", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每节课记录疑问点，当天弄懂或标记后请教老师", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每周主动向老师或同学提问不少于 3 次，提问有记录、有跟进落实", level: 3 },
    { stage: "记住", behavior: "复习·思维导图", task: "思维导图整理", point: "每学完一个单元，画 1 张思维导图梳理知识结构，标注薄弱环节", level: 2 },
    { stage: "记住", behavior: "复习·回忆", task: "清晰课上知识内容", point: "能够逻辑完整、思路清晰地讲解当天课上的所有内容", level: 1 },
    { stage: "记住", behavior: "复习·回归不懂的知识点", task: "漏洞复盘", point: "每周进行一次学科周总结，反思是否存在知识漏洞，并找到解决办法，能够做到知识周周清，无遗留", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "知识点记忆", point: "能够及时背诵相关知识点，并有计划、有节奏的复习", level: 1 },
    { stage: "记住", behavior: "复习·记忆积累", task: "时事政治涉猎", point: "能够每周抽出一个小时关注国家大事，了解时事政治", level: 2 },
    { stage: "记住", behavior: "复习·记忆积累", task: "培养政治素养", point: "能够每周抽出一个小时观看央视新闻联播，学习标准政治话术，了解国家政治导向，体会国家政治手段", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "广泛涉猎知识", point: "能够每周抽出了解如哲学思想、宏观经济调控、货币发展史等相关知识，辅助政治学的学习", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "规范答题话术", point: "能够通过背诵主观题标准答案等方式，体会答题维度并规范标准的政治学答题话术", level: 2 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够及时高效的完成作业", level: 1 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够对不会的内容做好标记", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题回顾", point: "能够每周进行一次错题回顾，重做本周及之前的错题，避免遗忘，提高熟练度，保证同类型的题目下次遇到不在犯错", level: 3 },
    { stage: "运用", behavior: "考试·试卷分析", task: "试卷分析", point: "每次考试后 3 天内完成试卷分析：失分按\"知识漏洞、审题失误、计算失误、时间不足\"分类统计", level: 2 },
    { stage: "运用", behavior: "考试·试卷分析", task: "考后改进", point: "根据试卷分析制定下一阶段针对性练习计划，并在下次考试中验证改进效果", level: 3 },
  ],
  地理: [
    { stage: "听懂", behavior: "预习", task: "新课程预习", point: "精读教材，尝试理解并总结课内讲解的知识内容", level: 1 },
    { stage: "听懂", behavior: "听课", task: "专注不走神", point: "上课全程专注、紧跟老师思路，偶尔走神能马上自我提醒拉回来", level: 1 },
    { stage: "听懂", behavior: "听课", task: "课堂互动", point: "主动举手回答老师提问，积极参与课堂讨论，每周课堂发言不少于 2 次", level: 2 },
    { stage: "听懂", behavior: "听课", task: "高效记笔记", point: "笔记抓知识框架和关键词，重点记书上没有的内容，不照抄板书和课本", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每节课记录疑问点，当天弄懂或标记后请教老师", level: 2 },
    { stage: "听懂", behavior: "提问", task: "主动提问", point: "每周主动向老师或同学提问不少于 3 次，提问有记录、有跟进落实", level: 3 },
    { stage: "记住", behavior: "复习·思维导图", task: "思维导图整理", point: "每学完一个单元，画 1 张思维导图梳理知识结构，标注薄弱环节", level: 2 },
    { stage: "记住", behavior: "复习·回忆", task: "清晰课上知识内容", point: "能够逻辑完整、思路清晰地讲解当天课上的所有内容", level: 2 },
    { stage: "记住", behavior: "复习·回归不懂的知识点", task: "漏洞复盘", point: "每周进行一次学科周总结，反思是否存在知识漏洞，并找到解决办法，能够做到知识周周清，无遗留", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "知识点记忆", point: "能够及时背诵相关知识点，并有计划、有节奏的复习", level: 1 },
    { stage: "记住", behavior: "复习·记忆积累", task: "地图绘制", point: "能够把气压带风带、洋流等知识画在地图上，进行图像记忆", level: 1 },
    { stage: "记住", behavior: "复习·记忆积累", task: "培养地理素养", point: "能够抽出时间观看类似于《地理中国》等地理学纪录片，培养地理素养", level: 3 },
    { stage: "记住", behavior: "复习·记忆积累", task: "广泛涉猎题型", point: "能够在课内练习题目的基础上适当地，额外地见足够的新颖的题型，增长地理见识，树立多维度地理认知", level: 2 },
    { stage: "记住", behavior: "复习·记忆积累", task: "规范答题话术", point: "能够通过背诵主观题标准答案等方式，体会答题维度并规范标准的地理学答题话术", level: 2 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够及时高效的完成作业", level: 1 },
    { stage: "运用", behavior: "练习·作业", task: "高效完整完成作业", point: "能够对不会的内容做好标记", level: 2 },
    { stage: "运用", behavior: "练习·错题整理", task: "错题回顾", point: "能够每周进行一次错题回顾，重做本周及之前的错题，避免遗忘，提高熟练度，保证同类型的题目下次遇到不在犯错", level: 3 },
    { stage: "运用", behavior: "考试·试卷分析", task: "试卷分析", point: "每次考试后 3 天内完成试卷分析：失分按\"知识漏洞、审题失误、计算失误、时间不足\"分类统计", level: 2 },
    { stage: "运用", behavior: "考试·试卷分析", task: "考后改进", point: "根据试卷分析制定下一阶段针对性练习计划，并在下次考试中验证改进效果", level: 3 },
  ],
};

/** 各科题量（答案数组长度校验用）。 */
export const SUBJECT_ITEM_COUNT: Record<SubjectName, number> = {
  语文: 24,
  数学: 16,
  英语: 25,
  物理: 16,
  化学: 16,
  生物: 16,
  历史: 19,
  政治: 19,
  地理: 19,
};


/* --------------------------------- 计分 --------------------------------- */

/** 作答：key=科目名，value=该科每题 1-5 分（长度须等于该科题量）。 */
export type SubjectAssessmentAnswers = Partial<Record<SubjectName, number[]>>;

export type SubjectStageScore = {
  stage: SubjectStage;
  /** 环节均分（1 位小数）。 */
  avg: number;
  /** 环节内题数。 */
  items: number;
  /** 该环节得分 ≤2 的测评点（薄弱环节提示，最多 3 条）。 */
  weakPoints: string[];
};

export type SubjectScore = {
  name: SubjectName;
  /** 该科实际包含的环节（按 SUBJECT_STAGE_ORDER 顺序，无「特定」的科目只有前三项）。 */
  stages: SubjectStageScore[];
  /** 综合均分（各环节均分的平均，1 位小数）。 */
  overall: number;
  /** 等级：≥4.5 优秀 / ≥3.5 良好 / ≥2.5 合格 / <2.5 待提升。 */
  grade: "优秀" | "良好" | "合格" | "待提升";
  strongest: SubjectStage;
  weakest: SubjectStage;
};

export type SubjectAssessmentResult = {
  /** 按作答顺序返回各科得分（至少 1 科）。 */
  subjects: SubjectScore[];
  /** 九科综合总均分（有几次算几次的当次口径：各科 overall 的平均）。 */
  totalAvg: number;
  /** 全部科目里最弱的三个环节（用于报告「冰山上」问题分析）。 */
  weakestStages: { subject: SubjectName; stage: SubjectStage; avg: number }[];
  summary: string;
};

export function subjectGrade(avg: number): SubjectAssessmentResult["subjects"][number]["grade"] {
  if (avg >= 4.5) return "优秀";
  if (avg >= 3.5) return "良好";
  if (avg >= 2.5) return "合格";
  return "待提升";
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * 学科能力测评计分。answers 须至少含 1 科、每科长度与题库一致、分值 1-5。
 * 环节均分 → 综合均分 → 定级；最强/最弱环节按环节均分取（并列取先者）。
 */
export function scoreSubjectAssessment(answers: SubjectAssessmentAnswers): SubjectAssessmentResult {
  const picked = SUBJECT_ORDER.filter((s) => Array.isArray(answers[s]));
  if (picked.length === 0) throw new Error("学科测评至少需要完成 1 个学科");
  const subjects: SubjectScore[] = picked.map((name) => {
    const bank = SUBJECT_BANK[name];
    const vals = answers[name]!;
    if (vals.length !== bank.length) {
      throw new Error(`${name} 答案数量应为 ${bank.length}，实际 ${vals.length}`);
    }
    vals.forEach((v, i) => {
      if (!Number.isInteger(v) || v < 1 || v > 5) throw new Error(`${name} 第 ${i + 1} 题分值须为 1-5`);
    });
    const stages: SubjectStageScore[] = SUBJECT_STAGE_ORDER.filter((st) =>
      bank.some((it) => it.stage === st),
    ).map((st) => {
      const idxs = bank.map((it, i) => (it.stage === st ? i : -1)).filter((i) => i >= 0);
      const avg = r1(idxs.reduce((s, i) => s + vals[i], 0) / idxs.length);
      const weakPoints = idxs
        .filter((i) => vals[i] <= 2)
        .slice(0, 3)
        .map((i) => bank[i].point);
      return { stage: st, avg, items: idxs.length, weakPoints };
    });
    const overall = r1(stages.reduce((s, x) => s + x.avg, 0) / stages.length);
    const best = [...stages].sort((a, b) => b.avg - a.avg)[0];
    const worst = [...stages].sort((a, b) => a.avg - b.avg || stages.indexOf(a) - stages.indexOf(b))[0];
    return {
      name,
      stages,
      overall,
      grade: subjectGrade(overall),
      strongest: best.stage,
      weakest: worst.stage,
    };
  });
  const totalAvg = r1(subjects.reduce((s, x) => s + x.overall, 0) / subjects.length);
  const weakestStages = subjects
    .flatMap((s) => s.stages.map((st) => ({ subject: s.name, stage: st.stage, avg: st.avg })))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);
  const worstSubjects = [...subjects].sort((a, b) => a.overall - b.overall).slice(0, 2);
  const summary =
    `本次测评覆盖 ${subjects.length} 科，综合均分 ${totalAvg}/5（${subjectGrade(totalAvg)}）。` +
    `相对薄弱的学科是 ${worstSubjects.map((s) => `${s.name}（${s.overall} · ${s.grade}，短板在「${s.weakest}」环节）`).join("、")}；` +
    `最需要先补的学习环节：${weakestStages.map((w) => `${w.subject}·${w.stage}（${w.avg}）`).join("、")}。` +
    `建议每月复测一次，纵向对比各环节是否改善。`;
  return { subjects, totalAvg, weakestStages, summary };
}
