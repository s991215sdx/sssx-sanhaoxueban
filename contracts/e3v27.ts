/**
 * V2.7 五维优化版「学业诊断测评表」题库与计分器。
 * 内容严格对应附件《学业诊断测评表 V2.7（小学/初中/高中版）》，不得更改题干。
 * 计分规则以教练判读页为准：
 * - 正向题记 1-5 分；带 ▲ 的反向题按「6 - 圈选数」换算；
 * - 学习状态单选赋分 A=40, B=30, C=20, D=10, E=0, F=-10（A/B 视为兴趣在线）；
 * - 生活事件（74-81 题）0-3 直接累加，0-3 正常 / 4-7 警戒 / ≥8 高风险；
 * - 外驱依赖指数 = 5-7 题原始均分（不反向，越高越依赖外部推动）；内驱指数 = 8-11 题均分；
 * - 36-45 题全反向；49 题（AI 依赖）换算后并入 AI 自主学习维度；
 * - 常规维度阈值：均分 ≥4 正常 / 3.2-3.9 警戒 / <3.2 危险；反向后单题 ≤2 为明显短板；
 * - 心理红线：65 题原始分 ≥4；69 题原始分 ≥3；生活事件总分 ≥8 或任一单项 =3。
 */

export type E3V27Stage = "primary" | "junior" | "senior";
export const E3V27_STAGE_LABEL: Record<E3V27Stage, string> = {
  primary: "小学版", junior: "初中版", senior: "高中版",
};

export type E3V27DimKey = "乐学" | "会学" | "善学" | "品格" | "环境";

export type E3V27Question = {
  no: number;
  /** 考察点（如「主动性」「作业独立」）。 */
  kp: string;
  text: string;
  /** 反向题（计分时按 6 - 原值 换算）。 */
  reverse: boolean;
  dim: E3V27DimKey;
};

/** {"primary":"小学","junior":"初中","senior":"高中"}["primary"] 版：1-73 评分题 + 74-81 生活事件。 */
export const E3V27_QUESTIONS_PRIMARY: E3V27Question[] = [
  { no: 1, kp: "主动性", text: "即使没人督促，我也会主动开始学习", reverse: false, dim: "乐学" },
  { no: 2, kp: "主动性", text: "我认为好好学习是学生的本分和责任，不需要别人催促", reverse: false, dim: "乐学" },
  { no: 3, kp: "自我效能感", text: "我相信只要我好好学、方法对，我一定能学得很厉害", reverse: false, dim: "乐学" },
  { no: 4, kp: "自我效能感", text: "我经常觉得“学不学都那样”，再怎么努力也赶不上别人", reverse: true, dim: "乐学" },
  { no: 5, kp: "动力·外驱", text: "我努力学习，主要是为了不被父母或老师批评、惩罚", reverse: true, dim: "乐学" },
  { no: 6, kp: "动力·外驱", text: "有礼物、零花钱或游戏时间等奖励时，我才更有干劲", reverse: true, dim: "乐学" },
  { no: 7, kp: "动力·外驱", text: "老师表扬、同学认可或排名进步，是我学习的主要动力", reverse: true, dim: "乐学" },
  { no: 8, kp: "动力·内驱", text: "我认为现在学的知识和技能，对我将来的生活和工作有用", reverse: false, dim: "乐学" },
  { no: 9, kp: "动力·内驱", text: "我想通过学习成为更好的自己，而不只是为了考试和排名", reverse: false, dim: "乐学" },
  { no: 10, kp: "动力·内驱", text: "我希望将来能用所学知识帮助他人或为社会做贡献", reverse: false, dim: "乐学" },
  { no: 11, kp: "动力·内驱", text: "我有想考的学校或未来方向，学习是为了实现这个目标", reverse: false, dim: "乐学" },
  { no: 12, kp: "目标", text: "我清楚自己这学期要达到的目标（分数、排名或学校）", reverse: false, dim: "乐学" },
  { no: 13, kp: "目标", text: "我知道自己想上什么样的初中，知道它对成绩的大致要求", reverse: false, dim: "乐学" },
  { no: 14, kp: "预习质量", text: "课前我会预习，并带着疑问去听课", reverse: false, dim: "会学" },
  { no: 15, kp: "课堂标记", text: "上课听不懂的地方，我会在笔记上做标记", reverse: false, dim: "会学" },
  { no: 16, kp: "学习求助", text: "课后我会主动问老师、同学，或查找资料解决不懂的问题", reverse: false, dim: "会学" },
  { no: 17, kp: "笔记质量", text: "我做笔记能抓住重点，并用自己的话、图表或例子进行加工", reverse: false, dim: "会学" },
  { no: 18, kp: "作业独立", text: "作业我能独立、限时完成，不边做边翻书或直接看答案", reverse: false, dim: "会学" },
  { no: 19, kp: "作业闭环", text: "做完作业后，我会检查、订正，并简单总结哪里容易错", reverse: false, dim: "会学" },
  { no: 20, kp: "错题整理", text: "做错的题我会写清错因，明确考点和正确思路", reverse: false, dim: "会学" },
  { no: 21, kp: "错题重做", text: "错题我会隔几天重做，直到同类题不再错", reverse: false, dim: "会学" },
  { no: 22, kp: "复习节奏", text: "学完一个单元后我会及时复习，而不是攒到考前才突击", reverse: false, dim: "会学" },
  { no: 23, kp: "知识框架", text: "我会用思维导图、知识框架或专题总结，把零散内容整理成体系", reverse: false, dim: "会学" },
  { no: 24, kp: "表达输出", text: "学完一个内容后，我能不看书，用自己的话把它讲清楚", reverse: false, dim: "会学" },
  { no: 25, kp: "碎片利用", text: "我会利用碎片时间完成记背、订正或整理等小任务", reverse: false, dim: "会学" },
  { no: 26, kp: "学习整理", text: "我的资料、试卷、笔记和草稿基本分类清楚，需要时能快速找到", reverse: false, dim: "会学" },
  { no: 27, kp: "考试技巧", text: "考试时我能先易后难、合理分配时间，并留出检查时间", reverse: false, dim: "会学" },
  { no: 28, kp: "试卷分析", text: "考试后我会认真做试卷分析，找出失分原因，查漏补缺", reverse: false, dim: "会学" },
  { no: 29, kp: "计划执行", text: "我每天有明确的学习计划，并且大部分能完成", reverse: false, dim: "善学" },
  { no: 30, kp: "时间分配", text: "我能根据任务轻重和各科情况，合理安排学习时间", reverse: false, dim: "善学" },
  { no: 31, kp: "理解监控", text: "学完一段内容，我会问自己“我真的懂了吗”，而不只是“我看完了”", reverse: false, dim: "善学" },
  { no: 32, kp: "过程监控", text: "做题或考试时，我会边做边检查自己的思路是不是对的", reverse: false, dim: "善学" },
  { no: 33, kp: "方法调节", text: "我会定期回顾自己的学习效果，发现方法不合适时，主动调整和优化学习方法", reverse: false, dim: "善学" },
  { no: 34, kp: "复盘日记", text: "每天或每周，我会写复盘日记或学习小结，用它来优化自己的学习行为", reverse: false, dim: "善学" },
  { no: 35, kp: "策略调整", text: "每一次大考之后，我都会思考并调整自己的学习策略", reverse: false, dim: "善学" },
  { no: 36, kp: "细节感知", text: "阅读或看题时，我经常看错字、漏看条件，或抄写时错写、漏写", reverse: true, dim: "善学" },
  { no: 37, kp: "加工速度", text: "我理解新知识、解题或做作业的速度明显比同学慢", reverse: true, dim: "善学" },
  { no: 38, kp: "抑制控制", text: "学习时我很容易被声音、手机或杂念干扰，难以自控", reverse: true, dim: "善学" },
  { no: 39, kp: "注意稳定", text: "我很难连续30分钟集中精力做一件事，经常走神", reverse: true, dim: "善学" },
  { no: 40, kp: "注意广度", text: "听课或阅读时，我经常遗漏信息，同一时间内注意到的内容很少", reverse: true, dim: "善学" },
  { no: 41, kp: "工作记忆", text: "刚背过的课文、单词或公式，我很快就回忆不起来", reverse: true, dim: "善学" },
  { no: 42, kp: "空间能力", text: "面对几何、图形或空间方位题时，我很难想象出结构", reverse: true, dim: "善学" },
  { no: 43, kp: "思维能力", text: "遇到难题或新题型时，我常不知道从哪里分析，难以举一反三", reverse: true, dim: "善学" },
  { no: 44, kp: "语言能力", text: "说话或写作时，我经常感觉词不达意，说不清楚自己的想法", reverse: true, dim: "善学" },
  { no: 45, kp: "计算能力", text: "计算时我经常出错，或做计算题特别吃力、速度慢", reverse: true, dim: "善学" },
  { no: 46, kp: "AI·会用", text: "遇到不懂的问题，我会用AI工具（如学习机、AI辅导App）帮助自己弄明白", reverse: false, dim: "善学" },
  { no: 47, kp: "AI·会问", text: "我能向AI清楚地描述问题、追问细节，而不是只发一句“这题怎么做”", reverse: false, dim: "善学" },
  { no: 48, kp: "AI·会辨", text: "我会核对AI给出的答案和讲解，发现不对时会质疑，而不是直接照抄", reverse: false, dim: "善学" },
  { no: 49, kp: "AI·依赖", text: "没有AI或手机帮忙，我就很难独立完成学习任务", reverse: true, dim: "善学" },
  { no: 50, kp: "抗逆退缩", text: "遇到困难或失败时，我的第一反应是退缩、逃避或觉得自己不行", reverse: true, dim: "品格" },
  { no: 51, kp: "抗挫恢复", text: "考试失利或遇到挫折后，我能在1—2天内调整状态、重新投入", reverse: false, dim: "品格" },
  { no: 52, kp: "情绪失控", text: "我经常因为一点小事情绪失控，对同学或家人发火", reverse: true, dim: "品格" },
  { no: 53, kp: "情绪觉察", text: "我能觉察自己的情绪，并知道怎样让自己平静下来", reverse: false, dim: "品格" },
  { no: 54, kp: "积极情绪", text: "我感到生活中值得开心和感恩的事情挺多", reverse: false, dim: "品格" },
  { no: 55, kp: "人际沟通", text: "与老师、同学发生冲突时，我能通过沟通解决，而不是攻击或冷战", reverse: false, dim: "品格" },
  { no: 56, kp: "社会支持", text: "遇到压力时，我有可以倾诉和求助的人（家人、朋友或老师）", reverse: false, dim: "品格" },
  { no: 57, kp: "反思改进", text: "我经常反思自己哪里可以做得更好，尽量避免重复犯错", reverse: false, dim: "品格" },
  { no: 58, kp: "成长信念", text: "我觉得一个人的能力和智商基本固定，再努力也很难改变", reverse: true, dim: "品格" },
  { no: 59, kp: "自我接纳", text: "我总是拿自己的短处和别人的长处比，觉得自己不如别人", reverse: true, dim: "品格" },
  { no: 60, kp: "规则感", text: "共同约定好的学习规则（如手机使用、作业时间），我能稳定遵守，不需要反复提醒", reverse: false, dim: "品格" },
  { no: 61, kp: "睡眠状态", text: "我最近一个月睡眠规律，每天能睡够9—10小时", reverse: false, dim: "环境" },
  { no: 62, kp: "运动放松", text: "我每周有固定的运动或放松时间", reverse: false, dim: "环境" },
  { no: 63, kp: "校园关系", text: "我在学校和老师、同学的关系总体是舒服的", reverse: false, dim: "环境" },
  { no: 64, kp: "情绪恢复", text: "不愉快的事不会让我烦恼很长时间", reverse: false, dim: "环境" },
  { no: 65, kp: "低落风险", text: "我最近经常感到烦躁、低落或不想说话", reverse: true, dim: "环境" },
  { no: 66, kp: "家庭压力", text: "家里对我学习的管教方式让我觉得压力很大", reverse: true, dim: "环境" },
  { no: 67, kp: "熬夜状态", text: "我经常熬夜学习或玩手机，白天没精神", reverse: true, dim: "环境" },
  { no: 68, kp: "手机冲突", text: "手机或游戏让我和家人发生过冲突", reverse: true, dim: "环境" },
  { no: 69, kp: "上学意愿", text: "最近一个月，我有超过一半的日子不想上学", reverse: true, dim: "环境" },
  { no: 70, kp: "白天精力", text: "我白天经常感觉疲惫、没精神，学习时提不起劲", reverse: true, dim: "环境" },
  { no: 71, kp: "同伴圈影响", text: "我身边的朋友或同学，会常和我一起谈论学习，促进我学习", reverse: false, dim: "环境" },
  { no: 72, kp: "老师影响", text: "现在我有不喜欢的老师，比较严重的影响了我这科的学习", reverse: true, dim: "环境" },
  { no: 73, kp: "父母支持", text: "父母和我谈学习时，情绪是稳定的，更多是理解、支持和一起想办法", reverse: false, dim: "环境" },
  { no: 74, kp: "考试挫折", text: "考试失败或成绩大幅下滑", reverse: false, dim: "环境" },
  { no: 75, kp: "师生冲突", text: "被老师批评或当众否定", reverse: false, dim: "环境" },
  { no: 76, kp: "同伴矛盾", text: "与同学或好友发生严重矛盾", reverse: false, dim: "环境" },
  { no: 77, kp: "人际困扰", text: "和同学闹矛盾，或被同学孤立", reverse: false, dim: "环境" },
  { no: 78, kp: "家庭矛盾", text: "家庭内部矛盾、父母争吵", reverse: false, dim: "环境" },
  { no: 79, kp: "家庭变化", text: "父母工作变动或家庭成员变动", reverse: false, dim: "环境" },
  { no: 80, kp: "环境变化", text: "搬家、转学、换班或换老师", reverse: false, dim: "环境" },
  { no: 81, kp: "身体状态", text: "身体疾病、受伤或长期疲劳", reverse: false, dim: "环境" },
];

/** {"primary":"小学","junior":"初中","senior":"高中"}["junior"] 版：1-73 评分题 + 74-81 生活事件。 */
export const E3V27_QUESTIONS_JUNIOR: E3V27Question[] = [
  { no: 1, kp: "主动性", text: "即使没人督促，我也会主动开始学习", reverse: false, dim: "乐学" },
  { no: 2, kp: "主动性", text: "我认为好好学习是学生的本分和责任，不需要别人催促", reverse: false, dim: "乐学" },
  { no: 3, kp: "自我效能感", text: "我相信只要我好好学、方法对，我一定能学得很厉害", reverse: false, dim: "乐学" },
  { no: 4, kp: "自我效能感", text: "我经常觉得“学不学都那样”，再怎么努力也赶不上别人", reverse: true, dim: "乐学" },
  { no: 5, kp: "动力·外驱", text: "我努力学习，主要是为了不被父母或老师批评、惩罚", reverse: true, dim: "乐学" },
  { no: 6, kp: "动力·外驱", text: "有礼物、零花钱或游戏时间等奖励时，我才更有干劲", reverse: true, dim: "乐学" },
  { no: 7, kp: "动力·外驱", text: "老师表扬、同学认可或排名进步，是我学习的主要动力", reverse: true, dim: "乐学" },
  { no: 8, kp: "动力·内驱", text: "我认为现在学的知识和技能，对我将来的生活和工作有用", reverse: false, dim: "乐学" },
  { no: 9, kp: "动力·内驱", text: "我想通过学习成为更好的自己，而不只是为了考试和排名", reverse: false, dim: "乐学" },
  { no: 10, kp: "动力·内驱", text: "我希望将来能用所学知识帮助他人或为社会做贡献", reverse: false, dim: "乐学" },
  { no: 11, kp: "动力·内驱", text: "我有想考的学校或未来方向，学习是为了实现这个目标", reverse: false, dim: "乐学" },
  { no: 12, kp: "目标", text: "我清楚自己这学期要达到的目标（分数、排名或学校）", reverse: false, dim: "乐学" },
  { no: 13, kp: "目标", text: "我了解目标高中对成绩和能力的要求", reverse: false, dim: "乐学" },
  { no: 14, kp: "预习质量", text: "课前我会预习，并带着疑问去听课", reverse: false, dim: "会学" },
  { no: 15, kp: "课堂标记", text: "上课听不懂的地方，我会在笔记上做标记", reverse: false, dim: "会学" },
  { no: 16, kp: "学习求助", text: "课后我会主动问老师、同学，或查找资料解决不懂的问题", reverse: false, dim: "会学" },
  { no: 17, kp: "笔记质量", text: "我做笔记能抓住重点，并用自己的话、图表或例子进行加工", reverse: false, dim: "会学" },
  { no: 18, kp: "作业独立", text: "作业我能独立、限时完成，不边做边翻书或直接看答案", reverse: false, dim: "会学" },
  { no: 19, kp: "作业闭环", text: "做完作业后，我会检查、订正，并简单总结哪里容易错", reverse: false, dim: "会学" },
  { no: 20, kp: "错题整理", text: "做错的题我会写清错因，明确考点和正确思路", reverse: false, dim: "会学" },
  { no: 21, kp: "错题重做", text: "错题我会隔几天重做，直到同类题不再错", reverse: false, dim: "会学" },
  { no: 22, kp: "复习节奏", text: "学完一个单元后我会及时复习，而不是攒到考前才突击", reverse: false, dim: "会学" },
  { no: 23, kp: "知识框架", text: "我会用思维导图、知识框架或专题总结，把零散内容整理成体系", reverse: false, dim: "会学" },
  { no: 24, kp: "表达输出", text: "学完一个内容后，我能不看书，用自己的话把它讲清楚", reverse: false, dim: "会学" },
  { no: 25, kp: "碎片利用", text: "我会利用碎片时间完成记背、订正或整理等小任务", reverse: false, dim: "会学" },
  { no: 26, kp: "学习整理", text: "我的资料、试卷、笔记和草稿基本分类清楚，需要时能快速找到", reverse: false, dim: "会学" },
  { no: 27, kp: "考试技巧", text: "考试时我能先易后难、合理分配时间，并留出检查时间", reverse: false, dim: "会学" },
  { no: 28, kp: "试卷分析", text: "考试后我会认真做试卷分析，找出失分原因，查漏补缺", reverse: false, dim: "会学" },
  { no: 29, kp: "计划执行", text: "我每天有明确的学习计划，并且大部分能完成", reverse: false, dim: "善学" },
  { no: 30, kp: "时间分配", text: "我能根据任务轻重和各科情况，合理安排学习时间", reverse: false, dim: "善学" },
  { no: 31, kp: "理解监控", text: "学完一段内容，我会问自己“我真的懂了吗”，而不只是“我看完了”", reverse: false, dim: "善学" },
  { no: 32, kp: "过程监控", text: "做题或考试时，我会边做边检查自己的思路是不是对的", reverse: false, dim: "善学" },
  { no: 33, kp: "方法调节", text: "我会定期回顾自己的学习效果，发现方法不合适时，主动调整和优化学习方法", reverse: false, dim: "善学" },
  { no: 34, kp: "复盘日记", text: "每天或每周，我会写复盘日记或学习小结，用它来优化自己的学习行为", reverse: false, dim: "善学" },
  { no: 35, kp: "策略调整", text: "每一次大考之后，我都会思考并调整自己的学习策略", reverse: false, dim: "善学" },
  { no: 36, kp: "细节感知", text: "阅读或看题时，我经常看错字、漏看条件，或抄写时错写、漏写", reverse: true, dim: "善学" },
  { no: 37, kp: "加工速度", text: "我理解新知识、解题或做作业的速度明显比同学慢", reverse: true, dim: "善学" },
  { no: 38, kp: "抑制控制", text: "学习时我很容易被声音、手机或杂念干扰，难以自控", reverse: true, dim: "善学" },
  { no: 39, kp: "注意稳定", text: "我很难连续30分钟集中精力做一件事，经常走神", reverse: true, dim: "善学" },
  { no: 40, kp: "注意广度", text: "听课或阅读时，我经常遗漏信息，同一时间内注意到的内容很少", reverse: true, dim: "善学" },
  { no: 41, kp: "工作记忆", text: "刚背过的课文、单词或公式，我很快就回忆不起来", reverse: true, dim: "善学" },
  { no: 42, kp: "空间能力", text: "面对几何、图形或空间方位题时，我很难想象出结构", reverse: true, dim: "善学" },
  { no: 43, kp: "思维能力", text: "遇到难题或新题型时，我常不知道从哪里分析，难以举一反三", reverse: true, dim: "善学" },
  { no: 44, kp: "语言能力", text: "说话或写作时，我经常感觉词不达意，说不清楚自己的想法", reverse: true, dim: "善学" },
  { no: 45, kp: "计算能力", text: "计算时我经常出错，或做计算题特别吃力、速度慢", reverse: true, dim: "善学" },
  { no: 46, kp: "AI·会用", text: "遇到不懂的问题，我会用AI工具（答疑、讲解、出练习等）帮助自己弄明白", reverse: false, dim: "善学" },
  { no: 47, kp: "AI·会问", text: "我能向AI清楚地描述问题、追问细节，而不是只发一句“这题怎么做”", reverse: false, dim: "善学" },
  { no: 48, kp: "AI·会辨", text: "我会核对AI给出的答案和讲解，发现不对时会质疑，而不是直接照抄", reverse: false, dim: "善学" },
  { no: 49, kp: "AI·依赖", text: "没有AI或手机帮忙，我就很难独立完成学习任务", reverse: true, dim: "善学" },
  { no: 50, kp: "抗逆退缩", text: "遇到困难或失败时，我的第一反应是退缩、逃避或觉得自己不行", reverse: true, dim: "品格" },
  { no: 51, kp: "抗挫恢复", text: "考试失利或遇到挫折后，我能在1—2天内调整状态、重新投入", reverse: false, dim: "品格" },
  { no: 52, kp: "情绪失控", text: "我经常因为一点小事情绪失控，对同学或家人发火", reverse: true, dim: "品格" },
  { no: 53, kp: "情绪觉察", text: "我能觉察自己的情绪，并知道怎样让自己平静下来", reverse: false, dim: "品格" },
  { no: 54, kp: "积极情绪", text: "我感到生活中值得开心和感恩的事情挺多", reverse: false, dim: "品格" },
  { no: 55, kp: "人际沟通", text: "与老师、同学发生冲突时，我能通过沟通解决，而不是攻击或冷战", reverse: false, dim: "品格" },
  { no: 56, kp: "社会支持", text: "遇到压力时，我有可以倾诉和求助的人（家人、朋友或老师）", reverse: false, dim: "品格" },
  { no: 57, kp: "反思改进", text: "我经常反思自己哪里可以做得更好，尽量避免重复犯错", reverse: false, dim: "品格" },
  { no: 58, kp: "成长信念", text: "我觉得一个人的能力和智商基本固定，再努力也很难改变", reverse: true, dim: "品格" },
  { no: 59, kp: "自我接纳", text: "我总是拿自己的短处和别人的长处比，觉得自己不如别人", reverse: true, dim: "品格" },
  { no: 60, kp: "规则感", text: "共同约定好的学习规则（如手机使用、作业时间），我能稳定遵守，不需要反复提醒", reverse: false, dim: "品格" },
  { no: 61, kp: "睡眠状态", text: "我最近一个月睡眠规律，每天能睡够8—9小时", reverse: false, dim: "环境" },
  { no: 62, kp: "运动放松", text: "我每周有固定的运动或放松时间", reverse: false, dim: "环境" },
  { no: 63, kp: "校园关系", text: "我在学校和老师、同学的关系总体是舒服的", reverse: false, dim: "环境" },
  { no: 64, kp: "情绪恢复", text: "不愉快的事不会让我烦恼很长时间", reverse: false, dim: "环境" },
  { no: 65, kp: "低落风险", text: "我最近经常感到烦躁、低落或不想说话", reverse: true, dim: "环境" },
  { no: 66, kp: "家庭压力", text: "家里对我学习的管教方式让我觉得压力很大", reverse: true, dim: "环境" },
  { no: 67, kp: "熬夜状态", text: "我经常熬夜学习或玩手机，白天没精神", reverse: true, dim: "环境" },
  { no: 68, kp: "手机冲突", text: "手机或游戏让我和家人发生过冲突", reverse: true, dim: "环境" },
  { no: 69, kp: "上学意愿", text: "最近一个月，我有超过一半的日子不想上学", reverse: true, dim: "环境" },
  { no: 70, kp: "白天精力", text: "我白天经常感觉疲惫、没精神，学习时提不起劲", reverse: true, dim: "环境" },
  { no: 71, kp: "同伴圈影响", text: "我身边的朋友或同学，会常和我一起谈论学习，促进我学习", reverse: false, dim: "环境" },
  { no: 72, kp: "老师影响", text: "现在我有不喜欢的老师，比较严重的影响了我这科的学习", reverse: true, dim: "环境" },
  { no: 73, kp: "父母支持", text: "父母和我谈学习时，情绪是稳定的，更多是理解、支持和一起想办法", reverse: false, dim: "环境" },
  { no: 74, kp: "考试挫折", text: "考试失败或成绩大幅下滑", reverse: false, dim: "环境" },
  { no: 75, kp: "师生冲突", text: "被老师批评或当众否定", reverse: false, dim: "环境" },
  { no: 76, kp: "同伴矛盾", text: "与同学或好友发生严重矛盾", reverse: false, dim: "环境" },
  { no: 77, kp: "人际困扰", text: "恋爱困扰或人际孤立", reverse: false, dim: "环境" },
  { no: 78, kp: "家庭矛盾", text: "家庭内部矛盾、父母争吵", reverse: false, dim: "环境" },
  { no: 79, kp: "家庭变化", text: "父母工作变动或家庭成员变动", reverse: false, dim: "环境" },
  { no: 80, kp: "环境变化", text: "搬家、转学、换班或换老师", reverse: false, dim: "环境" },
  { no: 81, kp: "身体状态", text: "身体疾病、受伤或长期疲劳", reverse: false, dim: "环境" },
];

/** {"primary":"小学","junior":"初中","senior":"高中"}["senior"] 版：1-73 评分题 + 74-81 生活事件。 */
export const E3V27_QUESTIONS_SENIOR: E3V27Question[] = [
  { no: 1, kp: "主动性", text: "即使没人督促，我也会主动开始学习", reverse: false, dim: "乐学" },
  { no: 2, kp: "主动性", text: "我认为好好学习是学生的本分和责任，不需要别人催促", reverse: false, dim: "乐学" },
  { no: 3, kp: "自我效能感", text: "我相信只要我好好学、方法对，我一定能学得很厉害", reverse: false, dim: "乐学" },
  { no: 4, kp: "自我效能感", text: "我经常觉得“学不学都那样”，再怎么努力也赶不上别人", reverse: true, dim: "乐学" },
  { no: 5, kp: "动力·外驱", text: "我努力学习，主要是为了不被父母或老师批评、惩罚", reverse: true, dim: "乐学" },
  { no: 6, kp: "动力·外驱", text: "有礼物、零花钱或游戏时间等奖励时，我才更有干劲", reverse: true, dim: "乐学" },
  { no: 7, kp: "动力·外驱", text: "老师表扬、同学认可或排名进步，是我学习的主要动力", reverse: true, dim: "乐学" },
  { no: 8, kp: "动力·内驱", text: "我认为现在学的知识和技能，对我将来的生活和工作有用", reverse: false, dim: "乐学" },
  { no: 9, kp: "动力·内驱", text: "我想通过学习成为更好的自己，而不只是为了考试和排名", reverse: false, dim: "乐学" },
  { no: 10, kp: "动力·内驱", text: "我希望将来能用所学知识帮助他人或为社会做贡献", reverse: false, dim: "乐学" },
  { no: 11, kp: "动力·内驱", text: "我有想考的学校或未来方向，学习是为了实现这个目标", reverse: false, dim: "乐学" },
  { no: 12, kp: "目标", text: "我清楚自己这学期要达到的目标（分数、排名或学校）", reverse: false, dim: "乐学" },
  { no: 13, kp: "目标", text: "我了解目标大学、专业或未来方向对成绩和能力的要求", reverse: false, dim: "乐学" },
  { no: 14, kp: "预习质量", text: "课前我会预习，并带着疑问去听课", reverse: false, dim: "会学" },
  { no: 15, kp: "课堂标记", text: "上课听不懂的地方，我会在笔记上做标记", reverse: false, dim: "会学" },
  { no: 16, kp: "学习求助", text: "课后我会主动问老师、同学，或查找资料解决不懂的问题", reverse: false, dim: "会学" },
  { no: 17, kp: "笔记质量", text: "我做笔记能抓住重点，并用自己的话、图表或例子进行加工", reverse: false, dim: "会学" },
  { no: 18, kp: "作业独立", text: "作业我能独立、限时完成，不边做边翻书或直接看答案", reverse: false, dim: "会学" },
  { no: 19, kp: "作业闭环", text: "做完作业后，我会检查、订正，并简单总结哪里容易错", reverse: false, dim: "会学" },
  { no: 20, kp: "错题整理", text: "做错的题我会写清错因，明确考点和正确思路", reverse: false, dim: "会学" },
  { no: 21, kp: "错题重做", text: "错题我会隔几天重做，直到同类题不再错", reverse: false, dim: "会学" },
  { no: 22, kp: "复习节奏", text: "学完一个单元后我会及时复习，而不是攒到考前才突击", reverse: false, dim: "会学" },
  { no: 23, kp: "知识框架", text: "我会用思维导图、知识框架或专题总结，把零散内容整理成体系", reverse: false, dim: "会学" },
  { no: 24, kp: "表达输出", text: "学完一个内容后，我能不看书，用自己的话把它讲清楚", reverse: false, dim: "会学" },
  { no: 25, kp: "碎片利用", text: "我会利用碎片时间完成记背、订正或整理等小任务", reverse: false, dim: "会学" },
  { no: 26, kp: "学习整理", text: "我的资料、试卷、笔记和草稿基本分类清楚，需要时能快速找到", reverse: false, dim: "会学" },
  { no: 27, kp: "考试技巧", text: "考试时我能先易后难、合理分配时间，并留出检查时间", reverse: false, dim: "会学" },
  { no: 28, kp: "试卷分析", text: "考试后我会认真做试卷分析，找出失分原因，查漏补缺", reverse: false, dim: "会学" },
  { no: 29, kp: "计划执行", text: "我每天有明确的学习计划，并且大部分能完成", reverse: false, dim: "善学" },
  { no: 30, kp: "时间分配", text: "我能根据任务轻重和各科情况，合理安排学习时间", reverse: false, dim: "善学" },
  { no: 31, kp: "理解监控", text: "学完一段内容，我会问自己“我真的懂了吗”，而不只是“我看完了”", reverse: false, dim: "善学" },
  { no: 32, kp: "过程监控", text: "做题或考试时，我会边做边检查自己的思路是不是对的", reverse: false, dim: "善学" },
  { no: 33, kp: "方法调节", text: "我会定期回顾自己的学习效果，发现方法不合适时，主动调整和优化学习方法", reverse: false, dim: "善学" },
  { no: 34, kp: "复盘日记", text: "每天或每周，我会写复盘日记或学习小结，用它来优化自己的学习行为", reverse: false, dim: "善学" },
  { no: 35, kp: "策略调整", text: "每一次大考之后，我都会思考并调整自己的学习策略", reverse: false, dim: "善学" },
  { no: 36, kp: "细节感知", text: "阅读或看题时，我经常看错字、漏看条件，或抄写时错写、漏写", reverse: true, dim: "善学" },
  { no: 37, kp: "加工速度", text: "我理解新知识、解题或做作业的速度明显比同学慢", reverse: true, dim: "善学" },
  { no: 38, kp: "抑制控制", text: "学习时我很容易被声音、手机或杂念干扰，难以自控", reverse: true, dim: "善学" },
  { no: 39, kp: "注意稳定", text: "我很难连续30分钟集中精力做一件事，经常走神", reverse: true, dim: "善学" },
  { no: 40, kp: "注意广度", text: "听课或阅读时，我经常遗漏信息，同一时间内注意到的内容很少", reverse: true, dim: "善学" },
  { no: 41, kp: "工作记忆", text: "刚背过的课文、单词或公式，我很快就回忆不起来", reverse: true, dim: "善学" },
  { no: 42, kp: "空间能力", text: "面对几何、图形或空间方位题时，我很难想象出结构", reverse: true, dim: "善学" },
  { no: 43, kp: "思维能力", text: "遇到难题或新题型时，我常不知道从哪里分析，难以举一反三", reverse: true, dim: "善学" },
  { no: 44, kp: "语言能力", text: "说话或写作时，我经常感觉词不达意，说不清楚自己的想法", reverse: true, dim: "善学" },
  { no: 45, kp: "计算能力", text: "计算时我经常出错，或做计算题特别吃力、速度慢", reverse: true, dim: "善学" },
  { no: 46, kp: "AI·会用", text: "遇到不懂的问题，我会用AI工具（答疑、讲解、出练习等）帮助自己弄明白", reverse: false, dim: "善学" },
  { no: 47, kp: "AI·会问", text: "我能向AI清楚地描述问题、追问细节，而不是只发一句“这题怎么做”", reverse: false, dim: "善学" },
  { no: 48, kp: "AI·会辨", text: "我会核对AI给出的答案和讲解，发现不对时会质疑，而不是直接照抄", reverse: false, dim: "善学" },
  { no: 49, kp: "AI·依赖", text: "没有AI或手机帮忙，我就很难独立完成学习任务", reverse: true, dim: "善学" },
  { no: 50, kp: "抗逆退缩", text: "遇到困难或失败时，我的第一反应是退缩、逃避或觉得自己不行", reverse: true, dim: "品格" },
  { no: 51, kp: "抗挫恢复", text: "考试失利或遇到挫折后，我能在1—2天内调整状态、重新投入", reverse: false, dim: "品格" },
  { no: 52, kp: "情绪失控", text: "我经常因为一点小事情绪失控，对同学或家人发火", reverse: true, dim: "品格" },
  { no: 53, kp: "情绪觉察", text: "我能觉察自己的情绪，并知道怎样让自己平静下来", reverse: false, dim: "品格" },
  { no: 54, kp: "积极情绪", text: "我感到生活中值得开心和感恩的事情挺多", reverse: false, dim: "品格" },
  { no: 55, kp: "人际沟通", text: "与老师、同学发生冲突时，我能通过沟通解决，而不是攻击或冷战", reverse: false, dim: "品格" },
  { no: 56, kp: "社会支持", text: "遇到压力时，我有可以倾诉和求助的人（家人、朋友或老师）", reverse: false, dim: "品格" },
  { no: 57, kp: "反思改进", text: "我经常反思自己哪里可以做得更好，尽量避免重复犯错", reverse: false, dim: "品格" },
  { no: 58, kp: "成长信念", text: "我觉得一个人的能力和智商基本固定，再努力也很难改变", reverse: true, dim: "品格" },
  { no: 59, kp: "自我接纳", text: "我总是拿自己的短处和别人的长处比，觉得自己不如别人", reverse: true, dim: "品格" },
  { no: 60, kp: "规则感", text: "共同约定好的学习规则（如手机使用、作业时间），我能稳定遵守，不需要反复提醒", reverse: false, dim: "品格" },
  { no: 61, kp: "睡眠状态", text: "我最近一个月睡眠规律，每天能睡够7—8小时", reverse: false, dim: "环境" },
  { no: 62, kp: "运动放松", text: "我每周有固定的运动或放松时间", reverse: false, dim: "环境" },
  { no: 63, kp: "校园关系", text: "我在学校和老师、同学的关系总体是舒服的", reverse: false, dim: "环境" },
  { no: 64, kp: "情绪恢复", text: "不愉快的事不会让我烦恼很长时间", reverse: false, dim: "环境" },
  { no: 65, kp: "低落风险", text: "我最近经常感到烦躁、低落或不想说话", reverse: true, dim: "环境" },
  { no: 66, kp: "家庭压力", text: "家里对我学习的管教方式让我觉得压力很大", reverse: true, dim: "环境" },
  { no: 67, kp: "熬夜状态", text: "我经常熬夜学习或玩手机，白天没精神", reverse: true, dim: "环境" },
  { no: 68, kp: "手机冲突", text: "手机或游戏让我和家人发生过冲突", reverse: true, dim: "环境" },
  { no: 69, kp: "上学意愿", text: "最近一个月，我有超过一半的日子不想上学", reverse: true, dim: "环境" },
  { no: 70, kp: "白天精力", text: "我白天经常感觉疲惫、没精神，学习时提不起劲", reverse: true, dim: "环境" },
  { no: 71, kp: "同伴圈影响", text: "我身边的朋友或同学，会常和我一起谈论学习，促进我学习", reverse: false, dim: "环境" },
  { no: 72, kp: "老师影响", text: "现在我有不喜欢的老师，比较严重的影响了我这科的学习", reverse: true, dim: "环境" },
  { no: 73, kp: "父母支持", text: "父母和我谈学习时，情绪是稳定的，更多是理解、支持和一起想办法", reverse: false, dim: "环境" },
  { no: 74, kp: "考试挫折", text: "考试失败或成绩大幅下滑", reverse: false, dim: "环境" },
  { no: 75, kp: "师生冲突", text: "被老师批评或当众否定", reverse: false, dim: "环境" },
  { no: 76, kp: "同伴矛盾", text: "与同学或好友发生严重矛盾", reverse: false, dim: "环境" },
  { no: 77, kp: "人际困扰", text: "恋爱困扰或人际孤立", reverse: false, dim: "环境" },
  { no: 78, kp: "家庭矛盾", text: "家庭内部矛盾、父母争吵", reverse: false, dim: "环境" },
  { no: 79, kp: "家庭变化", text: "父母工作变动或家庭成员变动", reverse: false, dim: "环境" },
  { no: 80, kp: "环境变化", text: "搬家、转学、换班或换老师", reverse: false, dim: "环境" },
  { no: 81, kp: "身体状态", text: "身体疾病、受伤或长期疲劳", reverse: false, dim: "环境" },
];

export const E3V27_QUESTIONS: Record<E3V27Stage, E3V27Question[]> = {
  primary: E3V27_QUESTIONS_PRIMARY, junior: E3V27_QUESTIONS_JUNIOR, senior: E3V27_QUESTIONS_SENIOR,
};

/** 评分题（1-73）；74-81 为生活事件（0-3 分）。 */
export const E3V27_RATING_COUNT = 73;
export const E3V27_LIFE_EVENT_COUNT = 8;/* ------------------------------ 学习状态单选 ------------------------------ */

export type E3MotivationKey = "A" | "B" | "C" | "D" | "E" | "F";

export const E3V27_MOTIVATION_OPTIONS: { key: E3MotivationKey; label: string; text: string }[] = [
  { key: "A", label: "乐在其中", text: "我享受学习的过程，不觉得痛苦" },
  { key: "B", label: "兴趣驱动", text: "我喜欢学习和研究问题，愿意主动钻研" },
  { key: "C", label: "目标坚持", text: "我愿意为了目标而学习，能坚持下来" },
  { key: "D", label: "勉强维持", text: "我在勉强学习，经常感到疲惫" },
  { key: "E", label: "应付敷衍", text: "我在应付学习，做一天和尚撞一天钟" },
  { key: "F", label: "抵触反抗", text: "我在反抗学习，经常抵触和逃避" },
];

export const E3V27_MOTIVATION_SCORE: Record<E3MotivationKey, number> = {
  A: 40, B: 30, C: 20, D: 10, E: 0, F: -10,
};

/* ------------------------------- 学科快扫 ------------------------------- */

export const E3V27_SCAN_ASPECTS = ["知识掌握", "解题能力", "考试发挥", "学科态度"] as const;
export type E3V27ScanAspect = (typeof E3V27_SCAN_ASPECTS)[number];

/** 各学段学科快扫科目（「其他/最弱一科」为学生自填）。 */
export const E3V27_SCAN_SUBJECTS: Record<E3V27Stage, string[]> = {
  primary: ["语文", "数学", "英语", "科学", "道德与法治"],
  junior: ["语文", "数学", "英语", "物理", "化学"],
  senior: ["语文", "数学", "英语", "首选科目（物理/历史）", "再选科目一", "再选科目二"],
};

export type E3V27SubjectScan = {
  /** 科目名（固定科目或自填科目）。 */
  name: string;
  mastery: number;
  solving: number;
  exam: number;
  attitude: number;
  /** 最薄弱环节（章节、题型或原因），可空。 */
  weakest: string;
};

export const E3V27_LOSS_REASONS = [
  "知识盲区", "审题失误", "计算/书写粗心", "时间不够", "考场紧张", "题型陌生", "其他",
] as const;

export const E3V27_SCORE_TRENDS = ["持续上升", "基本稳定", "波动较大", "持续下滑"] as const;
export type E3V27ScoreTrend = (typeof E3V27_SCORE_TRENDS)[number] | "";

/* ------------------------------- 开放题 ------------------------------- */

export const E3V27_OPEN_QUESTIONS: string[] = [
  "现在学习中最难、最烦的一件事是什么？",
  "如果接下来一个月只能改变一件事，你最想改变什么？",
  "半年后，你希望自己变成什么样？",
];

/* ------------------------------- 输入输出 ------------------------------- */

export type E3V27Input = {
  stage: E3V27Stage;
  /** 73 道评分题（1-5）。 */
  ratings: number[];
  motivation: E3MotivationKey;
  /** 学科快扫（未开设的科目四项记 0）。 */
  subjects: E3V27SubjectScan[];
  lossReasons: string[];
  scoreTrend: E3V27ScoreTrend;
  /** 8 道生活事件（0-3）。 */
  lifeEvents: number[];
  openAnswers: string[];
};

export type E3Level = "正常" | "警戒" | "危险";

export type E3V27Dim = { key: E3V27DimKey; label: string; score: number; level: E3Level };

export type E3V27Subscale = {
  key: string;
  label: string;
  dim: E3V27DimKey;
  score: number;
  level: E3Level;
  /** 额外说明（如外驱「依赖偏高」语义相反）。 */
  note?: string;
};

export type E3V27Weakness = { no: number; kp: string; text: string; score: number };

export type E3V27RouteCategory = "D" | "X" | "P" | "N" | "S";

export type E3V27Route = {
  issue: string;
  /** 二级观察点/触发条件描述。 */
  trigger: string;
  /** 优先承接动作（训练路由速查原文）。 */
  action: string;
  category: E3V27RouteCategory;
};

export type E3V27Result = {
  version: "v27";
  stage: E3V27Stage;
  stageLabel: string;
  /** 五维均分与判定。 */
  dims: E3V27Dim[];
  /** 二级观察点（13 项）。 */
  subscales: E3V27Subscale[];
  /** 反向后单题 ≤2 的明显短板。 */
  weaknesses: E3V27Weakness[];
  /** 外驱依赖指数（5-7 原始均分，≥3.5 为依赖偏高）。 */
  extDrive: number;
  extDriveHigh: boolean;
  /** 内驱水平指数（8-11 均分）。 */
  intDrive: number;
  intDriveLevel: E3Level;
  motivationKey: E3MotivationKey;
  motivationLabel: string;
  motivationScore: number;
  /** A/B = 兴趣在线。 */
  interestOnline: boolean;
  lifeEventScore: number;
  lifeEventLevel: "正常" | "警戒" | "高风险";
  /** 单项影响 =3 的事件名称。 */
  lifeEventSevere: string[];
  redFlags: string[];
  /** 五维定位（均分最低者优先，并列按 乐学→会学→善学→品格→环境）。 */
  priority: "乐学优先" | "会学优先" | "善学优先" | "品格优先" | "环境优先";
  /** 命中的训练路由。 */
  routes: E3V27Route[];
  /** 学科快扫中任一单项 ≤2 的预警。 */
  subjectAlerts: { name: string; aspect: E3V27ScanAspect; score: number }[];
};

/* ------------------------------- 计分实现 ------------------------------- */

function e3Level(score: number): E3Level {
  if (score >= 4) return "正常";
  if (score >= 3.2) return "警戒";
  return "危险";
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** 二级观察点定义（题号区间，与教练判读页「维度落位与训练承接」一致）。 */
export const E3V27_SUBSCALE_DEFS: { key: string; label: string; dim: E3V27DimKey; items: number[] }[] = [
  { key: "initiative", label: "主动性", dim: "乐学", items: [1, 2] },
  { key: "efficacy", label: "自我效能感", dim: "乐学", items: [3, 4] },
  { key: "intDrive", label: "内驱水平", dim: "乐学", items: [8, 9, 10, 11] },
  { key: "goal", label: "目标感", dim: "乐学", items: [12, 13] },
  { key: "process", label: "流程习惯", dim: "会学", items: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24] },
  { key: "timeExam", label: "时间利用与考试技巧", dim: "会学", items: [25, 26, 27, 28] },
  { key: "monitor", label: "元认知·监控", dim: "善学", items: [29, 30, 31, 32] },
  { key: "regulate", label: "元认知·调节与复盘", dim: "善学", items: [33, 34, 35] },
  { key: "ability", label: "学习能力", dim: "善学", items: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45] },
  { key: "ai", label: "AI 自主学习", dim: "善学", items: [46, 47, 48, 49] },
  { key: "resilience", label: "心理韧性", dim: "品格", items: [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60] },
  { key: "support", label: "身心与支持", dim: "环境", items: [61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73] },
];

const DIM_LABEL: Record<E3V27DimKey, string> = {
  乐学: "乐学（动力与目标）",
  会学: "会学（习惯与流程）",
  善学: "善学（元认知·能力·AI）",
  品格: "品格（心理韧性）",
  环境: "环境（身心与支持）",
};

export function scoreE3V27(input: E3V27Input): E3V27Result {
  const questions = E3V27_QUESTIONS[input.stage];
  if (input.ratings.length !== E3V27_RATING_COUNT) {
    throw new Error(`E3 评分题数量应为 ${E3V27_RATING_COUNT}，实际 ${input.ratings.length}`);
  }
  if (input.lifeEvents.length !== E3V27_LIFE_EVENT_COUNT) {
    throw new Error(`E3 生活事件数量应为 ${E3V27_LIFE_EVENT_COUNT}，实际 ${input.lifeEvents.length}`);
  }
  // adjusted[题号] = 换算后分数
  const adjusted = new Map<number, number>();
  for (const q of questions) {
    if (q.no > E3V27_RATING_COUNT) break;
    const raw = input.ratings[q.no - 1];
    adjusted.set(q.no, q.reverse ? 6 - raw : raw);
  }
  const avg = (items: number[]) => round1(items.reduce((s, no) => s + (adjusted.get(no) ?? 0), 0) / items.length);

  const dims: E3V27Dim[] = (["乐学", "会学", "善学", "品格", "环境"] as E3V27DimKey[]).map((key) => {
    const items = questions.filter((q) => q.dim === key && q.no <= E3V27_RATING_COUNT).map((q) => q.no);
    const score = avg(items);
    return { key, label: DIM_LABEL[key], score, level: e3Level(score) };
  });

  const subscales: E3V27Subscale[] = E3V27_SUBSCALE_DEFS.map((def) => {
    const score = avg(def.items);
    return { key: def.key, label: def.label, dim: def.dim, score, level: e3Level(score) };
  });
  const sub = (key: string) => subscales.find((s) => s.key === key)?.score ?? 0;

  const weaknesses: E3V27Weakness[] = questions
    .filter((q) => q.no <= E3V27_RATING_COUNT && (adjusted.get(q.no) ?? 5) <= 2)
    .map((q) => ({ no: q.no, kp: q.kp, text: q.text, score: adjusted.get(q.no) ?? 0 }));

  const extDrive = round1([5, 6, 7].reduce((s, no) => s + input.ratings[no - 1], 0) / 3);
  const extDriveHigh = extDrive >= 3.5;
  const intDrive = sub("intDrive");
  const intDriveLevel = e3Level(intDrive);

  const motivationScore = E3V27_MOTIVATION_SCORE[input.motivation];
  const motivationLabel = E3V27_MOTIVATION_OPTIONS.find((o) => o.key === input.motivation)?.label ?? input.motivation;
  const interestOnline = input.motivation === "A" || input.motivation === "B";

  const lifeEventScore = input.lifeEvents.reduce((s, v) => s + v, 0);
  const lifeEventLevel = lifeEventScore >= 8 ? "高风险" : lifeEventScore >= 4 ? "警戒" : "正常";
  const lifeEventSevere = input.lifeEvents
    .map((v, i) => ({ v, q: questions.find((x) => x.no === 74 + i) }))
    .filter((e) => e.v === 3 && e.q)
    .map((e) => e.q!.text);

  const redFlags: string[] = [];
  if (input.ratings[64] >= 4) {
    redFlags.push("第65题（持续烦躁、低落或不想说话）原始分≥4：先多陪伴倾听、少谈成绩，必要时寻求专业心理帮助。");
  }
  if (input.ratings[68] >= 3) {
    redFlags.push("第69题（超过一半日子不想上学）原始分≥3：尽快了解背后的原因（人际/学业压力/情绪），不要只催学习。");
  }
  if (lifeEventScore >= 8 || input.lifeEvents.some((v) => v === 3)) {
    redFlags.push("生活事件冲击较大（总分≥8 或单项重度）：先做支持与稳定化，红线命中期间暂缓学业加压。");
  }

  const routes: E3V27Route[] = [];
  if (sub("initiative") < 2.5) routes.push({ issue: "主动性偏低", trigger: "1、2 均分<2.5", action: "接D微启动＋固定学习：小步子启动、无压力开场", category: "D" });
  if (sub("efficacy") < 2.5 || input.motivation === "D" || input.motivation === "E" || input.motivation === "F") routes.push({ issue: "自我效能感偏低", trigger: "3、4（反）均分<2.5，或状态单选 D/E/F", action: "先接D动力激发：小步子任务、成功体验积累、进步可视化，暂缓高压刷题", category: "D" });
  const attitudeLow = input.subjects.some((s) => s.name && s.attitude > 0 && s.attitude <= 2);
  if (!interestOnline && attitudeLow) routes.push({ issue: "学习兴趣偏低", trigger: "状态单选未选 A/B，且学科快扫「学科态度」≤2", action: "学科兴趣激发：从生活应用和学生爱好切入", category: "D" });
  if (extDriveHigh) routes.push({ issue: "外驱依赖偏高", trigger: "5-7 原始均分≥3.5", action: "逐步减少批评和奖励驱动，接意义建立、角色转换", category: "D" });
  if (intDrive < 2.5) routes.push({ issue: "内驱水平偏低", trigger: "8-11 均分<2.5", action: "接D学习价值观：意义建立、生涯探索、成长型思维", category: "D" });
  if (sub("goal") < 2.5) routes.push({ issue: "目标偏低", trigger: "12、13 均分<2.5", action: "接D目标管理：SMART、目标拆解、成长之路", category: "D" });
  if (sub("process") < 2.5) routes.push({ issue: "会学·流程偏低", trigger: "14-24 均分<2.5", action: "接X学习五大流程：预习、听课、笔记、作业、复习、输出", category: "X" });
  if (sub("timeExam") < 2.5) routes.push({ issue: "会学·时间考试偏低", trigger: "25-28 均分<2.5", action: "接X时间规划/整理/考试技巧/试卷分析训练", category: "X" });
  if (sub("monitor") < 2.5) routes.push({ issue: "元认知·监控偏低", trigger: "29-32 均分<2.5", action: "自我监控清单：学后自问、做题回查；配合计划复盘", category: "X" });
  if (sub("regulate") < 2.5) routes.push({ issue: "元认知·调节复盘偏低", trigger: "33-35 均分<2.5", action: "接X复盘四问、方法调节训练，从每周一次复盘日记起步；配合 N/P", category: "X" });
  const abilityWeak = weaknesses.some((w) => w.no >= 36 && w.no <= 45);
  if (sub("ability") < 2.5 || abilityWeak) routes.push({ issue: "学习能力偏低", trigger: "36-45 反向后均分<2.5，或单项≤2", action: "按低分项接N能力训练对应板块", category: "N" });
  const aiUse = round1([46, 47, 48].reduce((s, no) => s + (adjusted.get(no) ?? 0), 0) / 3);
  if (aiUse < 2.5) routes.push({ issue: "AI 使用薄弱", trigger: "46-48 均分<2.5", action: "接X AI学习法：清晰提问—追问—验证三步训练", category: "X" });
  if (input.ratings[48] >= 4) routes.push({ issue: "AI 依赖风险", trigger: "第49题原始分≥4", action: "约定AI使用规则：先独立完成后求助核验，家长协同执行", category: "X" });
  if (sub("resilience") < 2.5) routes.push({ issue: "品格偏低", trigger: "50-60 均分<2.5", action: "接P挑战逆境、情绪管理、人际关系；规则感低时配合D固定学习、X四步习惯法", category: "P" });
  if (sub("support") < 2.5) routes.push({ issue: "环境支持偏低", trigger: "61-73 反向后均分<2.5", action: "先处理睡眠、运动、手机、同伴圈、老师和父母支持", category: "P" });
  const masteryLow = input.subjects.filter((s) => s.name && s.mastery > 0 && s.mastery <= 2);
  if (masteryLow.length > 0) routes.push({ issue: "学科掌握低", trigger: `学科快扫「知识掌握」≤2（${masteryLow.map((s) => s.name).join("、")}）`, action: "启动逐科补基，定位知识断层", category: "S" });
  if (attitudeLow) routes.push({ issue: "学科态度低", trigger: "学科快扫「学科态度」≤2", action: "做偏科归因：老师关系、兴趣、选科认知或挫败体验", category: "S" });
  if (lifeEventScore >= 8 || input.lifeEvents.some((v) => v === 3)) routes.push({ issue: "生活事件偏高", trigger: "74-81 总分≥8，或任一单项=3", action: "先做支持与稳定化，不直接加压", category: "P" });

  // 五维定位：均分最低者优先（并列按定义顺序）
  const priority = dims.reduce((a, b) => (b.score < a.score ? b : a)).key + "优先" as E3V27Result["priority"];

  const subjectAlerts: E3V27Result["subjectAlerts"] = [];
  for (const s of input.subjects) {
    if (!s.name) continue;
    const pairs: [E3V27ScanAspect, number][] = [
      ["知识掌握", s.mastery], ["解题能力", s.solving], ["考试发挥", s.exam], ["学科态度", s.attitude],
    ];
    for (const [aspect, score] of pairs) {
      if (score > 0 && score <= 2) subjectAlerts.push({ name: s.name, aspect, score });
    }
  }

  return {
    version: "v27",
    stage: input.stage,
    stageLabel: E3V27_STAGE_LABEL[input.stage],
    dims,
    subscales,
    weaknesses,
    extDrive,
    extDriveHigh,
    intDrive,
    intDriveLevel,
    motivationKey: input.motivation,
    motivationLabel,
    motivationScore,
    interestOnline,
    lifeEventScore,
    lifeEventLevel,
    lifeEventSevere,
    redFlags,
    priority,
    routes,
    subjectAlerts,
  };
}

/** 根据学段中文字（小学/初中/高中）映射测评版本，默认初中版。 */
export function e3StageOf(stageText: string | null | undefined): E3V27Stage {
  if (stageText === "小学") return "primary";
  if (stageText === "高中") return "senior";
  return "junior";
}

/** 判断旧版（三阶九能）结果，供前端提示重测。 */
export function isE3V27Result(r: unknown): r is E3V27Result {
  return !!r && typeof r === "object" && (r as { version?: string }).version === "v27";
}

/* ------------------------- 逐题得分明细（报告附录表用） ------------------------- */

export type E3V27ItemScore = {
  no: number;
  kp: string;
  text: string;
  dim: E3V27DimKey;
  /** 所属二级观察点 key；外驱题（5-7）归 null（单列一行指数）。 */
  subscaleKey: string | null;
  /** 原始作答（1-5）。 */
  raw: number;
  /** 反向题换算后的有效分（1-5，越低越需关注）。 */
  score: number;
  level: E3Level;
};

/** 由原始作答计算 73 道评分题的逐题有效分（反向题 6-x），用于报告附录的逐题明细表。 */
export function scoreE3V27Items(stage: E3V27Stage, ratings: number[]): E3V27ItemScore[] {
  if (!Array.isArray(ratings) || ratings.length < E3V27_RATING_COUNT) return [];
  const questions = E3V27_QUESTIONS[stage];
  const noToSub = new Map<number, string>();
  for (const def of E3V27_SUBSCALE_DEFS) for (const no of def.items) noToSub.set(no, def.key);
  return questions
    .filter((q) => q.no <= E3V27_RATING_COUNT)
    .map((q) => {
      const raw = ratings[q.no - 1];
      const score = q.reverse ? 6 - raw : raw;
      return {
        no: q.no,
        kp: q.kp,
        text: q.text,
        dim: q.dim,
        subscaleKey: noToSub.get(q.no) ?? null,
        raw,
        score,
        level: e3Level(score),
      };
    });
}
