# 启思学伴 v2 — tRPC API 契约（前后端共用）

> 本文档是 Stage 2（后端）与 Stage 3（前端）的唯一接口事实来源。
> 后端必须实现到签名完全一致；前端按此调用。所有路由经 `appRouter` 注册，前端调用形如 `trpc.profile.get.useQuery()`。
> 现有路由（graph/preview/gaps/dashboard）已存在，见 api/ 目录源码；本文档定义新增路由。

## 通用约定
- `publicQuery`（无需登录）；zod 校验输入；禁止 raw SQL；用 Drizzle API。
- 日期字符串均为 UTC+8 的 `YYYY-MM-DD`（用 api/helpers.ts 的 `dayStr()`）。
- 大字段（base64 图片）绝不进列表接口，单独接口取。
- 数据库表见 db/schema.ts（v2 已含 studentProfile/assessmentResults/papers/moodEntries/dailyPlans/guideSessions/recordings；errorLogs 已加 `band`(1/2/3) 与 `imageData`）。

## profileRouter（学生档案 + 测评）— Agent B
- `profile.get: () => StudentProfile | null`（取第一条；没有则 null → 前端跳 /welcome）
- `profile.setup: { name, grade, school?, targetSchool?, dailyMinutes } => { ok: true }`（创建或更新档案基本信息）
- `profile.updateMinutes: { dailyMinutes: number(10..240) } => { ok: true }`
- `assessment.questions: { kind: "mbti"|"disc"|"e3" } => AssessmentQuestionSet`（题库来自 contracts/assessments.ts）
  - MBTI：28 题（E/I、S/N、T/F、J/P 各 7 题，每题两个选项 A/B）
  - DISC：24 题（D/I/S/C 各 6 题，每题两个选项 A/B）
  - E3：学生卷——40 道 1-5 评分题（反向题：9,19,20,21,29,30,36,37,38,39,40）+ 动机单选(A-F) + 生活事件 10 题(0-3) + 3 道开放题。题目文案见本文件末尾附录。
- `assessment.submit: { kind, answers } => AssessmentOutcome`
  - MBTI answers: `number[]`（0=A,1=B，长度 28）→ result: `{ type: "INTJ" 等, dims: {E:x,I:x,S:x,N:x,T:x,F:x,J:x,P:x}, summary: string }`
  - DISC answers: `number[]`（长度 24）→ result: `{ primary: "D"|"I"|"S"|"C", dims: {D:x,I:x,S:x,C:x}, summary: string }`
  - E3 answers: `{ ratings: number[40], motivation: "A"|"B"|"C"|"D"|"E"|"F", lifeEvents: number[10], openAnswers: string[3] }` → result: `{ stages: { 乐学: number, 会学: number, 善学: number }, nine: { key: string, label: string, score: number, level: "正常"|"警戒"|"危险" }[9], motivationScore: number, lifeEventScore: number, redFlags: string[], sixType: string, sixAdvice: string, priority: "乐学优先"|"会学优先"|"善学优先" }`
  - 提交后：写入 assessmentResults 表；同时更新 studentProfile 的 mbti/disc/diagnosis 字段；若三项都完成则 `onboarded=true`。
- `assessment.latest: () => { mbti?, disc?, e3? }`（各取最新一条 result）
- 计分规则（E3，必须严格实现）：
  - 反向题按 `6 - 圈选数` 换算；九项均分映射——①学习动力: 1,2,8,9反 ②自我效能感: 3,4,7 ③目标感: 5,6 ④预习与课堂: 10,11 ⑤复习与作业执行: 12,13,19反,20反,21反 ⑥错题与输出: 14,15,16,17 ⑦复盘与归因: 22,24,29反 ⑧刷题与时间策略: 23,25,30反 ⑨应考策略: 26,27,28。①②③→乐学，④⑤⑥→会学，⑦⑧⑨→善学。
  - 涂档：≥3.5 正常 / 2.5–3.4 警戒 / <2.5 危险；三阶 = 其下九项均分的均值。
  - 动机谱赋分 A=40 B=30 C=20 D=10 E=0 F=-10。
  - 生活事件总分 = 10 题 0-3 直接累加（0-30）。
  - 红线：第36题(原始值)≥4 或 第39题(原始值)≥3 或 生活事件总分≥8 → redFlags 写入对应中文描述。
  - 六型映射：会学低+善学低+乐学正常→苦学无效型；乐学<2.5 或动机谱≤0→动力障碍型；效能感正常+应考策略低→粗心大意型；课堂正常+错题输出低→缺少思路型；都不满足→"暂无典型倾向（以行为数据持续观察）"。每型附第一步动作建议（见附录）。

## recordingRouter（课堂录音元数据）— Agent B
- `recording.list: () => (Recording & { kpTitles: string[] })[]`（按日期倒序）
- `recording.add: { title, recDate, kpCodes: string[], durationSec?, transcript?, note? } => { id }`
- `recording.remove: { id } => { ok: true }`

## paperRouter（试卷分析，三步法）— Agent C
- `paper.list: () => { id, title, examDate, score, createdAt, itemCount, bandCounts }[]`（不含 images/items 大字段）
- `paper.get: { id } => Paper`（完整，含 images base64 数组与 items）
- `paper.create: { title, examDate?, score?, images: string[]（每张 ≤1.5MB base64 dataURL，最多 6 张） } => { id }`（先建空卷，再逐题定性）
- `paper.analyze: { id, items: PaperItemSeed[] } => { summary }`
  - PaperItemSeed = `{ no, result: "right"|"wrong"|"half", band?: 1|2|3, kpCode?, cause?, note? }`
  - 逻辑（考试分析三步法）：①保存逐题定性 ②统计 bandCounts/错因分布/得分率 ③对每道 wrong/half 题：若能匹配 kpCode 则自动写入 errorLogs（带 band、cause，stem 形如 `试卷《title》第 no 题`），生成复习计划（复用 addError 的逻辑：band3 加当天复习）；产出 advice（按区间生成，如「第1区间是本该拿下的分，今晚 10 分钟重做一遍就能拿回」）。
  - summary 形如 `{ total, right, wrong, half, bandCounts: {1:x,2:y,3:z}, topCauses, advice: string[], linkedErrorIds: number[] }`，并写回 papers.summary/items。
- `paper.remove: { id } => { ok: true }`

## treeholeRouter（树洞心情）— Agent C
- `treehole.talk: { mood: number(1..5), tags: string[], content: string(1..2000) } => { reply: string }`
  - 先 `tryChat`（api/ai.ts，system 设定为「初中生的知心树洞+心理指导师，温暖、简短、先共情再给一个可执行小建议；绝不说教；不使用医学名词；若 content 涉及自伤/严重抑郁信号，回复末尾建议寻求专业帮助并告知家长」）；返回 null 时用规则引擎兜底：按 mood 与关键词（考试/成绩/朋友/爸妈/老师/作业/游戏/睡眠/喜欢）生成共情回信（先复述感受→正常化→一个今晚就能做的小行动→mood≤2 时加一句「明天学习计划我会帮你减量」）。回信 80-160 字。
- `treehole.history: { limit? } => MoodEntry[]`（倒序，默认 20 条）
- `treehole.weekMood: () => { day: string, mood: number }[]`（近 7 天每天平均 mood，无记录则缺省）
- `treehole.todayMood: () => { avg: number | null, count: number }`（供计划引擎降载判断）

## planRouter（当日计划·以时间为变量）— Agent C
- `plan.today: () => { plan: DailyPlan | null, minutes: number }`（取今天的计划；minutes 默认取 studentProfile.dailyMinutes ?? 45）
- `plan.generate: { minutes: number(10..240) } => { plan: DailyPlan, explanation: string[] }`
  - 规划引擎（确定性、可解释，按顺序填充直到预算用完）：
    1. 固定开销：今日到期复习（gaps 的 reviewItems due<=today 且 error active），每题约 4 分钟，band3 优先；
    2. 第1提分区间错题（band=1, active）：「先拿回本该属于自己的分」，每题约 6 分钟做变式；
    3. 下一个建议预习知识点（掌握度 <60 的第一个，同 dashboard.suggestedKp 逻辑）：预习约 15 分钟（含费曼 5 分钟）；
    4. 第2区间错题每题约 10 分钟；第3区间（攻坚区）每题约 15 分钟——仅在预算 ≥60 分钟时才排，时间紧不排攻坚；
    5. 心情降载：若今日 treehole 平均 mood ≤2，总预算 ×0.8，末尾加一条 rest 项「今天情绪需要照顾，早点休息」；
    6. 每项产出 PlanItemSeed `{ kind, title, kpCode?, errorId?, minutes, done:false }`；explanation 逐条说明为什么这么排（给家长看的）。
  - 写入 dailyPlans（date 唯一，重生成则更新）。
- `plan.toggleItem: { date, index, done } => { ok: true }`（勾选完成）

## guideRouter（伴学师·自主学习七步法导学）— Agent C
- 七步法定义在 contracts/content.ts：①定目标 ②拆计划 ③先预习 ④会听课 ⑤限时作业 ⑥错题归因 ⑦复盘输出，每步 { key, title, why, prompt（引导学生回答的问题）, tips }。
- `guide.today: () => GuideSession | null`（今天的导学 session）
- `guide.start: () => GuideSession`（创建今日 session，已存在则返回现有）
- `guide.answer: { sessionId, stepKey, answer } => { step: number, done: boolean }`（保存某步回答，step 前进）
- `guide.finish: { sessionId } => { summary: string }`（生成一段导学小结，规则模板即可）

## contracts/content.ts（Agent C 创建，前后端共用）
- `BANDS`: [{ band:1, name:"第1提分区间·送分区", short:"送分区", desc:"会了但错了——本该属于自己的分，先拿回", color:"#8ebb3e" }, { band:2, name:"第2提分区间·提分区", ...terra }, { band:3, name:"第3提分区间·攻坚区", ...olive }]
- `SEVEN_STEPS`、`MOOD_TAGS = ["学业","考试","人际","家庭","睡眠","其他"]`、`PLAN_KIND_LABELS`

## contracts/assessments.ts（Agent B 创建，前后端共用）
- MBTI/DISC/E3 题库 + 纯函数计分器（后端 submit 调用；前端可预览题目）。
- E3 附录数据见下方。

---

## 附录：E3 学生卷题目（评分题 1-5：1=从不/完全不符合，5=总是/完全符合）
**第一部分·动力与心态（乐学层）**
1 即使没人督促，我也会主动开始学习
2 遇到难题时，我的第一反应是"再试一次"而不是"我不行"
3 我相信只要方法对、够努力，我的成绩一定能提上去
4 学习让我有成就感（哪怕只是弄懂了一道题）
5 我清楚自己这学期要达到什么目标（分数/排名/学校）
6 我的目标是自己想要的，而不只是爸妈要求的
7 考砸之后，我能在一两天内调整好重新投入学习
8 我觉得学习是一件"跟我有关"的事，而不是为别人学的
9 ▲我经常觉得"学不学都那样"，提不起劲（反向）
**学习动机单选**：A 我享受学习的过程，不觉得痛苦 / B 我喜欢某些学科，愿意主动钻研 / C 我愿意为了目标而学习，能坚持下来 / D 我在勉强学习，经常感到疲惫 / E 我在应付学习，做一天和尚撞一天钟 / F 我在反抗学习，经常抵触和逃避
**第二部分·习惯与执行（会学层）**
10 课前我会预习，并带着疑问去听课
11 上课听不懂的地方，我会做标记，下课追问或自行解决
12 当天学的内容，我当天会回忆/默写一遍主干框架
13 作业我独立、限时完成，不边做边翻书、不对答案
14 做错的题我会收进错题本，并写清错因
15 错题我会隔几天重做，直到同类题不再错
16 我会把学过的内容"讲"出来（给同学/家长/自己讲题）
17 我会做周期复习：第2天回顾、第7天复盘、月末整合
18 我每天有明确的学习计划，并且大部分能完成
19 ▲我经常"看起来在学"：坐了很久，但没记住也没产出（反向）
20 ▲我习惯拖到最后一刻（考前突击、作业赶deadline）（反向）
21 ▲我学习时离不开手机/平板，经常被打断（反向）
**第三部分·策略与应考（善学层）**
22 考完试我会逐题归因：错在知识、审题、计算还是时间
23 我刷题会分层选题（按自己水平选+10~20%难度），不搞题海
24 我能说出自己每科的薄弱章节具体在哪里
25 我会规划时间：当堂3分钟回忆、睡前30分钟复习、周末复盘
26 大考前我有自己的收官节奏（回归错题、不做新难题、稳住心态）
27 考场上我会分配时间，遇到卡壳题知道先跳过
28 我会总结题型套路，同类题看到条件就知道往哪想
29 ▲试卷发下来我只看分数，很少分析为什么错（反向）
30 ▲我觉得"刷过的题量"比"弄懂一道题"更重要（反向）
**第四部分·状态与环境（背景筛查）**
31 我最近一个月睡眠规律（初中≥8小时）
32 我每周有固定的运动或放松时间
33 我有可以聊心事的人（家人/朋友/老师）
34 我在学校和老师、同学的关系总体是舒服的
35 不愉快的事不会让我烦恼很长时间
36 ▲我最近经常感到烦躁、低落或不想说话（反向，红线观察题）
37 ▲家里对我学习的管教方式让我觉得压力很大（反向）
38 ▲我晚上经常熬夜，白天没精神（反向）
39 ▲最近一个月，我有超过一半的日子不想上学（反向，红线观察题）
40 ▲手机/游戏让我和家人发生过冲突（反向）
**生活事件（0=没发生 1=轻度 2=中度 3=重度）**：41 考试失败或成绩大幅下滑 / 42 被老师批评或当众否定 / 43 与同学好友发生严重矛盾 / 44 恋爱困扰或人际孤立 / 45 家庭内部矛盾、父母争吵 / 46 父母工作变动 / 47 家庭成员变动 / 48 搬家 / 49 身体疾病或长期疲劳 / 50 转学/换班/换老师
**开放题**：1 现在的学习里，让你觉得最难、最烦的一件事是什么？ 2 如果接下来一个月只能改变一件事，你最想改变什么？ 3 半年后，你希望自己变成什么样？
**六型第一步动作**：苦学无效型→把「时长表」换成「方法执行表」，先上七步法；动力障碍型→先做会的内容，制造一次满分体验；粗心大意型→鉴别真假粗心：让孩子讲题的原理；缺少思路型→典型题「三问」训练：考什么/怎么想/怎么写。
