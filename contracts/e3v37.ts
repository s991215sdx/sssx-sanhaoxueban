/**
 * V3.7 三阶九能「学业诊断测评表」题库与计分器。
 * 内容严格对应附件《三阶九能测评表 V3.7（小学/初中/高中版）》，不得更改题干。
 * 结构：三阶（乐学/会学/善学，每阶三能，共九能）＋ 条件系统（状态/关系/资源三格，不进总分）
 * ＋ 学能三项（注意力/工作记忆/加工速度，反映当前加工效率）。
 * 计分规则：
 * - 评分题 1-70（1-5 分）；反向题按「6 - 圈选数」换算；
 * - 关注点（kp）= 题号分组均值；能分 = 能力下题目（反向后）均分，保留 1 位小数；
 * - 系统分 = 系统下题目（反向后）均分；条件系统单独报告三格，不进总分；
 * - 阈值：≥3.8 正常（绿）/ ≥3.0 待提升（黄）/ <3.0 卡点（红）；任一关注点 ≤2.0 该能强制「卡点」；
 * - 学习状态单选 A-E 赋分 5-1，单独报告；
 * - 外驱依赖指数 = 5-7 题原始均分（不反向，越高越依赖外部推动）；内驱指数 = 8-10 题均分；
 * - 生活事件（71-78）0-3 直接累加，0-3 正常 / 4-7 警戒 / ≥8 高风险；
 * - 心理红线：55 题原始分 ≥4；56 题原始分 ≥3；生活事件总分 ≥8 或任一单项 =3；
 * - 作答有效性：连续 ≥8 题同数值判疑似惯性作答；正反成对题（11v12、13v14、15v16、17v18、
 *   20v21、57v58、60v61、64v65）反向后同向差 ≥3 记矛盾作答。
 * - 主卡点：按优先级链 条件 → 乐学 → 会学 → 善学 → 智学，取最低分的红灯项。
 */

export type E3V37Stage = "primary" | "junior" | "senior";
export const E3V37_STAGE_LABEL: Record<E3V37Stage, string> = {
  primary: "小学版", junior: "初中版", senior: "高中版",
};

export type E3V37System = "乐学" | "会学" | "善学" | "条件" | "学能";
export type E3V37Ability =
  | "动力" | "信心" | "韧劲"
  | "学懂" | "记住" | "会用"
  | "计划" | "复盘" | "智学"
  | "状态" | "关系" | "资源"
  | "注意力" | "工作记忆" | "加工速度";

export type E3V37Question = {
  no: number;
  /** 关注点（如「学习兴趣」「自我效能感」），kp 级红灯判读的最小单元。 */
  kp: string;
  text: string;
  /** 反向题（计分时按 6 - 原值 换算）。 */
  reverse: boolean;
  system: E3V37System;
  ability: E3V37Ability;
};

/** 小学版：1-70 评分题。 */
export const E3V37_QUESTIONS_PRIMARY: E3V37Question[] = [
  { no: 1, kp: "学习兴趣", text: "我对某些学科内容本身很感兴趣，常常主动钻研", reverse: false, system: "乐学", ability: "动力" },
  { no: 2, kp: "学习兴趣", text: "学新知识时，我常常有「想知道更多」的好奇心", reverse: false, system: "乐学", ability: "动力" },
  { no: 3, kp: "目标感", text: "我清楚自己今年要达到的目标（分数、排名、升读学校）", reverse: false, system: "乐学", ability: "动力" },
  { no: 4, kp: "目标感", text: "我对将来想读哪所中学、长大后想做什么样的事，有自己的想法", reverse: false, system: "乐学", ability: "动力" },
  { no: 5, kp: "动力来源·外驱", text: "我努力学习，主要是为了不被父母或老师批评、惩罚", reverse: true, system: "乐学", ability: "动力" },
  { no: 6, kp: "动力来源·外驱", text: "我学习的时候，总期待有礼物、零花钱或游戏时间等奖励，这样我会更有干劲", reverse: true, system: "乐学", ability: "动力" },
  { no: 7, kp: "动力来源·外驱", text: "老师表扬、同学认可或排名进步，是我学习的主要动力", reverse: true, system: "乐学", ability: "动力" },
  { no: 8, kp: "动力来源·内驱", text: "我知道自己为什么学习——为了成为更厉害的自己", reverse: false, system: "乐学", ability: "动力" },
  { no: 9, kp: "动力来源·内驱", text: "我希望自己将来能用所学知识，帮助他人", reverse: false, system: "乐学", ability: "动力" },
  { no: 10, kp: "动力来源·内驱", text: "我希望将来能做了不起的事，帮到很多人", reverse: false, system: "乐学", ability: "动力" },
  { no: 11, kp: "比较优势", text: "我有一个明确比别人做得好的领域（学习或学习之外都算）", reverse: false, system: "乐学", ability: "信心" },
  { no: 12, kp: "比较优势", text: "我不太自信，感觉自己很笨，找不到一个能赢过别人的地方", reverse: true, system: "乐学", ability: "信心" },
  { no: 13, kp: "自我效能感", text: "我相信只要我好好学、方法对，就一定能学得很好", reverse: false, system: "乐学", ability: "信心" },
  { no: 14, kp: "自我效能感", text: "我经常觉得「学不学都那样」，再怎么努力也赶不上别人", reverse: true, system: "乐学", ability: "信心" },
  { no: 15, kp: "成长性思维", text: "我相信人的能力不是天生固定的，只要方法对、肯努力，就能不断提升", reverse: false, system: "乐学", ability: "信心" },
  { no: 16, kp: "成长性思维", text: "考不好的时候，我第一反应是觉得「我天生就不是学这个的料」", reverse: true, system: "乐学", ability: "信心" },
  { no: 17, kp: "抗挫折", text: "遇到难题或考砸时，我的第一反应是退缩、逃避", reverse: true, system: "乐学", ability: "韧劲" },
  { no: 18, kp: "抗挫折", text: "考试失利后，我能较快调整状态、重新投入", reverse: false, system: "乐学", ability: "韧劲" },
  { no: 19, kp: "坚持性", text: "背单词、刷题这类需要长期坚持的事，我能一天不落地做下去", reverse: false, system: "乐学", ability: "韧劲" },
  { no: 20, kp: "情绪韧劲", text: "挫败后我容易陷在情绪里，好几天缓不过劲", reverse: true, system: "乐学", ability: "韧劲" },
  { no: 21, kp: "情绪韧劲", text: "我能觉察自己的情绪，并知道怎样让自己平静下来", reverse: false, system: "乐学", ability: "韧劲" },
  { no: 22, kp: "预习", text: "课前我会预习，并带着疑问去听课", reverse: false, system: "会学", ability: "学懂" },
  { no: 23, kp: "带问题听课", text: "上课我能抓住重点，听不懂的地方会标记下来", reverse: false, system: "会学", ability: "学懂" },
  { no: 24, kp: "主动求问", text: "不懂的地方，我会常主动问老师、同学或查资料，直到弄明白", reverse: false, system: "会学", ability: "学懂" },
  { no: 25, kp: "提炼关键词", text: "学完一段内容，我能抓住重点、提炼出关键词", reverse: false, system: "会学", ability: "记住" },
  { no: 26, kp: "结构化整理", text: "学完一章，我会用画图或列表的方式，把学过的知识串起来", reverse: false, system: "会学", ability: "记住" },
  { no: 27, kp: "复述输出", text: "学完一个内容，我能不看书，用自己的话把它讲清楚", reverse: false, system: "会学", ability: "记住" },
  { no: 28, kp: "错题整理", text: "做错的题我会整理下来，写清错误原因（粗心、不会还是概念不清），以及标注对应知识点", reverse: false, system: "会学", ability: "会用" },
  { no: 29, kp: "错题复习", text: "针对错题对应的知识点，我会认真去复习这些知识点", reverse: false, system: "会学", ability: "会用" },
  { no: 30, kp: "错题重做", text: "错题我会隔几天重做，直到同类题不再错", reverse: false, system: "会学", ability: "会用" },
  { no: 31, kp: "举一反三", text: "遇到新题型，我常不知道从哪分析，很难把学过的解法用上去", reverse: true, system: "会学", ability: "会用" },
  { no: 32, kp: "综合运用", text: "能将同一学科不同单元知识串联起来分析问题，系统性解决问题", reverse: false, system: "会学", ability: "会用" },
  { no: 33, kp: "综合运用", text: "考的每一个知识点，我都能讲出它考了哪些所学知识点", reverse: false, system: "会学", ability: "会用" },
  { no: 34, kp: "目标拆解", text: "我会把大目标（期末、升初中目标）拆成一个个可执行的小任务", reverse: false, system: "善学", ability: "计划" },
  { no: 35, kp: "时间安排", text: "我会先做重要和着急的作业，再安排其他的事", reverse: false, system: "善学", ability: "计划" },
  { no: 36, kp: "计划执行", text: "我每天有明确的学习计划，并且大部分能完成", reverse: false, system: "善学", ability: "计划" },
  { no: 37, kp: "自我监控", text: "学完一段内容，我会停下来问自己「我真的懂了吗」", reverse: false, system: "善学", ability: "复盘" },
  { no: 38, kp: "自我监控", text: "学习新知识后，我会尝试用自己的话复述，检验掌握程度", reverse: false, system: "善学", ability: "复盘" },
  { no: 39, kp: "自我监控", text: "考完考试，我会留时间出来检查做过的题是否有错误", reverse: false, system: "善学", ability: "复盘" },
  { no: 40, kp: "自我监控", text: "本来打算做作业，结果刷了好一会儿手机或视频，等反应过来时间已经过去了", reverse: true, system: "善学", ability: "复盘" },
  { no: 41, kp: "反思归因", text: "学习总是不能按计划进行时，我会回顾学习过程，找出存在的问题", reverse: false, system: "善学", ability: "复盘" },
  { no: 42, kp: "反思归因", text: "考试结束后，我会看看错的是不会、粗心，还是时间不够", reverse: false, system: "善学", ability: "复盘" },
  { no: 43, kp: "策略调节", text: "发现学习方法效果不好时，我会主动调整学习方法", reverse: false, system: "善学", ability: "复盘" },
  { no: 44, kp: "策略调节", text: "我会写复盘小结或日记，用它来优化自己的学习", reverse: false, system: "善学", ability: "复盘" },
  { no: 45, kp: "AI运用习惯", text: "周末和假期，我习惯性把错题或试卷给到AI或学习机（豆包、DeepSeek或学习机），帮我查漏补缺，辅助我自主学习", reverse: false, system: "善学", ability: "智学" },
  { no: 46, kp: "会向AI提问", text: "我能向AI清楚描述问题、追问细节，让它引导我学习知识点，而不是只发一句「这题怎么做」", reverse: false, system: "善学", ability: "智学" },
  { no: 47, kp: "会验证AI结果", text: "我会核对AI给的答案和讲解，发现不对会质疑，而不是直接照抄", reverse: false, system: "善学", ability: "智学" },
  { no: 48, kp: "会用AI迁移", text: "我会让AI帮我整理知识、出同类题练习，而不是让AI替我把答案抄完", reverse: false, system: "善学", ability: "智学" },
  { no: 49, kp: "AI依赖", text: "没有AI或手机帮忙，我就很难独立完成学习任务", reverse: true, system: "善学", ability: "智学" },
  { no: 50, kp: "精力", text: "我最近一个月睡眠规律，能睡够（小学约9—10小时）", reverse: false, system: "条件", ability: "状态" },
  { no: 51, kp: "精力", text: "我饮食健康、吃饭正常，家人在生活上把我照顾得很好", reverse: false, system: "条件", ability: "状态" },
  { no: 52, kp: "精力", text: "我每周都有比较足够的运动时间", reverse: false, system: "条件", ability: "状态" },
  { no: 53, kp: "精力", text: "最近我身体常有不舒服（头痛、肠胃等），影响学习", reverse: true, system: "条件", ability: "状态" },
  { no: 54, kp: "精力", text: "我最近经常疲惫没精神，学习时提不起劲", reverse: true, system: "条件", ability: "状态" },
  { no: 55, kp: "情绪", text: "我最近经常烦躁、低落或不想说话", reverse: true, system: "条件", ability: "状态" },
  { no: 56, kp: "情绪", text: "最近一个月，我有超过一半的日子不想上学", reverse: true, system: "条件", ability: "状态" },
  { no: 57, kp: "亲子关系", text: "父母和我谈学习时情绪稳定，更多是理解和支持", reverse: false, system: "条件", ability: "关系" },
  { no: 58, kp: "亲子关系", text: "家里对我学习的管教方式让我压力很大", reverse: true, system: "条件", ability: "关系" },
  { no: 59, kp: "师生关系", text: "现在有我不喜欢的老师，明显影响了这科学习", reverse: true, system: "条件", ability: "关系" },
  { no: 60, kp: "同伴关系", text: "身边的朋友同学会常和我谈论学习、促进我学习", reverse: false, system: "条件", ability: "关系" },
  { no: 61, kp: "同伴关系", text: "周围同学的氛围让我很难专心学习", reverse: true, system: "条件", ability: "关系" },
  { no: 62, kp: "学习环境", text: "我有一个安静、固定、不被打扰的学习位置", reverse: false, system: "条件", ability: "资源" },
  { no: 63, kp: "学习工具", text: "我需要的课本、练习、工具书、学习机等学习材料都能方便获取", reverse: false, system: "条件", ability: "资源" },
  { no: 64, kp: "时间资源", text: "我有可自由支配的学习时间，不会被各种安排占满", reverse: false, system: "条件", ability: "资源" },
  { no: 65, kp: "时间资源", text: "一玩起游戏、刷起手机或追起星来，我就停不下来，超时了也忍不住", reverse: true, system: "条件", ability: "资源" },
  { no: 66, kp: "学校资源", text: "我基本上能跟得上学校的教学进度，学校能提供我学习所需要的帮助与学习条件", reverse: false, system: "条件", ability: "资源" },
  { no: 67, kp: "家庭资源", text: "家人支持我的学习，总在为我的学习提供必要协助", reverse: false, system: "条件", ability: "资源" },
  { no: 68, kp: "注意力", text: "我很难连续20分钟集中精力做一件事，经常走神", reverse: true, system: "学能", ability: "注意力" },
  { no: 69, kp: "工作记忆", text: "刚背过的课文、单词或公式，我很快就回忆不起来", reverse: true, system: "学能", ability: "工作记忆" },
  { no: 70, kp: "加工速度", text: "我理解新知识、解题或做作业的速度明显比同学慢", reverse: true, system: "学能", ability: "加工速度" },
];

/** 初中版：1-70 评分题（题号/结构与其他版本一致，仅个别题干措辞不同）。 */
export const E3V37_QUESTIONS_JUNIOR: E3V37Question[] = [
  { no: 1, kp: "学习兴趣", text: "我对某些学科内容本身很感兴趣，常常主动钻研", reverse: false, system: "乐学", ability: "动力" },
  { no: 2, kp: "学习兴趣", text: "学新知识时，我常常有「想知道更多」的好奇心", reverse: false, system: "乐学", ability: "动力" },
  { no: 3, kp: "目标感", text: "我清楚自己今年要达到的目标（分数、排名、升读学校）", reverse: false, system: "乐学", ability: "动力" },
  { no: 4, kp: "目标感", text: "我对想读哪所高中有比较清晰的目标，知道它需要的成绩；对长大后想做什么有初步想法", reverse: false, system: "乐学", ability: "动力" },
  { no: 5, kp: "动力来源·外驱", text: "我努力学习，主要是为了不被父母或老师批评、惩罚", reverse: true, system: "乐学", ability: "动力" },
  { no: 6, kp: "动力来源·外驱", text: "我学习的时候，总期待有礼物、零花钱或游戏时间等奖励，这样我会更有干劲", reverse: true, system: "乐学", ability: "动力" },
  { no: 7, kp: "动力来源·外驱", text: "老师表扬、同学认可或排名进步，是我学习的主要动力", reverse: true, system: "乐学", ability: "动力" },
  { no: 8, kp: "动力来源·内驱", text: "我有自己清晰的人生规划，我学习为了实现自己的人生目标，成为更好的自己", reverse: false, system: "乐学", ability: "动力" },
  { no: 9, kp: "动力来源·内驱", text: "我希望自己将来能用所学知识，帮助他人", reverse: false, system: "乐学", ability: "动力" },
  { no: 10, kp: "动力来源·内驱", text: "我有强烈的使命感，我希望未来能成就一番事业，为社会做出重大贡献", reverse: false, system: "乐学", ability: "动力" },
  { no: 11, kp: "比较优势", text: "我有一个明确比别人做得好的领域（学习或学习之外都算）", reverse: false, system: "乐学", ability: "信心" },
  { no: 12, kp: "比较优势", text: "我不太自信，感觉自己很笨，找不到一个能赢过别人的地方", reverse: true, system: "乐学", ability: "信心" },
  { no: 13, kp: "自我效能感", text: "我相信只要我好好学、方法对，就一定能学得很好", reverse: false, system: "乐学", ability: "信心" },
  { no: 14, kp: "自我效能感", text: "我经常觉得「学不学都那样」，再怎么努力也赶不上别人", reverse: true, system: "乐学", ability: "信心" },
  { no: 15, kp: "成长性思维", text: "我相信人的能力不是天生固定的，只要方法对、肯努力，就能不断提升", reverse: false, system: "乐学", ability: "信心" },
  { no: 16, kp: "成长性思维", text: "考不好的时候，我第一反应是觉得「我天生就不是学这个的料」", reverse: true, system: "乐学", ability: "信心" },
  { no: 17, kp: "抗挫折", text: "遇到难题或考砸时，我的第一反应是退缩、逃避", reverse: true, system: "乐学", ability: "韧劲" },
  { no: 18, kp: "抗挫折", text: "考试失利后，我能较快调整状态、重新投入", reverse: false, system: "乐学", ability: "韧劲" },
  { no: 19, kp: "坚持性", text: "背单词、刷题这类需要长期坚持的事，我能一天不落地做下去", reverse: false, system: "乐学", ability: "韧劲" },
  { no: 20, kp: "情绪韧劲", text: "挫败后我容易陷在情绪里，好几天缓不过劲", reverse: true, system: "乐学", ability: "韧劲" },
  { no: 21, kp: "情绪韧劲", text: "我能觉察自己的情绪，并知道怎样让自己平静下来", reverse: false, system: "乐学", ability: "韧劲" },
  { no: 22, kp: "预习", text: "课前我会预习，并带着疑问去听课", reverse: false, system: "会学", ability: "学懂" },
  { no: 23, kp: "带问题听课", text: "上课我能抓住重点，听不懂的地方会标记下来", reverse: false, system: "会学", ability: "学懂" },
  { no: 24, kp: "主动求问", text: "不懂的地方，我会常主动问老师、同学或查资料，直到弄明白", reverse: false, system: "会学", ability: "学懂" },
  { no: 25, kp: "提炼关键词", text: "学完一段内容，我能抓住重点、提炼出关键词", reverse: false, system: "会学", ability: "记住" },
  { no: 26, kp: "结构化整理", text: "学完一章，我会习惯性自己动手画结构图或思维导图，把知识串起来", reverse: false, system: "会学", ability: "记住" },
  { no: 27, kp: "复述输出", text: "学完一个内容，我能不看书，用自己的话把它讲清楚", reverse: false, system: "会学", ability: "记住" },
  { no: 28, kp: "错题整理", text: "做错的题我会整理下来，写清错误原因（粗心、不会还是概念不清），以及标注对应知识点", reverse: false, system: "会学", ability: "会用" },
  { no: 29, kp: "错题复习", text: "针对错题对应的知识点，我会认真去复习这些知识点", reverse: false, system: "会学", ability: "会用" },
  { no: 30, kp: "错题重做", text: "错题我会隔几天重做，直到同类题不再错", reverse: false, system: "会学", ability: "会用" },
  { no: 31, kp: "举一反三", text: "遇到新题型，我常不知道从哪分析，很难把学过的解法用上去", reverse: true, system: "会学", ability: "会用" },
  { no: 32, kp: "综合运用", text: "能将同一学科不同单元知识串联起来分析问题，系统性解决问题", reverse: false, system: "会学", ability: "会用" },
  { no: 33, kp: "综合运用", text: "考的每一个知识点，我都能讲出它考了哪些所学知识点", reverse: false, system: "会学", ability: "会用" },
  { no: 34, kp: "目标拆解", text: "我会把大目标（期末、中考目标）拆成一个个可执行的小任务", reverse: false, system: "善学", ability: "计划" },
  { no: 35, kp: "时间安排", text: "我能根据任务轻重缓急和各科情况，合理安排时间", reverse: false, system: "善学", ability: "计划" },
  { no: 36, kp: "计划执行", text: "我每天有明确的学习计划，并且大部分能完成", reverse: false, system: "善学", ability: "计划" },
  { no: 37, kp: "自我监控", text: "学完一段内容，我会停下来问自己「我真的懂了吗」", reverse: false, system: "善学", ability: "复盘" },
  { no: 38, kp: "自我监控", text: "学习新知识后，我会尝试用自己的话复述，检验掌握程度", reverse: false, system: "善学", ability: "复盘" },
  { no: 39, kp: "自我监控", text: "考完考试，我会留时间出来检查做过的题是否有错误", reverse: false, system: "善学", ability: "复盘" },
  { no: 40, kp: "自我监控", text: "本来打算做作业，结果刷了好一会儿手机或视频，等反应过来时间已经过去了", reverse: true, system: "善学", ability: "复盘" },
  { no: 41, kp: "反思归因", text: "学习总是不能按计划进行时，我会回顾学习过程，找出存在的问题", reverse: false, system: "善学", ability: "复盘" },
  { no: 42, kp: "反思归因", text: "考试结束后，我会习惯性做试卷分析，区分失利是知识漏洞、粗心还是考试技巧问题", reverse: false, system: "善学", ability: "复盘" },
  { no: 43, kp: "策略调节", text: "发现学习方法效果不好时，我会主动调整学习方法", reverse: false, system: "善学", ability: "复盘" },
  { no: 44, kp: "策略调节", text: "我会写复盘小结或日记，用它来优化自己的学习", reverse: false, system: "善学", ability: "复盘" },
  { no: 45, kp: "AI运用习惯", text: "周末和假期，我习惯性把错题或试卷给到AI或学习机（豆包、DeepSeek或学习机），帮我查漏补缺，辅助我自主学习", reverse: false, system: "善学", ability: "智学" },
  { no: 46, kp: "会向AI提问", text: "我能向AI清楚描述问题、追问细节，让它引导我学习知识点，而不是只发一句「这题怎么做」", reverse: false, system: "善学", ability: "智学" },
  { no: 47, kp: "会验证AI结果", text: "我会核对AI给的答案和讲解，发现不对会质疑，而不是直接照抄", reverse: false, system: "善学", ability: "智学" },
  { no: 48, kp: "会用AI迁移", text: "我会让AI帮我整理知识、出同类题练习，而不是让AI替我把答案抄完", reverse: false, system: "善学", ability: "智学" },
  { no: 49, kp: "AI依赖", text: "没有AI或手机帮忙，我就很难独立完成学习任务", reverse: true, system: "善学", ability: "智学" },
  { no: 50, kp: "精力", text: "我最近一个月睡眠规律，能睡够（初中约8—9小时）", reverse: false, system: "条件", ability: "状态" },
  { no: 51, kp: "精力", text: "我饮食健康、吃饭正常，家人在生活上把我照顾得很好", reverse: false, system: "条件", ability: "状态" },
  { no: 52, kp: "精力", text: "我每周都有比较足够的运动时间", reverse: false, system: "条件", ability: "状态" },
  { no: 53, kp: "精力", text: "最近我身体常有不舒服（头痛、肠胃等），影响学习", reverse: true, system: "条件", ability: "状态" },
  { no: 54, kp: "精力", text: "我最近经常疲惫没精神，学习时提不起劲", reverse: true, system: "条件", ability: "状态" },
  { no: 55, kp: "情绪", text: "我最近经常烦躁、低落或不想说话", reverse: true, system: "条件", ability: "状态" },
  { no: 56, kp: "情绪", text: "最近一个月，我有超过一半的日子不想上学", reverse: true, system: "条件", ability: "状态" },
  { no: 57, kp: "亲子关系", text: "父母和我谈学习时情绪稳定，更多是理解和支持", reverse: false, system: "条件", ability: "关系" },
  { no: 58, kp: "亲子关系", text: "家里对我学习的管教方式让我压力很大", reverse: true, system: "条件", ability: "关系" },
  { no: 59, kp: "师生关系", text: "现在有我不喜欢的老师，明显影响了这科学习", reverse: true, system: "条件", ability: "关系" },
  { no: 60, kp: "同伴关系", text: "身边的朋友同学会常和我谈论学习、促进我学习", reverse: false, system: "条件", ability: "关系" },
  { no: 61, kp: "同伴关系", text: "周围同学的氛围让我很难专心学习", reverse: true, system: "条件", ability: "关系" },
  { no: 62, kp: "学习环境", text: "我有一个安静、固定、不被打扰的学习位置", reverse: false, system: "条件", ability: "资源" },
  { no: 63, kp: "学习工具", text: "我需要的课本、练习、工具书、学习机等学习材料都能方便获取", reverse: false, system: "条件", ability: "资源" },
  { no: 64, kp: "时间资源", text: "我有可自由支配的学习时间，不会被各种安排占满", reverse: false, system: "条件", ability: "资源" },
  { no: 65, kp: "时间资源", text: "一玩起游戏、刷起手机或追起星来，我就停不下来，超时了也忍不住", reverse: true, system: "条件", ability: "资源" },
  { no: 66, kp: "学校资源", text: "我基本上能跟得上学校的教学进度，学校能提供我学习所需要的帮助与学习条件", reverse: false, system: "条件", ability: "资源" },
  { no: 67, kp: "家庭资源", text: "家人支持我的学习，总在为我的学习提供必要协助", reverse: false, system: "条件", ability: "资源" },
  { no: 68, kp: "注意力", text: "我很难连续30分钟集中精力做一件事，经常走神", reverse: true, system: "学能", ability: "注意力" },
  { no: 69, kp: "工作记忆", text: "刚背过的课文、单词或公式，我很快就回忆不起来", reverse: true, system: "学能", ability: "工作记忆" },
  { no: 70, kp: "加工速度", text: "我理解新知识、解题或做作业的速度明显比同学慢", reverse: true, system: "学能", ability: "加工速度" },
];

/** 高中版：1-70 评分题。 */
export const E3V37_QUESTIONS_SENIOR: E3V37Question[] = [
  { no: 1, kp: "学习兴趣", text: "我对某些学科内容本身很感兴趣，常常主动钻研", reverse: false, system: "乐学", ability: "动力" },
  { no: 2, kp: "学习兴趣", text: "学新知识时，我常常有「想知道更多」的好奇心", reverse: false, system: "乐学", ability: "动力" },
  { no: 3, kp: "目标感", text: "我清楚自己今年要达到的目标（分数、排名、升读学校）", reverse: false, system: "乐学", ability: "动力" },
  { no: 4, kp: "目标感", text: "我对未来想读什么大学、什么专业、想从事什么工作，有比较清晰的目标，并知道它们对成绩和能力的要求", reverse: false, system: "乐学", ability: "动力" },
  { no: 5, kp: "动力来源·外驱", text: "我努力学习，主要是为了不被父母或老师批评、惩罚", reverse: true, system: "乐学", ability: "动力" },
  { no: 6, kp: "动力来源·外驱", text: "我学习的时候，总期待有礼物、零花钱或游戏时间等奖励，这样我会更有干劲", reverse: true, system: "乐学", ability: "动力" },
  { no: 7, kp: "动力来源·外驱", text: "老师表扬、同学认可或排名进步，是我学习的主要动力", reverse: true, system: "乐学", ability: "动力" },
  { no: 8, kp: "动力来源·内驱", text: "我有自己清晰的人生规划，我学习为了实现自己的人生目标，成为更好的自己", reverse: false, system: "乐学", ability: "动力" },
  { no: 9, kp: "动力来源·内驱", text: "我希望自己将来能用所学知识，帮助他人", reverse: false, system: "乐学", ability: "动力" },
  { no: 10, kp: "动力来源·内驱", text: "我有强烈的使命感，我希望未来能成就一番事业，为社会做出重大贡献", reverse: false, system: "乐学", ability: "动力" },
  { no: 11, kp: "比较优势", text: "我有一个明确比别人做得好的领域（学习或学习之外都算）", reverse: false, system: "乐学", ability: "信心" },
  { no: 12, kp: "比较优势", text: "我不太自信，感觉自己很笨，找不到一个能赢过别人的地方", reverse: true, system: "乐学", ability: "信心" },
  { no: 13, kp: "自我效能感", text: "我相信只要我好好学、方法对，就一定能学得很好", reverse: false, system: "乐学", ability: "信心" },
  { no: 14, kp: "自我效能感", text: "我经常觉得「学不学都那样」，再怎么努力也赶不上别人", reverse: true, system: "乐学", ability: "信心" },
  { no: 15, kp: "成长性思维", text: "我相信人的能力不是天生固定的，只要方法对、肯努力，就能不断提升", reverse: false, system: "乐学", ability: "信心" },
  { no: 16, kp: "成长性思维", text: "考不好的时候，我第一反应是觉得「我天生就不是学这个的料」", reverse: true, system: "乐学", ability: "信心" },
  { no: 17, kp: "抗挫折", text: "遇到难题或考砸时，我的第一反应是退缩、逃避", reverse: true, system: "乐学", ability: "韧劲" },
  { no: 18, kp: "抗挫折", text: "考试失利后，我能较快调整状态、重新投入", reverse: false, system: "乐学", ability: "韧劲" },
  { no: 19, kp: "坚持性", text: "背单词、刷题这类需要长期坚持的事，我能一天不落地做下去", reverse: false, system: "乐学", ability: "韧劲" },
  { no: 20, kp: "情绪韧劲", text: "挫败后我容易陷在情绪里，好几天缓不过劲", reverse: true, system: "乐学", ability: "韧劲" },
  { no: 21, kp: "情绪韧劲", text: "我能觉察自己的情绪，并知道怎样让自己平静下来", reverse: false, system: "乐学", ability: "韧劲" },
  { no: 22, kp: "预习", text: "课前我会预习，并带着疑问去听课", reverse: false, system: "会学", ability: "学懂" },
  { no: 23, kp: "带问题听课", text: "上课我能抓住重点，听不懂的地方会标记下来", reverse: false, system: "会学", ability: "学懂" },
  { no: 24, kp: "主动求问", text: "不懂的地方，我会常主动问老师、同学或查资料，直到弄明白", reverse: false, system: "会学", ability: "学懂" },
  { no: 25, kp: "提炼关键词", text: "学完一段内容，我能抓住重点、提炼出关键词", reverse: false, system: "会学", ability: "记住" },
  { no: 26, kp: "结构化整理", text: "学完一章，我会习惯性自己动手画结构图或思维导图，把知识串起来", reverse: false, system: "会学", ability: "记住" },
  { no: 27, kp: "复述输出", text: "学完一个内容，我能不看书，用自己的话把它讲清楚", reverse: false, system: "会学", ability: "记住" },
  { no: 28, kp: "错题整理", text: "做错的题我会整理下来，写清错误原因（粗心、不会还是概念不清），以及标注对应知识点", reverse: false, system: "会学", ability: "会用" },
  { no: 29, kp: "错题复习", text: "针对错题对应的知识点，我会认真去复习这些知识点", reverse: false, system: "会学", ability: "会用" },
  { no: 30, kp: "错题重做", text: "错题我会隔几天重做，直到同类题不再错", reverse: false, system: "会学", ability: "会用" },
  { no: 31, kp: "举一反三", text: "遇到新题型，我常不知道从哪分析，很难把学过的解法用上去", reverse: true, system: "会学", ability: "会用" },
  { no: 32, kp: "综合运用", text: "能将同一学科不同单元知识串联起来分析问题，系统性解决问题", reverse: false, system: "会学", ability: "会用" },
  { no: 33, kp: "综合运用", text: "考的每一个知识点，我都能讲出它考了哪些所学知识点", reverse: false, system: "会学", ability: "会用" },
  { no: 34, kp: "目标拆解", text: "我会把大目标（期末、高考目标）拆成一个个可执行的小任务", reverse: false, system: "善学", ability: "计划" },
  { no: 35, kp: "时间安排", text: "我能根据任务轻重缓急和各科情况，合理安排时间", reverse: false, system: "善学", ability: "计划" },
  { no: 36, kp: "计划执行", text: "我每天有明确的学习计划，并且大部分能完成", reverse: false, system: "善学", ability: "计划" },
  { no: 37, kp: "自我监控", text: "学完一段内容，我会停下来问自己「我真的懂了吗」", reverse: false, system: "善学", ability: "复盘" },
  { no: 38, kp: "自我监控", text: "学习新知识后，我会尝试用自己的话复述，检验掌握程度", reverse: false, system: "善学", ability: "复盘" },
  { no: 39, kp: "自我监控", text: "考完考试，我会留时间出来检查做过的题是否有错误", reverse: false, system: "善学", ability: "复盘" },
  { no: 40, kp: "自我监控", text: "本来打算做作业，结果刷了好一会儿手机或视频，等反应过来时间已经过去了", reverse: true, system: "善学", ability: "复盘" },
  { no: 41, kp: "反思归因", text: "学习总是不能按计划进行时，我会回顾学习过程，找出存在的问题", reverse: false, system: "善学", ability: "复盘" },
  { no: 42, kp: "反思归因", text: "考试结束后，我会习惯性做试卷分析，区分失利是知识漏洞、粗心还是考试技巧问题", reverse: false, system: "善学", ability: "复盘" },
  { no: 43, kp: "策略调节", text: "发现学习方法效果不好时，我会主动调整学习方法", reverse: false, system: "善学", ability: "复盘" },
  { no: 44, kp: "策略调节", text: "我会写复盘小结或日记，用它来优化自己的学习", reverse: false, system: "善学", ability: "复盘" },
  { no: 45, kp: "AI运用习惯", text: "周末和假期，我习惯性把错题或试卷给到AI或学习机（豆包、DeepSeek或学习机），帮我查漏补缺，辅助我自主学习", reverse: false, system: "善学", ability: "智学" },
  { no: 46, kp: "会向AI提问", text: "我能向AI清楚描述问题、追问细节，让它引导我学习知识点，而不是只发一句「这题怎么做」", reverse: false, system: "善学", ability: "智学" },
  { no: 47, kp: "会验证AI结果", text: "我会核对AI给的答案和讲解，发现不对会质疑，而不是直接照抄", reverse: false, system: "善学", ability: "智学" },
  { no: 48, kp: "会用AI迁移", text: "我会让AI帮我整理知识、出同类题练习，而不是让AI替我把答案抄完", reverse: false, system: "善学", ability: "智学" },
  { no: 49, kp: "AI依赖", text: "没有AI或手机帮忙，我就很难独立完成学习任务", reverse: true, system: "善学", ability: "智学" },
  { no: 50, kp: "精力", text: "我最近一个月睡眠规律，能睡够（高中约7—8小时）", reverse: false, system: "条件", ability: "状态" },
  { no: 51, kp: "精力", text: "我饮食健康、吃饭正常，家人在生活上把我照顾得很好", reverse: false, system: "条件", ability: "状态" },
  { no: 52, kp: "精力", text: "我每周都有比较足够的运动时间", reverse: false, system: "条件", ability: "状态" },
  { no: 53, kp: "精力", text: "最近我身体常有不舒服（头痛、肠胃等），影响学习", reverse: true, system: "条件", ability: "状态" },
  { no: 54, kp: "精力", text: "我最近经常疲惫没精神，学习时提不起劲", reverse: true, system: "条件", ability: "状态" },
  { no: 55, kp: "情绪", text: "我最近经常烦躁、低落或不想说话", reverse: true, system: "条件", ability: "状态" },
  { no: 56, kp: "情绪", text: "最近一个月，我有超过一半的日子不想上学", reverse: true, system: "条件", ability: "状态" },
  { no: 57, kp: "亲子关系", text: "父母和我谈学习时情绪稳定，更多是理解和支持", reverse: false, system: "条件", ability: "关系" },
  { no: 58, kp: "亲子关系", text: "家里对我学习的管教方式让我压力很大", reverse: true, system: "条件", ability: "关系" },
  { no: 59, kp: "师生关系", text: "现在有我不喜欢的老师，明显影响了这科学习", reverse: true, system: "条件", ability: "关系" },
  { no: 60, kp: "同伴关系", text: "身边的朋友同学会常和我谈论学习、促进我学习", reverse: false, system: "条件", ability: "关系" },
  { no: 61, kp: "同伴关系", text: "周围同学的氛围让我很难专心学习", reverse: true, system: "条件", ability: "关系" },
  { no: 62, kp: "学习环境", text: "我有一个安静、固定、不被打扰的学习位置", reverse: false, system: "条件", ability: "资源" },
  { no: 63, kp: "学习工具", text: "我需要的课本、练习、工具书、学习机等学习材料都能方便获取", reverse: false, system: "条件", ability: "资源" },
  { no: 64, kp: "时间资源", text: "我有可自由支配的学习时间，不会被各种安排占满", reverse: false, system: "条件", ability: "资源" },
  { no: 65, kp: "时间资源", text: "一玩起游戏、刷起手机或追起星来，我就停不下来，超时了也忍不住", reverse: true, system: "条件", ability: "资源" },
  { no: 66, kp: "学校资源", text: "我基本上能跟得上学校的教学进度，学校能提供我学习所需要的帮助与学习条件", reverse: false, system: "条件", ability: "资源" },
  { no: 67, kp: "家庭资源", text: "家人支持我的学习，总在为我的学习提供必要协助", reverse: false, system: "条件", ability: "资源" },
  { no: 68, kp: "注意力", text: "我很难连续30分钟集中精力做一件事，经常走神", reverse: true, system: "学能", ability: "注意力" },
  { no: 69, kp: "工作记忆", text: "刚背过的课文、单词或公式，我很快就回忆不起来", reverse: true, system: "学能", ability: "工作记忆" },
  { no: 70, kp: "加工速度", text: "我理解新知识、解题或做作业的速度明显比同学慢", reverse: true, system: "学能", ability: "加工速度" },
];

export const E3V37_QUESTIONS: Record<E3V37Stage, E3V37Question[]> = {
  primary: E3V37_QUESTIONS_PRIMARY, junior: E3V37_QUESTIONS_JUNIOR, senior: E3V37_QUESTIONS_SENIOR,
};

/** 评分题（1-70）；71-78 为生活事件（0-3 分）。 */
export const E3V37_RATING_COUNT = 70;
export const E3V37_LIFE_EVENT_COUNT = 8;

/* ------------------------------ 学习状态单选 ------------------------------ */

export type E3V37MotivationKey = "A" | "B" | "C" | "D" | "E";

/** 学习状态单选（A-E 赋分 5-1，单独报告，不并入能分/系统分）。 */
export const E3V37_MOTIVATION_OPTIONS: { key: E3V37MotivationKey; label: string; text: string; score: number }[] = [
  { key: "A", label: "乐在其中", text: "我享受学习的过程，不觉得痛苦", score: 5 },
  { key: "B", label: "兴趣驱动", text: "我喜欢学习和研究问题，愿意主动钻研", score: 4 },
  { key: "C", label: "目标坚持", text: "我愿意为了目标而学习，能坚持下来", score: 3 },
  { key: "D", label: "勉强应付", text: "我在勉强应付学习，提不起劲，做一天算一天", score: 2 },
  { key: "E", label: "抵触反抗", text: "我在反抗学习，经常抵触和逃避", score: 1 },
];

export const E3V37_MOTIVATION_SCORE: Record<E3V37MotivationKey, number> = {
  A: 5, B: 4, C: 3, D: 2, E: 1,
};

/* ------------------------------- 学科快扫 ------------------------------- */

/**
 * 各学段学科快扫科目。
 * 高中「首选科目（物理/历史，圈一个）」与「再选科目（填两科）」允许学生填自定义科目名。
 */
export const E3V37_SCAN_SUBJECTS: Record<E3V37Stage, string[]> = {
  primary: ["语文", "数学", "英语"],
  junior: ["语文", "数学", "英语", "物理", "化学", "历史", "道法"],
  senior: ["语文", "数学", "英语", "首选科目（物理/历史，圈一个）", "再选科目（填两科）"],
};

export type E3V37SubjectScan = {
  /** 科目名（固定科目或学生自填科目）。 */
  name: string;
  /** 喜欢程度 0-5（0 = 无/未开设）。 */
  liking: number;
  /** 掌握程度 0-5。 */
  mastery: number;
  /** 考试发挥 0-5。 */
  exam: number;
  /** 最近一次成绩（可空）。 */
  lastScore?: number | null;
  /** 满分（可空）。 */
  fullScore?: number | null;
  /** 排名/班位（可空）。 */
  rank?: string;
  /** 最薄弱环节（章节、题型或原因），可空。 */
  weakest: string;
};

export const E3V37_LOSS_REASONS = [
  "知识盲区", "审题失误", "计算/书写粗心", "时间不够", "考场紧张", "题型陌生", "其他",
] as const;

export const E3V37_SCORE_TRENDS = ["持续上升", "基本稳定", "波动较大", "持续下滑"] as const;
export type E3V37ScoreTrend = (typeof E3V37_SCORE_TRENDS)[number] | "";

/* ------------------------------- 生活事件 ------------------------------- */

export type E3V37LifeEvent = { no: number; kp: string; text: string };

/** 生活事件（71-78，0-3 分）。第 74 题「人际困扰」题干因学段而异。 */
export const E3V37_LIFE_EVENTS: Record<E3V37Stage, E3V37LifeEvent[]> = {
  primary: [
    { no: 71, kp: "考试挫折", text: "考试失败或成绩大幅下滑" },
    { no: 72, kp: "师生冲突", text: "被老师批评或当众否定" },
    { no: 73, kp: "同伴矛盾", text: "与同学或好友发生严重矛盾" },
    { no: 74, kp: "人际困扰", text: "和同学闹矛盾，或被同学孤立" },
    { no: 75, kp: "家庭矛盾", text: "家庭内部矛盾、父母争吵" },
    { no: 76, kp: "家庭变化", text: "父母工作变动或家庭成员变动" },
    { no: 77, kp: "环境变化", text: "搬家、转学、换班或换老师" },
    { no: 78, kp: "身体状态", text: "身体疾病、受伤或长期疲劳" },
  ],
  junior: [
    { no: 71, kp: "考试挫折", text: "考试失败或成绩大幅下滑" },
    { no: 72, kp: "师生冲突", text: "被老师批评或当众否定" },
    { no: 73, kp: "同伴矛盾", text: "与同学或好友发生严重矛盾" },
    { no: 74, kp: "人际困扰", text: "恋爱困扰或人际孤立" },
    { no: 75, kp: "家庭矛盾", text: "家庭内部矛盾、父母争吵" },
    { no: 76, kp: "家庭变化", text: "父母工作变动或家庭成员变动" },
    { no: 77, kp: "环境变化", text: "搬家、转学、换班或换老师" },
    { no: 78, kp: "身体状态", text: "身体疾病、受伤或长期疲劳" },
  ],
  senior: [
    { no: 71, kp: "考试挫折", text: "考试失败或成绩大幅下滑" },
    { no: 72, kp: "师生冲突", text: "被老师批评或当众否定" },
    { no: 73, kp: "同伴矛盾", text: "与同学或好友发生严重矛盾" },
    { no: 74, kp: "人际困扰", text: "恋爱困扰或人际孤立" },
    { no: 75, kp: "家庭矛盾", text: "家庭内部矛盾、父母争吵" },
    { no: 76, kp: "家庭变化", text: "父母工作变动或家庭成员变动" },
    { no: 77, kp: "环境变化", text: "搬家、转学、换班或换老师" },
    { no: 78, kp: "身体状态", text: "身体疾病、受伤或长期疲劳" },
  ],
};

/* ------------------------------- 开放题 ------------------------------- */

export const E3V37_OPEN_QUESTIONS: string[] = [
  "问题自述：现在学习中最难、最烦的一件事是什么？",
  "改变意愿：如果接下来一个月只能改变一件事，你最想改变什么？",
  "未来期待：半年后，你希望自己变成什么样？",
];

/* --------------------------- 结构定义（九能/条件/学能/关注点） --------------------------- */

/** 九能顺序（三阶各三能）。 */
export const E3V37_ABILITY_ORDER = [
  "动力", "信心", "韧劲", "学懂", "记住", "会用", "计划", "复盘", "智学",
] as const;
export type E3V37CoreAbility = (typeof E3V37_ABILITY_ORDER)[number];

export const E3V37_SYSTEM_ORDER = ["乐学", "会学", "善学"] as const;
export const E3V37_COND_ORDER = ["状态", "关系", "资源"] as const;
export type E3V37CondKey = (typeof E3V37_COND_ORDER)[number];
export const E3V37_APTITUDE_ORDER = ["注意力", "工作记忆", "加工速度"] as const;

/** 九能定义：key/label/所属系统/题号区间。 */
export const E3V37_ABILITY_DEFS: { key: string; label: E3V37CoreAbility; system: "乐学" | "会学" | "善学"; items: number[] }[] = [
  { key: "drive", label: "动力", system: "乐学", items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { key: "confidence", label: "信心", system: "乐学", items: [11, 12, 13, 14, 15, 16] },
  { key: "resilience", label: "韧劲", system: "乐学", items: [17, 18, 19, 20, 21] },
  { key: "understand", label: "学懂", system: "会学", items: [22, 23, 24] },
  { key: "remember", label: "记住", system: "会学", items: [25, 26, 27] },
  { key: "apply", label: "会用", system: "会学", items: [28, 29, 30, 31, 32, 33] },
  { key: "plan", label: "计划", system: "善学", items: [34, 35, 36] },
  { key: "review", label: "复盘", system: "善学", items: [37, 38, 39, 40, 41, 42, 43, 44] },
  { key: "aiLearn", label: "智学", system: "善学", items: [45, 46, 47, 48, 49] },
];

/** 条件系统三格定义（不进总分）。 */
export const E3V37_COND_DEFS: { key: string; label: E3V37CondKey; items: number[] }[] = [
  { key: "state", label: "状态", items: [50, 51, 52, 53, 54, 55, 56] },
  { key: "relation", label: "关系", items: [57, 58, 59, 60, 61] },
  { key: "resource", label: "资源", items: [62, 63, 64, 65, 66, 67] },
];

/** 学能三项（68/69/70，均反向）。 */
export const E3V37_APTITUDE_DEFS: { key: string; label: (typeof E3V37_APTITUDE_ORDER)[number]; item: number }[] = [
  { key: "attention", label: "注意力", item: 68 },
  { key: "workingMemory", label: "工作记忆", item: 69 },
  { key: "processingSpeed", label: "加工速度", item: 70 },
];

/** 题号 → 关注点（kp）映射（三学段 kp 一致，取小学版构建）。 */
export const E3V37_NO_TO_KP: Record<number, string> = Object.fromEntries(
  E3V37_QUESTIONS_PRIMARY.map((q) => [q.no, q.kp]),
);

/** 关注点定义（kp 级）：每个 kp 下的题目列表，用于「任一关注点 ≤2.0 直接标红」。 */
export type E3V37FocusDef = { kp: string; system: E3V37System; ability: E3V37Ability; items: number[] };
export const E3V37_FOCUS_DEFS: E3V37FocusDef[] = (() => {
  const defs: E3V37FocusDef[] = [];
  for (const q of E3V37_QUESTIONS_PRIMARY) {
    const last = defs[defs.length - 1];
    if (last && last.kp === q.kp && last.ability === q.ability) last.items.push(q.no);
    else defs.push({ kp: q.kp, system: q.system, ability: q.ability, items: [q.no] });
  }
  return defs;
})();

/* ------------------------------- 输入与结果 ------------------------------- */

export type E3V37Input = {
  stage: E3V37Stage;
  /** 70 道评分题（1-5）。 */
  ratings: number[];
  motivation: E3V37MotivationKey;
  /** 学科快扫（未开设的科目三项记 0）。 */
  subjects: E3V37SubjectScan[];
  lossReasons: string[];
  scoreTrend: E3V37ScoreTrend;
  /** 8 道生活事件（0-3）。 */
  lifeEvents: number[];
  openAnswers: string[];
};

export type E3V37Level = "正常" | "待提升" | "卡点";

/** 关注点（kp）级得分。 */
export type E3V37Focus = { kp: string; score: number; level: E3V37Level; items: number[] };

/** 九能之一。 */
export type E3V37AbilityScore = {
  key: string;
  label: E3V37CoreAbility;
  system: "乐学" | "会学" | "善学";
  score: number;
  level: E3V37Level;
  focuses: E3V37Focus[];
};

/** 系统/条件格得分。 */
export type E3V37SystemScore = { key: string; label: string; score: number; level: E3V37Level };

/** 学能单项得分。 */
export type E3V37AptitudeScore = { key: string; label: string; score: number; level: E3V37Level; note: string };

/** 主卡点 / 优先项。 */
export type E3V37MainBlock = { key: string; label: string; score: number; level: E3V37Level };

export type E3V37Result = {
  version: "3.7";
  stage: E3V37Stage;
  stageLabel: string;
  /** 九能得分（含关注点明细）。 */
  abilities: E3V37AbilityScore[];
  systems: {
    /** 乐学/会学/善学 三阶均分。 */
    core: E3V37SystemScore[];
    /** 条件系统：状态/关系/资源三格，单独报告，不进总分。 */
    condition: { key: "条件"; label: string; cells: E3V37SystemScore[]; note: string };
  };
  /** 学能三项（反向后）。 */
  aptitude: E3V37AptitudeScore[];
  motivationKey: E3V37MotivationKey;
  motivationLabel: string;
  /** 状态单选得分（A-E → 5-1），单独报告。 */
  motivationScore: number;
  /** 外驱依赖指数（5-7 原始均分，不反向，越高越依赖外部推动）。 */
  extDrive: number;
  /** 内驱水平指数（8-10 均分）。 */
  intDrive: number;
  lifeEventScore: number;
  lifeEventLevel: "正常" | "警戒" | "高风险";
  /** 心理红线提示。 */
  redFlags: string[];
  validity: {
    /** 连续 ≥8 题同一数值，疑似惯性作答。 */
    suspectInertia: boolean;
    /** 正反成对题同向差 ≥3 的矛盾作答描述。 */
    contradictions: string[];
  };
  /** 主卡点：按优先级链 条件→乐学→会学→善学→智学 找最低分红灯；无红灯为 null。 */
  mainBlock: E3V37MainBlock | null;
  /** 前三优先（九能 + 条件三格中分数最低的三项）。 */
  priorities: E3V37MainBlock[];
};

/* ------------------------------- 计分实现 ------------------------------- */

/** 能/系统/关注点阈值：≥3.8 正常（绿）/ ≥3.0 待提升（黄）/ <3.0 卡点（红）。 */
export function e3v37Level(score: number): E3V37Level {
  if (score >= 3.8) return "正常";
  if (score >= 3.0) return "待提升";
  return "卡点";
}

/** 百分制换算：(mean-1)/4*100。 */
export function e3v37Pct(mean: number): number {
  return Math.round(((mean - 1) / 4) * 100);
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** 正反成对题（同向差 ≥3 记矛盾作答）。 */
const E3V37_CONTRADICTION_PAIRS: [number, number][] = [
  [11, 12], [13, 14], [15, 16], [17, 18], [20, 21], [57, 58], [60, 61], [64, 65],
];

/**
 * 主卡点优先级链：条件 → 乐学 → 会学 → 善学 → 学能。
 * 注：「智学」仍是善学下的一能（参与九能与前三优先），仅链条末位表达为「学能」（取学能三项中最弱项）。
 */
const E3V37_MAIN_BLOCK_CHAIN = ["条件", "乐学", "会学", "善学", "学能"] as const;

const SYSTEM_LABEL: Record<string, string> = {
  乐学: "乐学（动力系统）",
  会学: "会学（方法系统）",
  善学: "善学（管理系统）",
};

export function scoreE3V37(input: E3V37Input): E3V37Result {
  const questions = E3V37_QUESTIONS[input.stage];
  if (input.ratings.length !== E3V37_RATING_COUNT) {
    throw new Error(`E3 V3.7 评分题数量应为 ${E3V37_RATING_COUNT}，实际 ${input.ratings.length}`);
  }
  if (input.lifeEvents.length !== E3V37_LIFE_EVENT_COUNT) {
    throw new Error(`E3 V3.7 生活事件数量应为 ${E3V37_LIFE_EVENT_COUNT}，实际 ${input.lifeEvents.length}`);
  }
  // adjusted[题号] = 换算后分数（反向题 6-x）
  const adjusted = new Map<number, number>();
  for (const q of questions) {
    const raw = input.ratings[q.no - 1];
    adjusted.set(q.no, q.reverse ? 6 - raw : raw);
  }
  const mean = (items: number[]) =>
    items.reduce((s, no) => s + (adjusted.get(no) ?? 0), 0) / items.length;
  const avg = (items: number[]) => round1(mean(items));

  // 关注点（kp）得分
  const focusOf = (def: E3V37FocusDef): E3V37Focus => {
    const score = avg(def.items);
    return { kp: def.kp, score, level: e3v37Level(score), items: def.items };
  };

  // 九能：能分 = 能力下题目（反向后）均分；任一关注点 ≤2.0 强制「卡点」
  const abilities: E3V37AbilityScore[] = E3V37_ABILITY_DEFS.map((def) => {
    const focuses = E3V37_FOCUS_DEFS.filter((f) => f.ability === def.label).map(focusOf);
    const score = avg(def.items);
    const level = focuses.some((f) => f.score <= 2.0) ? "卡点" : e3v37Level(score);
    return { key: def.key, label: def.label, system: def.system, score, level, focuses };
  });

  // 三阶系统分
  const coreSystems: E3V37SystemScore[] = E3V37_SYSTEM_ORDER.map((sys) => {
    const items = questions.filter((q) => q.system === sys).map((q) => q.no);
    const score = avg(items);
    return { key: sys, label: SYSTEM_LABEL[sys], score, level: e3v37Level(score) };
  });

  // 条件三格（不进总分）
  const condCells: E3V37SystemScore[] = E3V37_COND_DEFS.map((def) => {
    const score = avg(def.items);
    return { key: def.key, label: def.label, score, level: e3v37Level(score) };
  });

  // 学能三项（68/69/70 均反向）
  const aptitude: E3V37AptitudeScore[] = E3V37_APTITUDE_DEFS.map((def) => {
    const score = adjusted.get(def.item) ?? 0;
    return {
      key: def.key,
      label: def.label,
      score,
      level: e3v37Level(score),
      note: "反映当前加工效率，不是智力，也不代表潜力上限",
    };
  });

  const extDrive = round1([5, 6, 7].reduce((s, no) => s + input.ratings[no - 1], 0) / 3);
  const intDrive = avg([8, 9, 10]);

  const motivationScore = E3V37_MOTIVATION_SCORE[input.motivation];
  const motivationLabel =
    E3V37_MOTIVATION_OPTIONS.find((o) => o.key === input.motivation)?.label ?? input.motivation;

  const lifeEventScore = input.lifeEvents.reduce((s, v) => s + v, 0);
  const lifeEventLevel = lifeEventScore >= 8 ? "高风险" : lifeEventScore >= 4 ? "警戒" : "正常";

  const redFlags: string[] = [];
  if (input.ratings[54] >= 4) {
    redFlags.push("第55题（经常烦躁、低落或不想说话）原始分≥4：先多陪伴倾听、少谈成绩，必要时寻求专业心理帮助。");
  }
  if (input.ratings[55] >= 3) {
    redFlags.push("第56题（超过一半日子不想上学）原始分≥3：尽快了解背后的原因（人际/学业压力/情绪），不要只催学习。");
  }
  if (lifeEventScore >= 8 || input.lifeEvents.some((v) => v === 3)) {
    redFlags.push("生活事件冲击较大（总分≥8 或单项重度）：先做支持与稳定化，红线命中期间暂缓学业加压。");
  }

  // 作答有效性：连续 ≥8 题同一数值
  let suspectInertia = false;
  let run = 1;
  for (let i = 1; i < input.ratings.length; i++) {
    run = input.ratings[i] === input.ratings[i - 1] ? run + 1 : 1;
    if (run >= 8) { suspectInertia = true; break; }
  }
  // 正反成对题同向差 ≥3
  const contradictions: string[] = [];
  for (const [a, b] of E3V37_CONTRADICTION_PAIRS) {
    const sa = adjusted.get(a) ?? 0;
    const sb = adjusted.get(b) ?? 0;
    if (Math.abs(sa - sb) >= 3) {
      contradictions.push(
        `第${a}题与第${b}题（${E3V37_NO_TO_KP[a]}）作答方向差≥3（换算后 ${sa} vs ${sb}），疑似矛盾作答。`,
      );
    }
  }

  // 主卡点：条件（取三格最低分格）→ 乐学 → 会学 → 善学 → 学能（取三项最弱项），取最低分红灯
  const weakestCond = condCells.reduce((a, b) => (b.score < a.score ? b : a));
  const weakestAptitude = aptitude.reduce((a, b) => (b.score < a.score ? b : a));
  const chainCandidates: Record<(typeof E3V37_MAIN_BLOCK_CHAIN)[number], E3V37MainBlock> = {
    条件: { key: weakestCond.key, label: `条件·${weakestCond.label}`, score: weakestCond.score, level: weakestCond.level },
    乐学: { ...coreSystems[0], key: "乐学" },
    会学: { ...coreSystems[1], key: "会学" },
    善学: { ...coreSystems[2], key: "善学" },
    学能: { key: weakestAptitude.key, label: `学能·${weakestAptitude.label}`, score: weakestAptitude.score, level: weakestAptitude.level },
  };
  const redChain = E3V37_MAIN_BLOCK_CHAIN
    .map((k) => chainCandidates[k])
    .filter((c) => c.level === "卡点");
  const mainBlock = redChain.length
    ? redChain.reduce((a, b) => (b.score < a.score ? b : a))
    : null;

  // 前三优先：九能 + 条件三格，按分数升序取前三
  const priorityPool: E3V37MainBlock[] = [
    ...abilities.map((a) => ({ key: a.key, label: a.label, score: a.score, level: a.level })),
    ...condCells.map((c) => ({ key: c.key, label: `条件·${c.label}`, score: c.score, level: c.level })),
  ];
  const priorities = [...priorityPool].sort((a, b) => a.score - b.score).slice(0, 3);

  return {
    version: "3.7",
    stage: input.stage,
    stageLabel: E3V37_STAGE_LABEL[input.stage],
    abilities,
    systems: {
      core: coreSystems,
      condition: {
        key: "条件",
        label: "条件（支持系统）",
        cells: condCells,
        note: "条件系统单独报告，不进总分",
      },
    },
    aptitude,
    motivationKey: input.motivation,
    motivationLabel,
    motivationScore,
    extDrive,
    intDrive,
    lifeEventScore,
    lifeEventLevel,
    redFlags,
    validity: { suspectInertia, contradictions },
    mainBlock,
    priorities,
  };
}

/** 判断 V3.7（三阶九能）学生卷结果（类型守卫）。 */
export function isE3V37Result(r: unknown): r is E3V37Result {
  return !!r && typeof r === "object" && (r as { version?: string }).version === "3.7";
}

/* ------------------------- 逐题得分明细（报告附录表用） ------------------------- */

export type E3V37ItemScore = {
  no: number;
  kp: string;
  text: string;
  system: E3V37System;
  ability: E3V37Ability;
  /** 原始作答（1-5）。 */
  raw: number;
  /** 反向题换算后的有效分（1-5，越低越需关注）。 */
  score: number;
  level: E3V37Level;
};

/** 由原始作答计算 70 道评分题的逐题有效分（反向题 6-x），用于报告附录的逐题明细表。 */
export function scoreE3V37Items(stage: E3V37Stage, ratings: number[]): E3V37ItemScore[] {
  if (!Array.isArray(ratings) || ratings.length < E3V37_RATING_COUNT) return [];
  return E3V37_QUESTIONS[stage].map((q) => {
    const raw = ratings[q.no - 1];
    const score = q.reverse ? 6 - raw : raw;
    return {
      no: q.no,
      kp: q.kp,
      text: q.text,
      system: q.system,
      ability: q.ability,
      raw,
      score,
      level: e3v37Level(score),
    };
  });
}
