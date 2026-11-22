/**
 * 心路三阶知识底座（机构级常量库 V1）
 * 来源：心路三阶·心理学（生命力之塔／生命教育成长地图）、冲突背后有礼物（18 招亲子小手段）。
 * 卡片文案面向家长，统一用大白话；出处只在伴学师侧知识库展示，不出现在家长卡片正文。
 */

export type GrowthStage = {
  key: string;
  minAge: number;
  maxAge: number;
  name: string;
  quality: string;
  psychTask: string;
  defenseRisk: string;
  repairAdvice: string;
  parentFocus: string; // 该阶段家长卡片的核心提醒（大白话）
};

/** 我愿意 · 生命教育成长地图（九阶段，心理学第十单元） */
export const GROWTH_STAGES: GrowthStage[] = [
  { key: "respond", minAge: 0, maxAge: 1, name: "即刻回应期", quality: "希望", psychTask: "建立「世界是安全的、我是被爱的」的信念（基本信任感）。", defenseRisk: "缺乏回应会让孩子难以建立安全感。", repairAdvice: "及时、持续、温柔地回应孩子的需要。", parentFocus: "孩子哭的时候及时回应，是在给他一辈子的安全感打底。" },
  { key: "trial", minAge: 1, maxAge: 3, name: "试错鼓励期", quality: "意志", psychTask: "在自主探索中建立意志，允许孩子自己尝试。", defenseRisk: "过度代劳或呵斥，容易让孩子不敢尝试、事事依赖。", repairAdvice: "多给试错机会，少替代、少责备。", parentFocus: "让孩子自己来，弄脏弄乱都没关系，敢试比做对重要。" },
  { key: "choice", minAge: 3, maxAge: 5, name: "选择权训练期", quality: "目的", psychTask: "练习做选择、承担小后果，建立目的感。", defenseRisk: "什么都由大人决定，孩子容易没主见。", repairAdvice: "在安全范围内给有限选择（先穿哪件、先玩哪个）。", parentFocus: "多让孩子选：先吃哪个菜、先玩哪个玩具，选择要从小练。" },
  { key: "habit", minAge: 5, maxAge: 9, name: "习惯养成期", quality: "学习", psychTask: "建立生活与学习习惯，体验「我能做好」的胜任感。", defenseRisk: "习惯没立住，后续学习容易松散、缺乏自信。", repairAdvice: "固定作息与小任务，夸具体习惯动作，不夸聪明。", parentFocus: "夸他做的小事情：书包自己收拾、作业自己记，孩子会越来越能干。" },
  { key: "social", minAge: 9, maxAge: 12, name: "朋辈交往期", quality: "反思内省", psychTask: "在同伴关系中认识自己，学习合作与反思。", defenseRisk: "只盯成绩忽略交友，孩子容易孤独或过分在意评价。", repairAdvice: "关注孩子的朋友与相处，夸合作与善意。", parentFocus: "这个年纪孩子最在乎朋友，多夸他对别人好、会合作。" },
  { key: "identity", minAge: 12, maxAge: 14, name: "个性表达期（道）", quality: "人格魅力", psychTask: "探索「我是谁」，需要被允许表达不同意见、形成自己的风格。", defenseRisk: "顶嘴、沉默、退缩；表达长期被压制，容易退回「都行、随便」的低动力状态。", repairAdvice: "每周至少一次让孩子自己做决定；用「冲突背后有礼物」的视角看顶嘴，先接住表达，再谈规则。", parentFocus: "孩子开始想自己做主，多夸他自己拿主意，别急着否定他的想法。" },
  { key: "confirm", minAge: 14, maxAge: 17, name: "自我确认期（德）", quality: "忠诚自我", psychTask: "确认价值观与立场，学习忠于自己、有原则。", defenseRisk: "一味顺从或全盘叛逆，都可能是自我没找到落点。", repairAdvice: "多讨论「你认为怎样是对的」，夸原则与担当，少夸结果。", parentFocus: "大孩子更在乎您认他是个什么样的人，多夸他有原则、有担当。" },
  { key: "recode", minAge: 17, maxAge: 20, name: "理性转码期", quality: "双赢协作", psychTask: "把冲动转为理性规划，学习与不同立场的人协作。", defenseRisk: "非黑即白、理想化受挫，容易极端或躺平。", repairAdvice: "陪他做现实的目标拆解，讨论双赢而非输赢。", parentFocus: "多跟孩子商量怎么办，少下命令，把他当大人一起想办法。" },
  { key: "independent", minAge: 20, maxAge: 30, name: "社会人自立期", quality: "独立思考·承担责任·解决问题", psychTask: "成为能独立思考、承担责任、解决问题的社会人。", defenseRisk: "长期被安排，难以自立。", repairAdvice: "逐步放手，让他为自己的决定负责。", parentFocus: "逐步放手，让他为自己的选择负责。" },
];

/** 按周岁取成长地图阶段。区间左闭右开，最后一段封闭；异常输入不静默归入某一年龄段。 */
export function stageForAge(age: number): GrowthStage {
  if (Number.isNaN(age)) return GROWTH_STAGES[0];
  const bounded = Math.max(0, Math.min(age, 30));
  return GROWTH_STAGES.find((stage, index) => bounded >= stage.minAge
    && (index === GROWTH_STAGES.length - 1 ? bounded <= stage.maxAge : bounded < stage.maxAge)) ?? GROWTH_STAGES[0];
}

/** 没有生日时按年级估算周岁（小学 6 岁起、初三 14、高三 17）。 */
export function estimateAgeFromGrade(grade: string | null | undefined): number | null {
  if (!grade) return null;
  const map: [RegExp, number][] = [
    [/一年级|小一/, 6], [/二年级|小二/, 7], [/三年级|小三/, 8], [/四年级|小四/, 9], [/五年级|小五/, 10], [/六年级|小六/, 11],
    [/初一|七年级/, 12], [/初二|八年级/, 13], [/初三|九年级/, 14],
    [/高一/, 15], [/高二/, 16], [/高三/, 17],
  ];
  const hit = map.find(([re]) => re.test(grade));
  return hit ? hit[1] : null;
}

/** 生日优先，生日无效或在未来时回退年级；无可靠信息则返回 null。 */
export function resolveGrowthStage(input: { birthDate?: string | null; grade?: string | null }, today = new Date()):
  { stage: GrowthStage; age: number; source: "birthday" | "grade" } | null {
  let age: number | null = null;
  if (input.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) {
    const [year, month, day] = input.birthDate.split("-").map(Number);
    const birth = new Date(year, month - 1, day);
    if (birth.getFullYear() === year && birth.getMonth() === month - 1 && birth.getDate() === day && birth <= today) {
      age = today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
    }
  }
  if (age !== null) return { stage: stageForAge(age), age, source: "birthday" };
  const estimated = estimateAgeFromGrade(input.grade);
  return estimated === null ? null : { stage: stageForAge(estimated), age: estimated, source: "grade" };
}

/** 生命力之塔（三面一心，心理学第三单元）。 */
export const VITALITY_TOWER = {
  mainline: ["自爱", "自觉", "自律", "自主", "自立", "自由"],
  humanistic: ["生存驱动", "安全驱动", "社交驱动", "尊重驱动", "圆梦驱动"],
  psychoanalytic: ["被爱的", "可爱的", "被接纳", "被认可", "有价值", "有意义", "自由"],
  behavioral: ["自我混沌", "自我发现", "自我价值", "自我扩展", "自我实现", "自我奉献"],
};

export type E3AbilityLite = { key?: string; label?: string; name?: string; score?: number; level?: string; system?: string };

/** 仅作伴学师规则参考；缺能力的维度返回 null，不能用默认分伪装评估。 */
export function towerPosition(abilities: E3AbilityLite[]): { humanistic: number | null; psychoanalytic: number | null; behavioral: number | null } {
  const avg = (keys: string[]) => {
    const rows = abilities.filter((a) => keys.some((k) => (a.label ?? a.name ?? a.key ?? "").includes(k)) && typeof a.score === "number" && Number.isFinite(a.score));
    if (!rows.length) return null;
    return rows.reduce((sum, a) => sum + (a.score ?? 0), 0) / rows.length;
  };
  const motivation = avg(["动力", "信心", "情绪", "状态", "关系"]);
  const method = avg(["计划", "复盘", "执行", "习惯"]);
  return {
    humanistic: motivation === null ? null : motivation < 3.2 ? 2 : motivation < 3.8 ? 3 : 4,
    psychoanalytic: motivation === null ? null : motivation < 3.2 ? 3 : motivation < 3.8 ? 4 : 5,
    behavioral: method === null ? null : method < 3.2 ? 1 : method < 3.8 ? 2 : 3,
  };
}

export type E3ResultSnapshot = { id: number; result: unknown; createdAt: Date | string };
export type E3DimensionAverage = { key: "境" | "心" | "脑" | "行"; before: number | null; current: number | null; delta: number | null };

/** 只比较最近两份 V3.7，其他版本不参与；不读取作答明细或心理预警。 */
export function compareLatestE3(results: E3ResultSnapshot[]): { previous: E3ResultSnapshot; current: E3ResultSnapshot; dimensions: E3DimensionAverage[] } | null {
  const valid = results.filter((row) => isV37(row.result)).sort((a, b) => b.id - a.id).slice(0, 2);
  if (valid.length < 2) return null;
  const [current, previous] = valid;
  const dimensions = (["境", "心", "脑", "行"] as const).map((key) => {
    const before = averageDimension(previous.result, key);
    const now = averageDimension(current.result, key);
    return { key, before, current: now, delta: before === null || now === null ? null : Math.round((now - before) * 10) / 10 };
  });
  return { previous, current, dimensions };
}

function isV37(result: unknown): result is { abilities: E3AbilityLite[]; systems: { condition: { cells: E3AbilityLite[] } } } {
  return typeof result === "object" && result !== null && (result as { version?: string }).version === "3.7"
    && Array.isArray((result as { abilities?: unknown }).abilities)
    && Array.isArray((result as { systems?: { condition?: { cells?: unknown } } }).systems?.condition?.cells);
}
function averageDimension(result: unknown, key: "境" | "心" | "脑" | "行"): number | null {
  if (!isV37(result)) return null;
  const system = key === "心" ? "乐学" : key === "脑" ? "会学" : key === "行" ? "善学" : "";
  const rows = key === "境" ? result.systems.condition.cells : result.abilities.filter((row) => row.system === system);
  const scores = rows.map((row) => row.score).filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) / 10 : null;
}

export type ParentCard = {
  id: number;
  title: string; // 大白话主题
  quote: string; // 心路语录
  knowledge: string; // 今日知识点
  steps: string[]; // 指导方法（步骤）
  reminder: string; // 小提醒
  practice: string; // 今晚小练习
};

/** 家长每日知识卡片（冲突背后有礼物 18 招改写，家长正文不含出处） */
export const PARENT_CARDS: ParentCard[] = [
  { id: 1, title: "先听孩子说，别急着讲道理", quote: "孩子愿意说，比说得对不对更重要。您听得越认真，他下次越愿意开口。", knowledge: "很多孩子不爱跟父母说话，不是没话说，是以前一开口就被打断、被教育。先听，关系就近了；关系近了，您说的话他才听得进去。", steps: ["孩子说话时，先放下手机，看着他的眼睛。", "中间不插话、不纠正，让他说完。", "听完先回一句「原来你是这么想的」，再谈别的。"], reminder: "一边看手机一边「嗯嗯」，孩子一眼就能看出来，次数多了他就不说了。", practice: "今晚吃饭或睡前，听孩子讲一件学校的事，全程不打断，听完只说一句「后来呢」。" },
  { id: 2, title: "回应孩子，用「嗯，然后呢」就够了", quote: "好的回应不是讲很多道理，而是让孩子知道：你在听，你想听更多。", knowledge: "孩子讲事情时，父母最常犯的是急着评价：「这有什么」「你也有问题」。评价一出，话就断了。简单的点头、「嗯」「然后呢」，反而能让孩子越说越多。", steps: ["孩子讲的时候，简单回应「嗯」「是这样啊」。", "他停顿时，问一句「然后呢」。", "等他说完，再决定要不要给建议；不确定就先问「你想听听我的看法吗」。"], reminder: "孩子只是想你听，不一定是想让你解决。急着出主意，常常帮倒忙。", practice: "今天孩子讲一件事时，忍住不给建议，只用「嗯、然后呢」陪他说完。" },
  { id: 3, title: "多问一句「还有呢」，允许孩子改主意", quote: "给孩子一次改口的机会，他才会跟你说真话。", knowledge: "孩子第一次说的答案，常常不是真实想法，是他猜您想听的。多问一句「还有呢」，或者说「想错了也可以改口」，他才敢把真话说出来。", steps: ["孩子回答完，温和地问一句「还有呢」。", "他改口时不批评：「你能改主意，说明你在认真想。」", "不翻旧账：不拿他上次说的话来堵这次。"], reminder: "「你上次不是这么说的！」这句话最容易让孩子以后不敢改口、不敢说真话。", practice: "今天找一次机会，对孩子说一句「没想好可以慢慢想，改主意也没关系」。" },
  { id: 4, title: "先做起来，做完再商量", quote: "别等孩子「想学」才开始。很多时候，是先做起来了，才慢慢有了劲头。", knowledge: "孩子拖拉，常常不是懒，是觉得任务太大、不知从哪里下手。把开始变简单，比反复催促有用得多。先做一小步，做完再一起复盘调整。", steps: ["把任务切小：先说「就做 5 分钟」「就写这一题」。", "开始了就不唠叨，让他做完这一小步。", "做完再商量：「刚才这样行不行，下次要不要换个做法」。"], reminder: "边做边挑毛病，孩子很快就不动了。先完成，再完善。", practice: "今晚和孩子约定一个 5 分钟就能做完的小任务，做完就停，不加量。" },
  { id: 5, title: "大目标拆小，一次只做一点点", quote: "路再远，一步一步也能走完。孩子怕的不是目标大，是看不到第一步在哪。", knowledge: "「期末要进步 50 名」这种目标，孩子听了只会发懵。把目标拆到他抬脚就能够着的小台阶，他每完成一步就多一分信心，信心攒多了，大目标自然近了。", steps: ["把大目标写成本周能做的一件小事，比如「这周数学错题每天重做 2 道」。", "把这件小事写在纸上，贴在看得见的地方。", "每完成一天，简单记一笔，周末一起看。"], reminder: "一次别定太多小目标，一个就够。目标多了等于没有目标。", practice: "今晚和孩子一起，把这个月的大目标拆成明天能做的一件小事。" },
  { id: 6, title: "分清三件事：孩子的、全家的、管不了的", quote: "孩子的事让他自己管，全家的事一起商量，管不了的事别较劲。", knowledge: "很多家庭矛盾，是因为父母把孩子的事全揽在自己身上：作业、交友、心情，样样都管。管得越多，孩子越不会为自己负责。分清三件事，家里能轻松一大半。", steps: ["孩子的事（作业怎么安排、先玩先写）：给他选择，让他承担后果。", "全家的事（几点吃饭、周末安排）：一起商量，定好就照做。", "管不了的事（老师怎么出题、别人怎么看）：不反复念叨，把精力放回前两类。"], reminder: "放手不是不管，是把「替他做」换成「陪他想办法」。", practice: "今晚挑一件平时您总忍不住插手的小事，忍住不插手，让孩子自己处理。" },
  { id: 7, title: "会夸孩子：夸具体的事，不夸聪明", quote: "孩子不是因为优秀才被爱，而是因为被爱，才慢慢发光。您一句具体的夸奖，就是在帮孩子相信：我是个有用的人。", knowledge: "十二三岁的孩子，心里正在想「我是个什么样的人」。您说他懒、说他粗心，他就会真觉得自己是这样的人。要夸，就夸他具体做的一件小事，他会想：原来我能把事情做好。光说「你真聪明」没用，他反而怕下次做不好，不敢试了。", steps: ["先说他做了什么：「今天你主动把数学错题重做了一遍。」", "再说这说明他好在哪里：「这就叫负责任。」", "说完就停，别接「要是天天这样就好了」。"], reminder: "夸完马上提要求，等于白夸。夸三次、批评一次，这个比例比较好。", practice: "睡觉前，找出孩子今天做好的一件小事，照上面的两句话夸他一句，然后正常说晚安，别加任何要求。" },
  { id: 8, title: "只奖不罚，陪孩子慢慢走", quote: "每个孩子开花的时间不一样。按他自己的节奏走，比拿他跟别人比有用得多。", knowledge: "总拿孩子跟别人比，他学到的是「我不如人」，而不是「我要努力」。只奖不罚，不是纵容，是把注意力放在他做到了什么上：做到了就肯定，没做到就一起找原因，而不是羞辱和惩罚。", steps: ["本周只设一个奖励点：做到了就兑现一个小奖励（一次郊游、一本喜欢的书）。", "没做到时不发火，问一句「卡在哪了，我们怎么调整」。", "不当着孩子拿别人家孩子作比较。"], reminder: "「你看人家谁谁谁」是最伤孩子的一句话之一，说了很难收回来。", practice: "今晚找出孩子这周的一个小进步，明确告诉他：这个进步值得奖励。" },
  { id: 9, title: "讲道理不如讲故事", quote: "孩子听不懂大道理，但听得懂一个好例子。把说教换成故事，他反而记得住。", knowledge: "「你要自律」「你要有上进心」这类话，孩子听多了会自动屏蔽。换成他熟悉的例子：一个同学的经历、一个运动员的故事、甚至您自己小时候的事，他更容易听进去，还会自己琢磨。", steps: ["想讲道理前，先想一个相关的小故事（自己的、书上的、新闻里的都行）。", "故事讲完就停，不急着总结「所以你要……」。", "问他一句「你觉得这个人做得怎么样」，让他自己说。"], reminder: "故事讲完马上接说教，效果等于零。道理让他自己悟出来，才是他的。", practice: "今晚把一句常说的大道理，换成一个您亲身经历的小故事讲给孩子听。" },
  { id: 10, title: "一次只提一条建议", quote: "建议给得越多，孩子越不知道听哪句。一次一条，他才记得住、做得到。", knowledge: "父母着急时容易一口气提一堆要求：先收书包、再写作业、别玩手机、早点睡……孩子听完只剩烦躁。站在孩子一边，一次只说最要紧的一条，他反而愿意配合。", steps: ["开口前先问自己：今天最要紧的是哪一件事？", "只说这一条，其他先忍住。", "用商量的口气：「我们先把这个做好，别的明天再说，你看行吗」。"], reminder: "一天批评十件事，不如一周抓好一件事。", practice: "今晚只挑一件最要紧的事跟孩子说，其他问题记下来，改天再谈。" },
  { id: 11, title: "批评也要给孩子留面子", quote: "孩子做得不好，可以批评事，但不能否定人。批评的目的是帮他变好，不是让他难受。", knowledge: "「你怎么这么笨」「你从来就不自觉」这种话，孩子记住的不是错在哪，而是「我不行」。批评要对事不对人：说清哪件事没做好、可以怎么改，同时让他知道，您相信他能改好。", steps: ["只说这件事：「这次作业有两页没完成」，不说「你总是拖」。", "接着说怎么改：「我们看看是哪一步卡住了」。", "最后给信心：「这件事你能做好，我们一起想办法」。"], reminder: "不当着外人批评孩子。有外人在场，先带走，回家再谈。", practice: "今天如果要指出孩子的问题，先打草稿：只说事、给方法、给信心，三句以内说完。" },
  { id: 12, title: "陪孩子面对失败：跌倒了再试一次", quote: "失败不是孩子不行，是他还没找到方法。您陪他多试一次，他就多一分不怕输的底气。", knowledge: "孩子考砸、比赛输了，最怕的不是失败本身，是回家面对父母的失望。这时最需要的不是分析对错，而是先接住情绪，再陪他想办法。经历过「失败了也有人陪」的孩子，才敢继续挑战。", steps: ["先接住情绪：「没考好，你心里也不好受吧」。", "等他平静了再看卷子：只找一两个最能改的问题。", "定一个小目标：下次先把这一类题做对。"], reminder: "「早就跟你说过」是最没用的话，既解决不了问题，还把孩子推远。", practice: "如果孩子最近有没做好的事，今晚对他说一句：「这次没做好没关系，我们看看下次怎么试。」" },
  { id: 13, title: "孩子难过时，先陪，别急着劝", quote: "孩子难过的时候，您的陪伴比道理管用。一句「我陪着你」，胜过一百句「别哭了」。", knowledge: "孩子委屈、难过时，大脑听不进任何道理。「这有什么好哭的」「想开点」只会让他觉得不被理解。先让他把情绪倒出来，情绪过去了，问题才好解决。", steps: ["先陪着，少说教：「看起来你今天挺难受的」。", "问一句「我能为你做点什么，还是想让我陪你待一会儿」。", "等他情绪缓下来，再聊怎么办。"], reminder: "不比较、不否定：「别人都没事，就你矫情」这句话最伤人。", practice: "今晚观察孩子的情绪，如果他不太对劲，先给一个拥抱或倒杯水，问一句「想跟我说说吗」。" },
  { id: 14, title: "做错了就道歉：一个歉意，一个请求", quote: "父母也会犯错。您愿意道歉，孩子才学得会担当，也更愿意亲近您。", knowledge: "很多父母错怪了孩子，嘴上不说，心里后悔，结果隔阂越来越深。其实一句真诚的道歉，不会让您没面子，反而会让孩子觉得被尊重。道歉加一个小请求，关系就能重新接上。", steps: ["说清楚错在哪：「刚才我没问清楚就批评你，是我不对」。", "不找借口：不接「还不是因为你……」。", "提一个小请求：「下次我声音大了，你提醒我一句，好吗」。"], reminder: "道歉后别马上要求孩子也检讨，先让道歉单独生效。", practice: "想想这周有没有错怪孩子的地方，今晚认真跟他说一句「对不起」。" },
  { id: 15, title: "拒绝孩子，也要给他选择和知情", quote: "拒绝不是一句「不行」就完了。说清楚为什么，再给一个可选的方案，孩子更容易接受。", knowledge: "孩子提要求被拒绝时，最难受的是「凭什么」。把原因讲清楚，再给他一个小选择，他就从「被压制」变成「有商量」。规则依然有效，但关系不受伤害。", steps: ["先说原因：「今天太晚了，再玩游戏明天起不来」。", "再给选择：「现在收起来，明天放学可以玩 20 分钟，你自己定时间」。", "定了就照做，不反复变卦。"], reminder: "心情好就答应、心情不好就拒绝，孩子只会学会看脸色，学不会守规则。", practice: "今晚如果要拒绝孩子一件事，试试「说原因＋给一个选择」这两步。" },
  { id: 16, title: "激励孩子：让他看看「更好的自己」", quote: "孩子最需要超越的不是别人，是昨天的自己。让他看见自己的进步，比什么奖励都有劲。", knowledge: "外部的奖励用多了会失效，真正持久的劲头来自孩子心里那句「我能行」。经常带他回头看看：上个月不会做的题现在会了、上周坚持不下来的事现在坚持了，他会越来越相信自己。", steps: ["定期和孩子回顾：翻出两周前的作业、打卡记录，让他自己看变化。", "问他一句「你觉得现在的你，比上个月强在哪」。", "把下一个目标定为「比现在的自己再好一点点」。"], reminder: "别只盯分数，习惯、态度、坚持的天数，都是值得被看见的进步。", practice: "今晚和孩子一起翻一翻两周前的记录，说出他的一个具体进步。" },
  { id: 17, title: "孩子有矛盾时，不当裁判，当教练", quote: "孩子之间闹矛盾，急着分对错，往往两头不讨好。教他想办法，比替他断案更有用。", knowledge: "孩子和兄弟姐妹、同学闹矛盾，父母最容易急着评判「谁对谁错」。其实孩子更需要的是学会处理矛盾的方法。先让双方把话说完，再引导他自己想解决办法，下次他就知道怎么做了。", steps: ["先各自听：让双方分别把事情说一遍，不打断。", "不急着判对错，问一句「你希望这件事怎么解决」。", "帮他比较办法：「这样做会有什么结果？还有别的办法吗」。"], reminder: "「你是哥哥就该让着弟弟」这类话，会让大的委屈、小的学不会负责。", practice: "下次孩子闹矛盾，忍住不评判，先问一句「你想怎么解决」。" },
  { id: 18, title: "闲聊别查户口，多聊孩子感兴趣的事", quote: "亲子关系是聊出来的。天天只问作业和成绩，孩子自然不想跟您说话。", knowledge: "很多父母和孩子的对话只剩三句：作业写完了吗、考了多少分、快去睡觉。这不是聊天，是查户口。真正的闲聊是聊孩子感兴趣的事：他的同学、他的游戏、他喜欢的球星。聊得多了，重要的事他才愿意跟您说。", steps: ["每天留几分钟，聊一件和学习无关的事。", "多问开放式的问题：「你们班最近有什么好玩的事」。", "孩子讲爱好时不泼冷水，先了解，再引导。"], reminder: "闲聊时别绕回学习。一绕回去，下次他就不聊了。", practice: "今晚睡前和孩子闲聊 3 分钟，全程不提学习和成绩。" },
];

/** 今日卡片：按年内日期轮换，18 天一循环 */
export function cardForDate(date = new Date()): ParentCard {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return PARENT_CARDS[dayOfYear % PARENT_CARDS.length];
}

/** 分版推送：卡片通用内容 + 该生年龄阶段的一句家长提醒 */
export function stageTipFor(stage: GrowthStage, card: ParentCard): string {
  return `${stage.parentFocus}（今日主题：${card.title}）`;
}
