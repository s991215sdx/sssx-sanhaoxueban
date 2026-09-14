# 三好学伴 · 交接文档（v29.3 · 2026-09-06）

## 0. 给新代理的第一句话
请通读本文件后，从「第 6 节：待办任务」继续。所有代码在 `/mnt/agents/output/app`，禁止凭记忆改动，先读文件再动手。

## 1. 项目概况
- **产品**：三好学伴——K12 数学伴学 Web 应用（当前内容覆盖初一数学，即将扩展全学段）
- **线上域名**：sanhao2.kimi.site（用户手动点「发布」上线，代理只负责 build_version 保存版本）
- **项目路径**：`/mnt/agents/output/app`
- **技术栈**：React 19 + Vite + Tailwind（olive/lime 低饱和设计令牌）前端；Hono + tRPC（superjson）+ drizzle-orm/mysql2 + TiDB Serverless 后端；recharts 图表
- **构建**：`npm run build`（前端 vite build → dist/public；后端 esbuild → dist/boot.js）
- **类型检查**：`npx tsc --noEmit -p tsconfig.json`（前端）、`npx tsc --noEmit -p tsconfig.server.json`（后端，已知唯一遗留报错 api/router.ts(72) TS7053，运行时安全，v17 起遗留，勿动）
- **版本保存**：`website_version_manager` action=build_version, type=dynamic, project_dir=/mnt/agents/output/app
- **测试账号**：小明 13900000002 / Simu123456

## 2. 硬性约束（红线，勿碰）
1. 禁改：`api/kimi/`、`api/lib/`、`api/queries/connection.ts`、`drizzle.config.ts`、`.env`
2. 勿 drop 表、勿 `db:push --force`
3. 沙箱无法直连数据库（TCP 4000 超时/PrivateLink）。观察线上状态只能用公开探针：
   - `GET https://sanhao2.kimi.site/api/trpc/ping?input={"json":null}`
   - `GET https://sanhao2.kimi.site/api/trpc/dbHealth?input={"json":null}`（含迁移执行状态 initStatus）
4. 同一文件禁止并行编辑（多个子代理改同一文件会互相覆盖）
5. **改已存在文件前必须先 read_file**（本会话曾因未读直接 write_file 覆盖 api/tutorRouter.ts，靠从 dist/boot.js 反提取源码才恢复）
6. 前端验证必须跑真实 `tsc -p tsconfig.json` 并在改完后重跑——v22 曾因子代理在旧文件上跑 tsc 漏检 `Layout.tsx` 未定义变量 `showCoach`，导致线上全站白屏

## 3. 架构要点

### 数据库与迁移
- 自定义 TiDB 安全迁移器 `api/initDb.ts`：读 `db/migrations/meta/_journal.json` 的 entries → 执行 `<tag>.sql`（按 `--> statement-breakpoint` 分割），逐语句容忍 errno 1050/1060/1061/1091，**不用事务**（TiDB 不支持事务型 DDL）
- 新迁移 = 写 `db/migrations/XXXX_name.sql` + 在 `_journal.json` 追加 entry（idx 递增、tag=文件名去后缀、when=毫秒时间戳、breakpoints=true），发布重启时自动执行
- 现有迁移至 `0006_tutor_role`（users.role 增加 'tutor'；student_profile 增加 tutor_id）

### 关键表（db/schema.ts）
- `users`：role enum ["user","tutor","admin"]；phone 即账号；passwordHash scrypt
- `studentProfile`：grade/school/targetSchool/dailyMinutes/mbti/disc/onboarded/tutorId/**academics json**
- `knowledgePoints`：code（如 G7-1-01，唯一）、chapter、title、summary json[{heading,body}]、example json{stem,analysis,answer}、prereqCodes string[]、commonErrors json、socratic json{keyConcepts,probes,hints}、sortOrder。**当前无 grade 字段，初一耦合在 code 前缀 G7**
- `questions`：kpId、type(choice/fill)、stage(check/practice/variant 先备检测/预习练习/变式训练)、difficulty 1-3、stem、options、answer、hint、explanation
- `assessmentResults`：kind enum(mbti/disc/e3/multi)、result json、**answers json（原始答题明细）**
- 其余：mastery、attempts、errorLogs、dailyPlans、previewSessions、tutorSessions、moodLogs 等

### 测评体系（contracts/）
- `assessments.ts`：MBTI(28 迫选)/DISC(24 迫选)/E3 学习力(40 Likert+动机+生活事件+开放题) 题库与计分器
- `multi.ts`：多元智能（加德纳八维 40 题 Likert，6 题反向计分），scoreMulti → MultiResult{dims, top3, summary}
- `academics.ts`：**v22 已改逐科满分**——ACADEMIC_SUBJECTS 9 科（含物理化学），SubjectStatus{name, selfLevel 1-5|null, fullScore|null, lastScore|null, targetScore|null}，calcGaps 按各科自身 fullScore 算差距
- 报告内容纯前端数据：`src/data/reports/{types,mbti-a..d,disc,combined,index}.ts`，`**关键词**` 由 RichText.tsx 渲染加粗；combined.ts v3 共 12 章，第①章为「综合结论」（跨测评归纳，置于最前），导出 buildCombinedReport(mbti, mbtiReport, disc, discReport, e3, opts?:{multi, academics})

### tRPC 路由（api/）
- middleware.ts：publicQuery / authedQuery / adminQuery / tutorQuery（requireAnyRole(["tutor","admin"])）
- router.ts：BUILD_TAG 常量、ping、dbHealth 探针
- profileRouter.ts：测评 questions/submit/latest（含 raw 答题明细）、saveAcademics（zod 校验逐科 fullScore 1-1500 可空）
- adminRouter.ts：claimAdmin（仅当系统无管理员时可自举，首个管理员靠它）、setRole、students、studentDetail、tutors、assignTutor
- coachRouter.ts：myStudents（admin 全量/tutor 仅自己名下）、studentDetail（越权校验）
- studentDetail.ts：listStudents + getStudentDetail 共享逻辑（含 phone 字段）
- tutorRouter.ts：**AI 伴学路由**（start/state/beginQuiz/submitQuiz/chat/reviewCard），与 coachRouter 是两回事，勿混淆
- auth-router.ts：logout 是 publicQuery（过期会话也要能退出）

### 前端关键页面（src/pages|components）
- App.tsx 路由：/ /preview /gaps /learn/:errorId /papers /treehole /companion /report /report-detail /admin /tutor /login /welcome
- Layout.tsx：角色导航（admin 见「伴学工作台」+「后台管理」；tutor 见「伴学工作台」）
- Admin.tsx：三 tab 总览/学员/伴学师，学员行内分配伴学师，详情抽屉 StudentDetailDrawer.tsx
- Tutor.tsx：伴学工作台（coach.myStudents + 抽屉）
- Welcome.tsx：注册向导 5 步（档案→MBTI→DISC→E3→多元智能可跳过）
- ReportDetail.tsx：4 tab（mbti/disc/multi/combined），综合 tab = 概览卡 → 全部图表（E3九维雷达/多元八维雷达/分数差距柱状）→ 章节（首章综合结论）；每 tab「下载报告」按钮 → src/lib/reportDownload.ts 生成打印 HTML 调 window.print
- companion/ 目录：AssessmentReport、AnswerDetail（答题原始选项回顾，支持外部传 answers）、MultiQuiz、AcademicsForm（逐科满分）

## 4. 已完成版本史
- v20 (832f703)：MBTI/DISC 详细报告（仿两份参考 PDF 风格，校园场景化）+ MBTI+DISC+E3 综合报告
- v21 (9669ef5)：关键词加粗、三阶九能归纳、图表化；多元智能测评（选做）；伴学师可见答题原始选项；学业现状/差距填报；修复退出登录
- v22 (559e09f)：多元智能入注册向导；逐科满分；综合报告图表全前置+首章综合结论；四份报告可下载；管理员系统（学员/伴学师 tabs+分配）+ 伴学师工作台 /tutor
- v22.1 (d545111)：**修复线上白屏**（Layout.tsx showCoach 未定义）+ 补 /tutor 路由
- v22.2 (5026af3)：学业表单加物理、化学

## 5. 经验教训
1. 白屏类故障排查顺序：公开探针看后端 → 浏览器工具复现 → 静态读渲染链组件（v22.1 就是未定义变量导致整树崩溃）
2. esbuild 冒烟测试里相对路径 `../../contracts/x` 偶发解析失败，用绝对路径 `/mnt/agents/output/app/contracts/...`
3. zod 为 v4.3.5，`z.enum(readonly tuple)` 可用
4. 子代理交付后必须亲自复核其声明的每一项（v22 子代理漏注册 /tutor 路由、漏定义变量）
5. **edit_file 静默失败**：同一条消息里对同一文件发两个 edit_file，第二个常静默不生效（工具却报成功）。规则：同文件每次只改一处，改完必 grep 验证
6. 新增深度内容 KP 与骨架撞 code 是特性：runSeed upsert 覆盖升级，runSkeletonSeed 只插不更新

## 6. 待办任务

### 任务 A 第一期：全学段知识骨架 ✅ 已完成（v23, e7936f0, 2026-09-04）
- 迁移 0007：knowledge_points 加 stage/grade；contracts/constants.ts 有 STAGES/GRADES/stageOfGrade
- db/seed-skeleton-{primary,junior,senior}.ts：143 章 554 个骨架 KP（G1-G12 全覆盖，人教版目录），seed-core.ts 的 expandSkeleton 自动展开+链前置，runSkeletonSeed 幂等只插不更新（initDb 每次启动调用）
- 空内容 KP 判定：`Array.isArray(summary) && summary.length > 0`（graphRouter/previewRouter/planRouter/dashboardRouter 均已按此门控）；前端 PreviewList 年级选择器（默认取档案年级）+「精讲内容建设中」置灰，Gaps 页同步
- code 规则：G{1-12}-{章号}-{序号}，sortOrder=编码序；小学下册章号从 11 起
- **注意**：runSeed 只在空库时跑；骨架铺数据靠 runSkeletonSeed（每次启动）

### 任务 A 第二期（待做）：按孩子实际年级优先填深度内容（精讲/例题/错因/费曼 + 三阶段题库），一批一验。参考 db/seed-ch1.ts 的 KPSeed 格式

## 7. 快速自检清单（每次交付前）
- [ ] 两个 tsconfig 的 tsc 都干净（除已知 router.ts:72）
- [ ] npm run build 成功
- [ ] grep 构建产物确认关键文案存在
- [ ] 涉及登录后页面的改动：用 browser 工具 + 测试账号在线上复现验证（发布后）
- [ ] build_version 保存并告知用户去点「发布」

## v24.1 (8266f29) 2026-09-05
- 修复 /companion 白屏：AcademicsForm 调 subjectsForGrade 但未 import（edit_file 静默失败）→ ReferenceError 整树卸载
- 修复 /gaps 潜在白屏：Gaps.tsx 用 GRADES/STAGES/STAGE_GRADES 未 import
- graph.overview 默认按档案年级过滤（scopeKpsToUserGrade），新增 allGrades:true 仅 PreviewList 使用 → 修复 Dashboard「最需要关注的 5 个知识点」串年级、报告/错题/试卷页串年级
- graph.detail 返回补 hasContent（PreviewSession 依赖）
- 类型修复：subjectsForGrade 返回 AcademicSubject[]；StudentListItem 补 phone；router.ts seedProbe recount 括号 bug；LearnFlow tutorMessage 可空兜底
- 教训再次验证：每次改动后必须 tsc 双配置全绿 + grep 验证 import 落盘

## v25 (2026-09-05) AI 化三大升级
- api/ai.ts 重写：多凭据源（DEFAULT_AI_* 网关 → MOONSHOT_API_KEY 直连 api.moonshot.cn，默认模型 kimi-latest 支持图片）、支持 image_url 视觉消息、tryChatJSON、aiSelfTest
- router.ts 新增公开探针 `GET /api/trpc/aiHealth?input={"json":null}`（configured/provider/pong/ms）；BUILD_TAG=v25-2026-09-05
- 苏格拉底大模型化：tutorRouter.chat 先走 LLM（system prompt 含 KP 精讲/关键概念/错题/检验题与答案保密），[UNDERSTOOD] 标记判定想通；失败回退规则引擎
- 错题自动识别：gapsRouter.autoClassify（图片 OCR 题干+按年级候选 KP 匹配+五类归因+置信度）；AddErrorForm 加「✨AI 自动识别」按钮、拍照后自动触发、全部可手动改；AddErrorForm 的 overview 改 allGrades:true（配合 v24.1 默认按年级过滤）
- 首页全能入口：api/analyzeRouter.ts（analyze mutation：文字/图片→意图识别+KP 匹配+系统性查漏方案，降级关键词匹配）；src/components/OmniBox.tsx 置顶 Dashboard（麦克风占位「即将支持」，音视频需 ASR 待评估）
- .env.example 补 MOONSHOT_API_KEY 说明；typescript 需 node_modules 本地装（npx tsc 会拉到错误包）
- 注意：.git 曾被环境清空，v25 起重建仓库（旧提交历史丢失）

## v25.1 (2026-09-05)
- OmniBox 麦克风语音输入：Web Speech API（zh-CN、interim+continuous，复用 FeynmanChat 模式），识别文字进输入框可再编辑；不支持的浏览器自动隐藏按钮
- 线上验证：v25 已发布，aiHealth 探针 configured:false → 平台未注入 DEFAULT_AI_*，需用户配置 MOONSHOT_API_KEY（.env 会被 Dockerfile 打进镜像，dotenv/config 会加载）

## v26 (2026-09-05)
- 学习力训练系统入库：用户提供的 xlsx（N能力训练65/D动力激发60/X学法优化65/P品格养成68 + 120问题映射）→ `src/data/training/methods.ts`（258 法结构化：板块/目的/工具/步骤/频率）；解析脚本流程见会话（openpyxl）
- `src/data/training/e3Training.ts`：E3NineKey ×（警戒|危险）→ 2-3 个方法 id + 一句话理由（按 id 引用，勿按名称）
- combined.ts 新增章节「针对性训练方案（三阶九能 × 学习力训练系统）」，插在九维体检后；只有非「正常」维度出方案
- 文案精炼：NINE_TEXT 27 条全部重写为「结论+本周行动」短句式；删除 adaptText 风格适配模板（九维不再拼接泛泛建议）；综合结论/三镜画像/JP_PLAN_HINT 精简
- 教训：xlsx 解析后 method 名含前导字母和空格，映射一律用 id（如 X57、D31）

## v27 (2026-09-05)
- combined.ts：删「核心结论速览」「综合优势与待提升盘点」两章（与综合结论/sec2 重复）；NINE_TEXT 改 export；抽 buildTrainingSection(e3) 公共；新增 buildE3Report(e3) 三阶九能单列报告生成器
- `src/data/reports/coachingPlan.ts`：buildCoachingPlan（参照用户 docx 模板：画像诊断→陪跑框架→优先专题(最弱2维全量步骤)→常态化盯办(问·错·讲，落到 App 功能)→每周检查表→协同分工→储备方法库）；输出 CombinedReport 复用 combinedPrintHtml 打印
- ReportDetail：Tab 新增「学习力诊断报告」(e3，置首位)；新增 SectionToc 章节直达导航；SectionCard 加序号+左侧色条+锚点
- StudentDetailDrawer：测评摘要后插 CoachingPlanCard（展开/下载）
- RichText 支持 \n 换行；reportDownload rich() 换行转 <br/>（训练步骤不再糊成一团）
- AssessmentReport：E3 卡加「查看详细报告」→ /report-detail?tab=e3

## v28（2026-09-05，commit db4ea58）
用户 7 项反馈全部落地：
1. **拍照错题/试卷分析准确性修复**：autoClassify 与 analyze 改两阶段——阶段一 vision 只做题干转录+学科判定（禁止挑知识点，防止跨学科张冠李戴），阶段二在判定学科的 KP 子集内纯文本匹配；返回 subject/transcript；前端 OmniBox 显示「AI 识别到的内容·判定学科」供核对，Gaps 提示语含转录核对与学科。
2. **报告文字聚焦学习**：删除 MBTI 详版「代表人物」卡、DISC 科普末尾非学习提示；页脚改「聚焦学习相关因子」。
3. **Tab 顺序**：综合报告第 1 位 → 学业诊断(E3) → MBTI → DISC → 多元智能五项 → 多元智能·自评版。
4. **多元智能五项客观测评（multi5）**：contracts/multi5.ts（演绎推理/细节感知/数字计算/词义理解/空间定向，每维 8 道客观单选带标准答案，维度分=正确率、细心指数=全卷正确率、band 四档文案含特征/评估/学习/职业/成长建议，卡特尔理论依据）；questions 剥离答案下发；Multi5Quiz + ReportDetail multi5 tab（雷达+五维卡）+ multi5PrintHtml；**db 迁移 0009**：assessment_results.kind enum 加 'multi5'（启动时自研迁移器自动执行）。
5. **信效度**：docs/RELIABILITY.md 检验报告（五项测评结构/反向题/内容效度逐项过审 + 数据积累后复核清单）。
6. **单项重测**：AssessmentReport 五张卡均有「重新测这项」内嵌重测入口（不必走 /welcome 全流程）；EmptyCard 同样本地启动单项。
7. **伴学师/管理员可见完整报告**：StudentReportCards.tsx（MBTI/DISC/E3/multi/综合 完整报告展开查看+下载），StudentDetailDrawer 接入；Admin/Tutor 复用同一抽屉，后端无需改（getStudentDetail 已返回完整 result，权限模式沿用）。

## v29（2026-09-05）
1. **测评中心大栏目**：左侧导航新增「测评中心」(/assessments)，8 项测评统一入口（必测 MBTI/DISC/E3 + 选做 多元五项/自评/职业锚/霍兰德/心理健康），支持开始测评/查看报告/重新测；AssessmentReport 顶部加引导卡。
2. **三项选做测评**（参照用户 PDF 模板）：contracts/careerAnchor.ts（施恩八型40题，top2 详解+学习影响）、contracts/holland.ts（RIASEC 36题，code+专业职业建议）、contracts/mentalHealth.ts（SCL-90 式 10 因子 30 题，阳性线+免责声明，非医学诊断）；迁移 0010 扩 enum；均为选做不影响 onboarding；详情组件 src/components/reports/{Anchor,Holland,Mental}Detail.tsx；打印 anchorPrintHtml/hollandPrintHtml/mentalPrintHtml。
3. **Tab 重排**：综合报告→成绩现状及目标分数（新 academics tab，无中考表述）→学业诊断→MBTI→DISC→多元5项→自评→职业锚→霍兰德→心理健康；Tab 条 flex-wrap。
4. **综合报告集成选做测评**：opts 增 anchor/holland/mental，任一存在则追加「选做测评·对学习的综合影响」章；学生端 ReportDetail 与伴学端 CombinedReportCard 均已接线；studentDetail.assessments 增 optional 字段。
5. **DISC 详版精简**：删 communicationTips 与 DISC 科普卡，保留头卡/overview/校园五幕/压力/obstacles/supports/teacherFit。
6. **文案**：基本信息「想考的高中」→「自己的目标学校」；combined.ts 中考表述全部改为「成绩现状与目标分数/目标总差距」。

## v29.1（2026-09-05，commit ca4e56b）⚠️ 关键修复
**AI 全链路静默失败的根因**：kimi-k2.x 推理模型仅允许 temperature=1，api/ai.ts 之前固定下发 0.7/0.2 → Moonshot 返回 400「invalid temperature」→ tryChat 静默降级 → 拍照识别/苏格拉底/全能入口全部失效（v25-v28 的"数学题讲成语文"实因 AI 失败后跨学科关键词兜底）。修复：k2 系列不下发 temperature；阶段二 token 预算 1200→3000、超时 45s→60s；analyze 学科判定 300→800。
**测试账号全流程回归**（v29 线上）：8 项测评全部提交成功（含职业锚/霍兰德/心理健康，迁移 0010 自动执行）；错题本录入+根因回溯+复习队列 OK；试卷分析 create+analyze OK（错题自动入错题本 linkedErrorIds）。拍照 AI 识别待 v29.1 发布后回归。

## v29.2（2026-09-05）
综合报告改版：① 数据速览图表区扩列——E3九维雷达/多元八维/多元五项雷达/霍兰德六型雷达(赭色)/心理健康十因子条形(带阳性线)/分数差距，全部前置在报告最前；霍兰德详版顶部也加六型雷达。② 「三镜画像」与「性格×行为」合并为一章，三镜描述精简突出学习相关，新增「天然优点/可能出现的卡点」交叉分析，卡点用 **!!红色加粗!!** 标记（RichText 与打印 rich() 均支持 **!!...!!** 语法，terra 红）。③ 针对性训练方案从综合报告与 E3 诊断报告中移除，只在伴学师陪跑方案（CoachingPlanCard）展示。④ 选做测评影响章节移到三镜画像之后。章节序：综合结论→三镜画像与风格密码→选做影响→九维体检→多元智能→成绩目标→校园场景→信号→家长→30天行动。

## v29.3（2026-09-06）综合报告再改版
- 三镜画像重写：每镜列出测评得分（MBTI 四组字母分 / DISC 四因子分 / E3 三阶分）+ 各镜优点与卡点；新增「三镜结合·优势从哪来 / 卡点从哪来」两卡，逐条标注指标归因；删除原四张交叉卡（气氛带动型等，EI_DISC_TABLE/JP_DISC_TABLE/SN_TEXT/TF_TEXT 已移除）
- 综合报告末尾新增「学习力训练点子速查」章：优点巩固 + 每个卡点/问题一条训练点子（方法名引用 E3_TRAINING，不展开步骤，具体操作仍在伴学师陪跑方案）
- DISC 详细报告：四因子分数已逐条标注，并新增 D/I/S/C 得分曲线图（recharts LineChart，赭色 #cf6a3c）
- BUILD_TAG=v29.3-2026-09-06，build_version=31800a3，git 4133d06

## v29.4（2026-09-06）综合报告：概览卡扩容 + 性格×行为影响学习力
- 顶部概览卡：已完成的测评全部上卡（不再区分必做/选做），每张卡带基础数值——MBTI 八字母分、DISC 四因子分、E3 三阶分、多元智能 Top1、multi5 综合分+细心指数、职业锚 Top1/Top2、霍兰德代码+首位分、心理健康等级+总分+阳性数
- buildCombinedReport opts 新增 multi5；调用方 ReportDetail / StudentReportCards 均已传入
- 三镜画像新增「性格 × 行为 · 这样的孩子，学习力会怎样被影响」卡：DISC 动物形象（老虎/孔雀/考拉/猫头鹰）+ 每型学习影响文案（DISC_LEARN_IMPACT）+ J/P、T/F 修饰句 + E3 九维实际分数印证（DISC_E3_ECHO 映射），偏低维度红标
- DISC 详细页曲线图改为「倾向度曲线」（偏离均值百分比、零线 ReferenceLine，对标专业 DISC 报告样式）
- 全报告去掉「选做」字样（章节改名「更多测评 · 对学习的综合影响」，tab 标签去掉 ·选做）
- BUILD_TAG=v29.4-2026-09-06，build_version=5f12c71，git c23dbbf

## v29.5（2026-09-06）图示数值 + 逐因子解读 + 测评×学习力关系章
- OverviewCharts：所有雷达图角度轴直接带分数（如「学习动力 3.5」）；心理十因子/分数差距条形图加 LabelList 数值；多元智能八维标题改「（主观认同自评）」并移到五项客观题之后；DISC 倾向度曲线沿用
- 三镜画像 MBTI 卡：四组字母逐项解读（明显偏/略偏/均衡 + 每个字母含义，MBTI_POLE_MEANING）；DISC 卡：四因子按得分排序逐项解读（主导/辅助/不典型/最弱 + 高低分含义，DISC_FACTOR_MEANING）
- 新增章节「测评因子 × 学习力：谁在帮忙、谁在拖后腿」（secRelation，位于更多测评之后）：正相关清单（DISC特质→E3印证维度、多元智能通道、multi5底盘、最强九维）+ 负向清单红标（DISC惯性压低的E3维度、MBTI盲点、心理阳性因子）+ 三条个性化优化方向
- BUILD_TAG=v29.5-2026-09-06，build_version=0fb150a，git 14d7f63

## v29.6（2026-09-06）综合报告结构重构
- 修复 bug：综合结论 conclP2 内层双引号字符串里的 ${} 不插值（截图中"乐学 ${e3.stages.乐学}"原样显示），整段重写
- 综合结论重写：学习阶段定位 → 三阶逐层现状（每层最弱两维）→ 成绩现状与目标差距 → 优先提升建议（层+维度；学科优先语数外三主科按差距排序）→ 日常时间分配（主科 60-70%，差距最大主科独占 25-30%）→ 两件事收尾
- 章节重排：综合结论 → 成绩现状与目标分数 → 九维体检 → 三镜画像 → 更多测评 → 多元智能 → 测评因子×学习力关系 → 校园场景 → 信号 → 家长 → 30天行动 → 训练点子速查
- 关系章加「很好/最差」指标归因（最强九维←DISC关键词+MBTI特质；最弱九维←DISC阻碍+MBTI盲点，红标）
- 心理健康：正常因子统一绿色（正常），阳性因子标红并写明 轻度/中度/重度（mentalBand：≥2 轻/≥2.5 中/≥3 重）；OverviewCharts 心理图改单条+Cell 按因子着色+阳性参考线；MentalDetail 同步
- BUILD_TAG=v29.6-2026-09-06，build_version=0c7802d，git 46ad196

## v29.7（2026-09-06）DISC组合型 + 图表随文分布
- DISC 多主因子：getDiscCombo（最高分必选，差≤1 分的因子一并纳入，最多3个）；buildDiscComboBlend 混合型融合分析（按场景切换模式）；概览卡/三镜画像DISC卡/影响卡/关系章/DiscDetail 全部改用组合标签（如「DI 型 · 老虎+孔雀」）；DiscDetail 头部显示组合+混合分析卡
- 各测评优缺点：职业锚（优势驱动+需要注意）、霍兰德 top3 逐型学习影响；multi5 在「更多测评」章独立成段（客观作答权重>八维自评）：最强维=优点、最弱维=问题、细心指数<70 红标提醒
- 关系章：multi5 负向归因（最弱维<60、细心指数<70）；八维图谱注明主观自评参考权重低于五项客观题
- 图表随章节分布：顶部只留「分数现状与目标」+ 九维雷达；MbtiChart（四组字母对比柱，入选字母绿色）与 DiscTendencyChart（倾向度曲线，抽出共用组件）插在三镜画像章前；multi5/霍兰德/心理图插在更多测评章前；八维雷达插在多元智能图谱章前；ReportDetail 拆出 MbtiChart/DiscTendencyChart/Multi5Radar/HollandRadar/MentalBar/MultiRadarCard 组件
- BUILD_TAG=v29.7-2026-09-06，build_version=a1ac1c5，git fd05a97

## v34（2026-09-13）报告结构大改版 + 伴学端全量同步
（注：v30-v33 的详细记录见 README「已实现功能（截至 v33.2）」，本文件从 v34 恢复逐版记录。）

1. **综合报告头部**：删除概要九宫格（OverviewGrid 组件文件保留未用）；学习力系统框架图置顶为报告第一元素；SystemFramework 新增 FrameworkStatus 可选 props——顶部挂「成绩与目标 已填/未填」、三阶各挂 E3 阶分、条件框挂 E3 条件均分+心理健康、学能框挂 E3 学能均分+多元五项+多元八维、底座下新增「深层特质」行（MBTI/DISC/霍兰德/职业锚），全部标明已测（带结果值绿 chip）/未测（灰虚线 chip）；零 props 向后兼容静态图。
2. **综合结论章**：顶部两段文字下沉并入章末「概要总论」（closing 数组最前），paragraphs 清空——章节直接以「第一步 · 理清现状与目标」卡开场。
3. **冰山模型重排**（RoadmapSection）：冰山下从上→下 = 学能→善学→会学→乐学→条件→心理健康→DISC→MBTI→职业锚（新增行）→霍兰德，共享一个动态 rowSpan 的「冰山下」单元格；各系统内部行序全部倒转（乐学：韧劲/信心/动力；会学：会用/记住/学懂；善学：智学/复盘/计划；条件：资源/关系/状态；学能：加工速度/工作记忆/注意力，layerUnits 各数组 .reverse()）；第三步「建议进步方案」表行序同步倒转（planLayers）。RoadmapSection 新增 anchor prop。
4. **答题明细上移一级**：CollapsibleSection 新增 answers prop，「本章相关测评 · 答题明细」成为与「图形与图表」「详细报告文字」并列的独立折叠；AnswerDetailsByKind 内部小标题删除。
5. **删除「成绩现状与目标分数」独立章节**（secAcad 及 subjectStrategy/acadPriorityNames 一并移除；hasAcadSec 自然为 false，学科快扫答题明细自动并入条件章）。「成绩与目标」tab 保留。
6. **「给家长的话」重写**：一句开场引导 + 最多 9 张分块卡（只记三件事/怎么说话/陪写作业/动力和奖励/分数怎么聊/特别提醒/认知对照/管教风格/最后一句），短句通俗。
7. **后端**：coach.saveAcademics mutation（tutor 限名下学员、admin 放行，zod 与 profileRouter 一致）；getStudentDetail 的 assessments 补 e3parent + discParents（含 raw），支撑伴学端报告与学生端完全一致。
8. **ReportView 提取**：`src/components/reports/ReportView.tsx`（约 2500 行）承载全部报告渲染（所有 tab/图表/打印链路/详版+简版），props {data, profile, viewer, onEditAcademics}，**不得 import trpc**；`src/pages/ReportDetail.tsx` 变为 21 行数据壳。tutor 模式隐藏「我的档案」tab 与返回按钮，成绩 tab 只读 + 可选「帮TA填写」。
9. **伴学端同步**：StudentDetailDrawer 测评报告区整体替换为 ReportView（viewer="tutor"，该有图就有图，含框架图/冰山/雷达）；家长卷认知盲区卡保留在 ReportView 之外（伴学专属）；StudentReportCards.tsx 已删除。
10. **成绩代填**：drawer「成绩与目标 · 可代填」卡接入 AcademicsEditorCore + coach.saveAcademics；ReportView 成绩 tab 的「帮TA填写/修改」按钮滚动定位到该编辑器。
11. **注册即填成绩**：Welcome 向导 STAGES 改为 认识一下 → 成绩与目标（AcademicsStage，可跳过）→ MBTI → DISC → 学业诊断。
12. **训练方案**：AcademicsForm 抽取受控核心 AcademicsEditorCore（grade/initial/onSubmit 注入）；新增 `src/data/training/e3v37Training.ts`（V3.7 十五项→方法 id 映射，id 已经脚本校验全部存在）+ `src/components/V37CoachingPlanCard.tsx`（条件→乐学→会学→善学→学能 顺序出方案卡，可下载）；V2.7 CoachingPlanCard 原样保留。
13. **冒烟脚本入仓**：`scripts/smoke-render-v34.tsx`（ReportView 双模式 9 tab renderToStaticMarkup + 关键词断言）、`scripts/check-order.tsx`（冰山顺序/层内倒序/方案表倒序断言）、`scripts/check-editor.tsx`。运行方式：`TSX_TSCONFIG_PATH=tsconfig.app.json npx tsx scripts/xxx.tsx`。
- 验证：tsc 双配置 0 错误；npm run build 通过；renderToStaticMarkup 双模式全 tab 无白屏；冰山顺序逐项断言通过。
- BUILD_TAG=v34-2026-09-13

## v34.5（2026-09-13 深夜）线上修复：环境迁移事故全记录
- **事故**：本项目（新对话）发布后不继承旧项目的平台环境变量；旧 .env 里 DATABASE_URL 指向旧开发库（17 条 KP、users 无 phone 列）；且运行时容器读不到 db/migrations 文件（_journal.json ENOENT，原因未查明——疑似快照过滤），初始化卡死。
- **修复**：① 迁移内容内嵌进 `api/migrationsEmbedded.ts`（由 db/migrations 生成，esbuild 打入 boot.js），initDb 不再读运行时文件；② 生产库名用一次性探针在集群层面枚举确认（722 KP + users.phone），**不是**旧 .env 里的库名；③ 真实密钥全部写入 .env（.gitignore 已排除，勿提交勿外传）。
- **教训**：跨对话迁移项目时，.env 里的库连接串可能是历史残留，必须用数据特征（KP 数、表结构）核实目标库；密钥轮换后新值仍需写回 .env 并重新发布才生效（本项目不读平台环境变量设置）。

## v35（2026-09-13）报告深链化 + 简要总结三档
1. **SystemFramework 全量重写**（`src/components/reports/SystemFramework.tsx`）：新增 FrameworkLink（tab/assess/fill-academics）与 onOpen 回调；已测节点徽章 → 对应模块 tab 看图形与图表，未测 → `/assessments?start=X` 直达测评，成绩未填 → 学生进「我的档案」/伴学师开成绩编辑器。二级考察点全面排入：九能/条件格/学能项各挂关注点 kp 红黄绿小 chip（FrameworkStatus.e3.units，能力取 abilities[].focuses，条件格/学能由 scoreE3V37Items 逐题聚合 groupKp），成绩挂各科 现状→目标，深层特质挂各维度分（mbti 四对/disc 四值/霍兰德六维/职业锚 top2），多元五项挂五维分。
2. **报告内深链 reveal()**（ReportView）：RevealTarget 四型（tab/answers/assess/fill-academics）；answers 型切 tab 后按 `ansblk-*` 锚点定位（AnswerBlocksView 每个 details 加了 `id={ansblk-${b.key}}`），沿父链强制 open 所有 <details> 再 scrollIntoView，最多重试 3 次兜底滚到内容顶部；tab=combined 时自动切详版。openFramework() 适配 FrameworkLink → reveal。
3. **冰山模型**：成绩行无数据时显示「未填写」红 chip +「去填写成绩与目标 →」按钮（不再误显示「各科均已达标」）；每一行（五系统/心理/DISC/MBTI/职业锚/霍兰德）行尾新增「答题明细 →」链接——五系统 → e3 tab 段锚点（e3-lexue/huixue/shanxue/tiaojian/xueneng），心理/MBTI → combined 条件章折叠内锚点，DISC 用前缀匹配 ansblk-disc-，多元五项/职业锚/霍兰德 → combined 对应章锚点。第一步成绩缺失文案同步加「去填写 →」。
4. **建议进步方案表**：层内重点项 chips 改为可点按钮（→ e3 tab 对应段答题明细）；表下新增评分原则备注「红 <3.0（≈<50）卡点·优先干预；黄 3.0—3.7（≈50—69）待提升；绿 ≥3.8（≈≥70）正常」。
5. **「先抓这三件事」**：抽成 PrioritiesCard 组件，移入 RoadmapSection 第三步卡之后（详版/简版共用，一处生效）；CombinedLite 中原块删除。
6. **一页简版**：SystemFramework 卡从中间移到最上面（NineAbilityRadar 之前）。
7. **概要总论 → 简要总结**：RoadmapSection 尾部替换为 BriefSummary 组件——70 题按三档分组折叠：优势点（≥3.8 绿底）/ 待提升（3.0—3.7 黄底）/ 卡点（<3.0 红底），每档一句话总结（档内 kp 聚合前三）+ 展开可见全部题目与得分；itemScores 为空（无原始评分）时回退旧 closing 文案（标题也改为「简要总结」）。
8. **冒烟**：`scripts/smoke-render-v35.tsx`（28 项断言：双模式 9 tab 白屏、三档标题、先抓位置在方案后、评分原则、各 ansblk 锚点、框架二级考察点、无成绩态「未填写」+链接、不再显示「已达标」）。运行：`npx esbuild scripts/smoke-render-v35.tsx --bundle --platform=node --format=cjs --jsx=automatic --tsconfig=tsconfig.app.json --outfile=scripts/.smoke.cjs && node scripts/.smoke.cjs`（tsx 直跑会因 jsx runtime 报 React is not defined，v34 脚本注释里的 TSX_TSCONFIG_PATH 方式也可）。
- 验证：tsc app 配置仅剩 3 个历史遗留错误（AcademicsSubmit 科目名字面量，与本次无关）；npm run build 通过；冒烟 28 项全过。
- BUILD_TAG=v35-2026-09-13

## v36（2026-09-13）折叠式答题明细 + 链接收敛 + 模块章瘦身
（基于 v35 发布后用户看图反馈的五项调整）
1. **冰山图答题明细改折叠式**：v35 的「答题明细 →」跳转链接全部删除；RoadmapSection 新增 raw prop（ReportAssessmentData.raw）与 AnswersFold 行内折叠组件（buildAnswerBlocks(raw, kinds) 直出，段过滤口径 e3:乐学/会学/善学/条件/学能），冰山每一行（五系统 + 心理/DISC/MBTI/职业锚/霍兰德 + 学能行的多元五项）行尾直接挂折叠块，点开就看，不离开当前页。
2. **框架图取消图表链接**：SystemFramework 已测徽章/单元块全部改纯静态展示（不再有 → 与点击跳转）；FrameworkLink 只剩 assess（未测徽章→测评中心）与 fill-academics（成绩未填→去填写）两种动作；底部提示改为「灰虚线徽章可直接点击开始测评」。
3. **层内重点项**：改回静态 chip 但按三档着色（红 #8f1313 卡点 / 黄 #8a6d1a 待提升 / 绿 #5a9326 正常，E3V37_LEVEL_STYLE），每行单元格下方挂该层答题明细折叠；备注文案同步改为折叠口径。
4. **「先抓这三件事」整块删除**（PrioritiesCard 组件与两处使用全删，距 v35 移入仅一轮）。
5. **模块章分项介绍删除**：combined.ts 删 abilityItemOf 及 secModules 的 items/itemsVisible——三能结论卡与「详细报告文字」折叠里的逐项详细解读重复，只保留 detailItems；条件/学能章的 items 是正文非重复内容，保留。
6. **图形与图表默认展开**：Fold 组件加 defaultOpen；CollapsibleSection 与 RoadmapSection 的「图形与图表」折叠默认展开（标题改「默认展开，点击可折叠」），详细文字/答题明细仍默认收起；打印强制展开逻辑不受影响。
7. **reveal 简化**：RevealTarget 只留 assess/fill-academics 两型；ansblk-* 锚点 id 保留（冒烟断言用，无跳转逻辑依赖）。
- 冒烟：`scripts/smoke-render-v36.tsx`（26 项断言，v35 脚本已删；数据层断言三模块章 items 为空且 detailItems 保留）。
- 验证：tsc app 配置仍仅 3 个历史遗留错误；npm run build 通过；冒烟全过。
- BUILD_TAG=v36-2026-09-13

## v37（2026-09-13）DISC V2 强迫选择改版 + 综合报告打印隐藏
（v37 需求五项中的 Q1/Q5；Q2 双心理量表、Q3 亲子对照栏目在 v38；Q4 分学段审题清单待用户逐条确认后实施）
1. **DISC V2（学生+家长）**：contracts/assessments.ts 新增 DISC_V2_GROUPS / DISC_PARENT_V2_GROUPS（24 组 × 4 词，每组 D/I/S/C 各一；家长版同维度顺序、家庭场景措辞，保证亲子同尺可比）、DiscV2Answers{most,least}、isDiscV2Answers、scoreDiscV2（最像+1/最不像-1 → 净分归一到 0–24：12+净分/2，可出 .5；result.version=2）。旧版 scoreDisc/DISC_QUESTIONS/DISC_PARENT_QUESTIONS 保留供旧结果渲染。DiscResult 增加可选 version 字段；主型/summary 逻辑抽 discSummaryFromDims 共用。
2. **API**（profileRouter）：questions 的 disc/discparent 改下发 groups；submit 的 answers 支持 V2 对象（zod refine 同组最像≠最不像）并兼容旧版数组（升级期在途会话）；计分按作答形态分流 scoreDisc / scoreDiscV2（家长版传 DISC_PARENT_V2_GROUPS）。
3. **答题 UI**：新建 `src/components/companion/DiscV2Quiz.tsx`（学生版 + 导出 DiscV2GroupsUI/pickDiscV2 复用件；点词先填「最像」槽再填「最不像」槽，可点已选词取消，双槽齐后 260ms 自动进下一组；草稿 key discv2）；DiscParentQuiz 重写为 V2（保留家长身份选择流，草稿 key discparentv2）；AssessmentCenter 的 disc 路由到 DiscV2Quiz（mbti 仍走 ChoiceStage，ChoiceStage 题包类型按 mbti 收窄）；Welcome onboarding stage3 改用 DiscV2Quiz。测评中心 disc 卡片摘要：旧版结果标注「（旧版题目，建议重测）」。
4. **报告兼容**：DiscTendencyChart 加 max prop（V1=12/V2=24）；DiscDetail 加 version prop，旧版头卡显示「旧版题目 · 点这里重测 →」徽章；DiscParentTab 家长卡同样徽章 + 条形量尺按 version 适配；DiscParentCompare 统一换算 0–24 量尺（旧版 ×2，nv()），冲突阈值调为 |Δ|≥6 强烈冲突 / 4–5 需留意；answerBlocks disc/discparent 明细支持 V2 三种作答形态（V2 行=「最像「x」· 最不像「y」」，旧版块 note 标「（旧版题目）」）。
5. **打印隐藏（Q5）**：综合报告详版+简版打印时隐藏——RoadmapSection 的 AnswersFold（details 加 print:hidden）、详版各章 answersNode 与附录章观察点得分表（包 print:hidden div）、简版末尾两个附录 Fold（观察点得分表 + 全部测评答题明细）；E3 tab（学业诊断报告）的附录保持正常打印。combinedView 支持 ?view=lite 深链（冒烟需要）。
- 冒烟：`scripts/smoke-render-v37.tsx`（v36 全量 26 项 + v37 增量 11 项：V2 题库结构/计分极值/判别/明细兼容/V2 tab 渲染/旧版徽章/print:hidden 断言/E3 附录不隐藏）。运行：`npx esbuild scripts/smoke-render-v37.tsx --bundle --platform=node --format=cjs --jsx=automatic --tsconfig=tsconfig.app.json --outfile=scripts/.smoke.cjs && node scripts/.smoke.cjs`
- 验证：tsc app 配置仍仅 3 个历史遗留错误；npm run build 通过；冒烟全过。
- BUILD_TAG=v37-2026-09-13
- **待办（v38）**：Q2 SDQ（25 题，4-17 岁）+ PHQ-A/GAD-7 学生化（11+）双量表并行选做、去「三甲医院」措辞；Q3 亲子对照独立 tab + 综合报告章 + 简版摘要卡；Q4 分学段题目优化（清单已交用户确认，已知：PRIMARY q4/q34/q50「高中约7—8小时」误植、q68 30分钟偏长；JUNIOR q4；学科快扫 junior 缺生物/地理、primary 可加科学）。

## v38（2026-09-13）E3 分学段题目优化 + 家长报告栏目 + 附录整章不打印
（用户确认：Q4 清单 A/B 全改、C 不改；另追加：附录整章不打印、家长版独立专属报告）
1. **E3 分学段题目**（contracts/e3v37.ts，只改小学/初中卷，高中卷不动）：小学卷 q4→「想读哪所中学、长大想做什么样的事」、q8→「知道为什么学习——成为更厉害的自己」、q10→「做了不起的事帮到很多人」、q26→「画图或列表串知识」、q34→「期末、升初中目标」、q35→「先做重要着急的作业」、q42→「错的是不会/粗心/时间不够」、q50→「小学约9—10小时」（原误植高中7—8小时）、q68→「连续20分钟」；初中卷 q4→「想读哪所高中+对长大做什么有初步想法」。e3v37Parent P9 镜像题措辞同步（画图或列表）。学科快扫科目未动（C 不改）。
2. **打印**：综合详版「附录章」整章 print:hidden（CollapsibleSection 外包 div；此前 v37 已隐藏章内得分表与各章答题明细）；E3 tab 附录仍正常打印。
3. **家长报告独立 tab**（TABS 将「家长 DISC」改为「家长报告」，key="parent"；旧 ?tab=discparent 深链兼容）：ParentReportTab 组件（ReportView 内，替换原 DiscParentTab）五版块——① 亲子冲突点清单与改进方案（buildParentChildAnalysis 聚合：severeConflict 红线 / 每位家长 DISC 频道冲突 0–24 量尺 |Δ|≥6 / 高估 / 低估 / 家长认为较差 / 了解不足 + 对应建议）；② 家庭支持与环境观察（condView 卡：家长观察 × 孩子自评分级 chip）；③ 家长认知对照（blindSpots 表格：家长评/孩子自评/差值/高估低估徽章）；④ 亲子 DISC 对照（DiscParentCompare + 每位家长结果卡含管教风格/冲突点/建议/旧版徽章）；⑤ 答题明细双 Fold（e3parent + discparent）。空态双 MissingCard 分别引导两份测评。
4. **综合报告新章**：combined.ts 新增 secParentChild「亲子对照与沟通建议（家长卷 × 家长 DISC）」，紧随条件模块章（条件大类），含冲突点清单卡（标 !! 时 level=卡点）与沟通优化建议卡；仅在有 e3parent 或 discParents 时生成。ReportView chartNode 新增「亲子对照」映射 → DiscParentCompare；answerKindsForSection 新增「亲子对照」→ ["e3parent","discparent"]（答题明细随章下沉、打印隐藏同其他章）。
5. **一页简版**：CombinedLite 新增 e3parent/discParents props 与「亲子对照 · 摘要」卡（前 3 条冲突 + 一条核心建议 + 条数指引）。
6. **入口**：AssessmentCenter 的 e3parent/discparent 卡片报告跳转 tab 改 "parent"（原 discparent 指向学生 DISC 页的问题解决）；canDownload/TAB_TITLE 适配 parent。
7. **combined.ts 亲子 DISC 差值量尺归一**：新增 discNorm（V2 原值 / V1 ×2，0–24 同尺），冲突阈值 |Δ|≥6 强烈 / 4–5 需留意（原 0–12 量尺 ≥3/=2 在 V2 下失真）；buildParentChildAnalysis 用同款 discNv。
- 冒烟：`scripts/smoke-render-v38.tsx`（v37 全量 + v38 增量 18 项：题目修改断言、家长 tab 四版块+明细+空态+旧深链、综合亲子章+图表、简版摘要卡、附录整章 print:hidden）。
- 验证：tsc app 配置仍仅 3 个历史遗留错误；npm run build 通过；冒烟全过。
- BUILD_TAG=v38-2026-09-13
- **待办（v39）**：Q2 双心理量表——SDQ 学生自评版 25 题（4-17 岁，五维 + 保留 1 条自伤安全预警题沿用红线）+ PHQ-A 9 题/GAD-7 学生化（11 岁以上），两套可分别选做、结果都进报告、各标适用年龄；去全部「三甲医院」措辞改「国际通用筛查工具」；旧 V1/V2 结果兼容+提示重测（isMentalV2 按 length===16 判别需扩展版本识别；answerBlocks mental 块适配；测评中心 mental 入口改双量表选择页）。

---

## v39（2026-09-14）—— 家长报告看图反馈：去重 + 红色强化 + 对照卡 + 通俗化

用户反馈（附 2 张亲子 DISC 对照截图）：① 综合报告里亲子 DISC 图表+解释在条件章和亲子章重复，只出现一次；② 家长报告冲突对比强烈处用红色标出；③ 认知差异对照着列出来一目了然；④ 家长报告更通俗易懂。

### 改动
1. **去重（承接 v39 前半）**：ReportView 条件模块 chartNode 删 DiscParentCompare（只留 mental）；combined.ts secCond 删亲子 DISC 对照卡 for-loop——图+解释只留在「亲子对照与沟通建议」章。冒烟断言：综合详版 `亲子 DISC 行为风格对照` 恰好出现 1 次。
2. **DiscParentCompare.tsx**：
   - 新增导出 `DISC_DIM_PLAIN`（D=谁说了算、听谁的 / I=爱热闹、爱表达 / S=求稳、怕变化 / C=重细节、讲规矩）。
   - `FactorBars` 加 `hot?: DiscType[]`：hot 行 `bg-[#fbe3df] ring-1 ring-[#b91c1c]/50`，标签/分值红粗 `#8f1313`，bar opacity 1。主组件对每位家长算 strong dims（nv |Δ|≥6）传 hot；学生 FactorBars 传所有家长 strong dims 并集。
   - DimDeltaBadges 白话化：「⚠ I（爱热闹、爱表达）明显顶牛：你 12 分 / 妈妈 20 分，差 8 分」「略有差异」；导语改「差 6 分以上算明显顶牛」。
3. **ReportView.tsx**：
   - `buildParentChildAnalysis` 返回 `conflicts: {text, hot}[]`（hot：严重亲子冲突、DISC 强冲突、高估 gap≥3、家长认为较差）；文案通俗化（「明显顶牛」「家长打 X 分、孩子只给自己 Y 分」「先把情况了解清楚，再谈怎么管」）。两个消费方（ParentReportTab 冲突清单、CombinedLite 摘要卡）同步改：hot 条目红卡 `#fbe3df`+`ring-[#b91c1c]/50` 红粗字。
   - ③ 家长认知对照：表格 → **对照卡网格**（md:grid-cols-2）。每卡：kp + 判读徽章（差 N 分 · 家长更乐观/家长没看到，gap≥3 实底红徽章）+ 镜子题题干（`E3V37P_MIRROR_QUESTIONS` 按 b.key 查 text，「对照的事：…」）+ 并排「家长的估计 x/5 vs 孩子的实际感受 y/5」+ 白话含义句（高估→「别只夸，先问问难在哪」；低估→「值得当面肯定一次」）。gap≥3 整卡红底。
4. **combined.ts**：删除因去重而 unused 的 `DISC_PARENT_STYLE`/`DISC_CHILD_REACT` 常量与 `DISC_REPORTS` import（tsc TS6133）；`DISC_CONFLICT` 保留（亲子章仍在用）。

### 验证
- tsc 基线外无错；build OK；`scripts/smoke-render-v39.tsx`（v38 全量 + v39 增量 9 项）全过——家长 DISC 假数据改为 V2 强冲突（I=20/D=2 对学生全 12）以触发 hot 路径。
- BUILD_TAG=v39-2026-09-14。

### 待做
- 【v40】Q2 双心理量表：SDQ 学生自评 25 题（4-17 岁，五维+1 条自伤安全预警题沿用红线）+ PHQ-A 9 题/GAD-7 学生化措辞（11+）；两套可分别选做、结果都进报告、各标适用年龄；删全部「三甲医院」措辞改「国际通用筛查工具」（保留 12356 热线：mentalHealth.ts 4 处 + AssessmentCenter mental def + combined.ts mentalCard）；旧 V1(30题)/V2(16题) 兼容+提示重测；kind/版本识别扩展；answerBlocks 适配；测评中心 mental 入口改双量表选择页。

---

## v40（2026-09-14）—— 双心理量表学生版 + 框架图分数徽章

用户需求：新增两套学生版心理量表（SDQ + PHQ-A/GAD-7 学生化），原量表保留改名「通用版」放最后；三套都标（选做），做了就进报告；删「三甲医院」措辞。框架图「学业诊断 ·」徽章去前缀、按分数红黄绿+档位标注。

### 改动
1. **contracts/mentalHealth.ts**：
   - 措辞：「三甲医院」全改「国际通用筛查工具」（文件头、MENTAL_V2_DISCLAIMER、两段 description），12356 热线保留。
   - **学生版 A · SDQ**：`MENTAL_SDQ_QUESTIONS`（标准 SDQ 学生自评 25 题 + 第 26 题安全预警题，0-2 三级评分，反向题 q7/q11/q14/q21/q25）；`scoreMentalSdq` → MentalSdqResult{version:"sdq", dims, dimBands, totalDiff(0-40), totalBand(0-15 正常/16-19 边缘/20+ 明显), level(沿用 V2 词表), selfHarm(末题≥1→高风险)}；`isMentalSdq`、`MENTAL_SDQ_OPTIONS/INTRO/AGE(4—17 岁，11 岁以下家长陪读)/DISCLAIMER/SAFETY_NOTICE`、`SDQ_DIM_LABEL`。
   - **学生版 B · PHQ-A**：`MENTAL_PA_SECTIONS`（PHQ-A 9 题 + GAD-7 学生化 7 题，题号全局 1-16，复用 V2 选项/引导语/分级）；`scoreMentalPa`（复用 scoreMental 算法，version:"pa"）；`isMentalPa`、`MENTAL_PA_AGE(11 岁以上)`、`MENTAL_PA_DISCLAIMER`。
2. **api/profileRouter.ts**：kindSchema + mentalsdq/mentalpa；questions 两个新 case（sdq 平铺 questions；pa 复用 V2 options/intro）；submit 两个新 schema（26×0-2 / 16×0-3）与计分分支；latest 增加 mentalSdq/mentalPa 字段（discparent 式 continue 逻辑外用三元判断已存在）；两套均不同步档案、不影响 onboarding。
3. **DB 迁移 0013_mental_v40_kinds**：assessment_results.kind enum 加 'mentalsdq','mentalpa'（db/schema.ts + db/migrations/0013.sql + meta/_journal.json idx13 + api/migrationsEmbedded.ts 同步）。**发布后需平台跑迁移生效。**
4. **前端答题**：新建 `MentalSdqQuiz.tsx`（平铺 26 题、0-2 选项、末题红线提示、结果卡五维度+困难总分）；新建 `MentalPaQuiz.tsx`（克隆 MentalQuiz，kind/draft=mentalpa，PHQ-A 文案）；MentalQuiz 改名「通用版」、删三甲医院措辞。
5. **AssessmentCenter**：TESTS 插入学生版 A（doneOf latest.mentalSdq）、学生版 B（doneOf latest.mentalPa），原 mental 条目改名「心理健康筛查 · 通用版（PHQ-9 + GAD-7）（选做）」放最后；QuizStage 两个新分支。
6. **报告层**：
   - ReportView：data 类型加 mentalSdq/mentalPa；**mentalSdq/mentalPa 声明前移到 combined memo 之前（TDZ 修复）**；MentalV2Bars 加 variant="v2"|"pa"；新建 MentalSdqBars；mental tab 重写为三套并列（有结果显示 bars+解释卡，无结果给 MissingCard 直达链接；全空给三入口）；canDownload mental 判三套；框架 status.mental.note 聚合三套分级；冰山 underRows 心理 chips 三套 + AnswersFold kinds 含新两种；条件章 chartNode 优先 SDQ→PA→通用→legacy。
   - combined.ts：CombinedReportOptions 加 mentalSdq/mentalPa；overviewCards 三张心理卡（学生版A/B/通用版）；belowIce 两套新红线；secCondItems 插入 sdqCard/paCard/mentalCard 三卡（selfHarm 均「卡点」红）。
   - answerBlocks.ts：mentalsdq（26 题 0-2，安全题标 [安全预警]）与 mentalpa（16 题 0-3）明细块；条件模块 kinds 加两套。
7. **SystemFramework.tsx**：新增 `frameworkScoreLevel`（<3.0 卡点 / <3.8 待提升 / ≥3.8 正常）+ `ScoreChip`（按档红黄绿）；三阶+条件+学能 5 处已测徽章从 LinkChip「学业诊断 · X n/5」改为 ScoreChip「X n/5 · 档位」，未测仍 LinkChip「学业诊断 · 未测」可点击。

### 验证
- tsc 基线外无错；build OK；`scripts/smoke-render-v40.tsx`（v37-v39 全量 + v40 增量）全过：SDQ 反向计分手工核对（全 0 → conduct=2/peer=4/hyper=4/total=10）、双红线触发、框架徽章五处文案+去前缀+红色、mental tab 三量表、综合报告三心理卡+明细、「三甲医院」全灭、「国际通用筛查工具」与 12356 保留。
- BUILD_TAG=v40-2026-09-14。

### 注意
- 发布前确认平台执行 0013 迁移，否则新两套提交会被 DB enum 拒绝。

### v40 补丁（同日，全量审查修复）
- **伴学师端遗漏修复**：api/studentDetail.ts `OPTIONAL_KINDS` 加 mentalsdq/mentalpa（否则伴学师看不到学生新量表结果）；StudentDetailDrawer 已测清单与 ReportView data 透传同步加两套。
- 框架图「心理健康 · 未测」点击入口从 mental 改为 mentalsdq（学生版 A 优先）。
- **全量计分审查**（scripts/.audit.ts 极值/模式作答 20 项）：MBTI/E3/multi5/职业锚/霍兰德/心理四套（V1/V2/SDQ/PA）/家长卷全部 PASS。DISC 两项初判 FAIL 复核后结论：
  - V1「全 0/全 1 同主型、总分 24」= 测试假设错误（题库每维 a/b 各 6 次完全均衡，全 0 → 各维 6 分平局 → 按 D 优先），非 bug。
  - V2「模式作答主型偏移」= **词位分布轻微不均衡**（每维在四词位出现 5-8 次不等，如 D 在第 2 位 8 次、第 3/4 位各 5 次；理想应各 6 次）。对按词义作答无影响，仅对「按位置习惯作答」有轻微偏差；学生/家长版同步同构。**注意：直接重排词序会使历史作答明细（按词下标存储）错标，若要修需连带版本号。**

### 全系统审查结论（v40 收尾，详见对话汇报）
1. 伴学师端 OPTIONAL_KINDS 缺新 kind（已修）；2. DISC V2 词位不均衡（轻微，暂缓）；3. tsc 基线 3 个历史遗留错误（AcademicsSubmit 科目名字面量、StudentDetailDrawer/AcademicsForm/AcademicsStage 三处）仍在，与历次改动无关，建议择机清理；4. latest 接口 early-break 条件未含新 kind（仅多扫几行，无功能影响）；5. 简版 AssessmentChartsLite 心理图只画通用版（SDQ/PA 暂不进简版图解，详版/框架图/冰山均已覆盖）。

---

## v41（2026-09-14）—— 心理健康报告详细化 + 三套自选页 + 明细折叠

1. **详细解读素材**（contracts/mentalHealth.ts 追加 V41 块）：`MENTAL_SCORE_GUIDE`（分数怎么看：量表是频率信号非判决、复测对比>单次）；SDQ_DIM_EXPLAIN（五维：观察什么/分数代表什么/建议）；PHQ9_ITEM_EXPLAIN、GAD7_ITEM_EXPLAIN（逐题观测点说明，第 9 题标红线）；MENTAL_V2_BAND_GUIDE（四级含义+行动）、MENTAL_SDQ_BAND_GUIDE（正常/边缘/明显含义）。
2. **ReportView mental tab**：顶部 MentalScoreGuideCard；SDQ 结果下 SdqDimExplainCard（每维本次得分徽章+观察/含义/建议+分档总表）；PA/通用版结果下 PhqGadExplainCard（PHQ 九观测点+GAD 七观测点+分级总表，红线题按 selfHarm 标红）；三套答题明细 Fold 挂各自结果卡下方（AnswerDetailsByKind kinds 各一套）。旧版十因子仍走 MentalDetail。
3. **测评中心三套自选**：TESTS 三条合并为一条「心理健康筛查（三套量表 · 选一套做）」（summary 聚合三套，doneOf 任一已测）；新增 MentalChooser 选择页（A/B/通用三卡片：适用年龄、题数时长、已测状态+结果摘要、开始按钮）；QuizStage kind=mental 进 chooser。报告侧深链全部改 start=mental（进 chooser），框架图心理未测入口同。
4. 综合报告条件章心理三套明细：answerKindsForSection 条件模块 kinds 已含 mentalsdq/mentalpa（v40 已加），冒烟确认 ansblk- 存在。

验证：tsc 干净；build OK；smoke-v41（v37-v40 全量 + v41 增量 12 项）全过。BUILD_TAG=v41-2026-09-14。


---

## v42（2026-09-14，版本 27cae34，commit c557569）

用户四项指示（带附件：SCL-90 报告 PDF + DISC 报告 PDF/截图）：
1. SDQ 低龄不做家长版 → 标注「11 岁以下请家长引导填写」。
2. 学生版 B 的 GAD-7：信效度不能保证就删 → **恢复原版标准措辞保留**（PHQ-A 本身是青少年改编版有依据；GAD-7 改回 Spitzer 2006 原版，学生化措辞信效度证据无法继承）。
3. 心理健康加入附件一式「心理健康评估表+评估报告」→ 新增第四套 **SCL-90 深度评估**（90 题原版标准译本、10 因子、中国常模口径、附件式报告）。
4. DISC 图参考附件：竖线折线图 + 顶部灰色**反弹区**（≥80%，物极必反）。

### 改动清单

- **contracts/mentalHealth.ts**
  - MENTAL_SDQ_AGE →「11 岁以下请家长引导填写（陪同读题、帮助理解题意，答案仍由孩子自己选）」。
  - GAD7_STUDENT_TEXTS → GAD7_STANDARD_TEXTS（原版 7 条）；MENTAL_PA_SECTIONS 第二部分标题/描述更新；文件头注释改 V40/V42。
  - GAD7_ITEM_EXPLAIN text 对齐原版措辞（observe 不变）。
  - **SCL-90 全套**：Scl90FactorKey/SCL90_FACTOR_ORDER/SCL90_FACTOR_LABEL/SCL90_FACTOR_ITEMS（题号归属按标准手册）/SCL90_NORM（中国成人常模）/SCL90_OPTIONS(1-5)/SCL90_QUESTIONS(90 题，q15 safety)/MENTAL_SCL90_INTRO/MENTAL_SCL90_AGE/scoreScl90（总分/gsi/阳性项目/阴性/PSDI/10 因子均分/分级/筛选阳性 selfHarm=answers[14]>=2/level 映射/summary）/scl90FactorLevel（<2 正常，2-2.9 轻，3-3.9 中，4-4.9 偏重，≈5 严重——与附件口径一致）/isMentalScl90/MENTAL_SCL90_DISCLAIMER/SCL90_FACTOR_EXPLAIN(10 因子 meaning+low/mid/high+advice)/MENTAL_SCL90_RULES。
- **DB 迁移三处**（kind 加 'scl90'）：db/schema.ts mysqlEnum、db/migrations/0014_scl90_kind.sql + meta/_journal.json(idx 14, when 1789400000000)、api/migrationsEmbedded.ts。**发布前必须确认 0014 已执行**。
- **api/profileRouter.ts**：import/kindSchema/questions case/submit schema(90×1-5)/scoreScl90 分支/latest(mentalScl90 字段+early-break 三元+赋值)/profile 同步豁免。api/studentDetail.ts OPTIONAL_KINDS 加 scl90。
- **src/components/companion/MentalScl90Quiz.tsx（新）**：分页作答（10 题×9 页）、第 15 题红线卡、草稿 key "scl90"、结果卡（总分/阳性/总均分+10 因子表+红线+免责）。
- **AssessmentCenter**：MentalChooser 加第四卡（深度评估 SCL-90，xl 四列）；TESTS 描述/聚合 summary/doneOf 更新。
- **ReportView**：data 类型+声明+combined memo 传参；mental tab 空态条件含 scl90（四套）、深链补深度评估；SCL90 区块=Scl90ReportCard（附件式：评估背景→计分与标准说明→综合评估表(总分/总均分/阳性/PSDI+10 因子表含常模列)→逐因子 Fold 解读(在看什么/你的得分解读/改善建议)→免责）+明细 Fold；冰山 chips/canDownload/框架 status note 聚合四套。
- **combined.ts**：CombinedReportOptions+overviewCards+belowIce+scl90Card（条件章，selfHarm→卡点）+secCondItems 插入（sdq/pa/scl90/mental 顺序）。
- **answerBlocks.ts**：条件章 kinds 加 scl90；新增 scl90 明细块（[因子]/[生命安全] 标注，≥3 红）。
- **StudentDetailDrawer**：已测清单加「心理健康·深度评估(SCL-90)」+透传 mentalScl90。
- **DISC**：contracts/assessments.ts 加 discV2Counts（most/least 各维度计数 0-24）；ReportView 新增 DISC_REBOUND_HINT；DiscTendencyChart 重写为 SVG 竖线折线图（D/I/S/C 竖线+落点连线+顶部灰带反弹区≥80%+底部「xx 型（名称）」标签+反弹因子灰圈提示+反弹提示条）；DiscDetail V2 双图（校园中的我 MOST / 被压在身后的我 LEAST，口径诚实标注）+反弹区说明卡；DiscDetail props 加 v2Counts；主组件 discV2Split useMemo（raw 倒序找最近 V2 作答）。删 DISC_TRAIT_WORDS（unused）。
- **MentalPaQuiz**：标题/结果卡「学生版 B（PHQ-A + GAD-7 学生版）」→「（PHQ-A + GAD-7）」，GAD-7 焦虑筛查（标准版）。

### 验证
- tsc 无新增错误（基线 3 个历史 Academics 错误仍在）。
- smoke-render-v42（v37-v41 全量 + v42 增量）全过：SCL-90 计分手工核对（全 1/全 3/第 15 题红线/敌对 6 题全 5 因子隔离/分级边界 2.5=轻 3.0=中）、GAD-7 原版措辞、SDQ 家长引导、DISC MOST/LEAST 计数+双线图+反弹提示（D=24→专断）、SCL-90 评估报告+综合卡+ansblk-scl90。
- BUILD_TAG=v42-2026-09-14。发布顺序：确认 0013+0014 迁移已执行 → 发布。

### 遗留/备注
- DISC 第三张「压力下的我」未做独立图（净分 dims 图即 MOST−LEAST 口径，主卡头部已展示）；如要三图并列可后续加。
- SCL-90 适用 16 岁以上（常模成人），界面已标注；低龄学生仍走 SDQ。
- 简版报告心理图仍只画通用版（v41 遗留）。


---

## v43（2026-09-14，版本 30bfb7e，commit 1d44594）— v42 DISC 双图修正

用户看图反馈：v42 的 DISC 双图（校园中的我 MOST / 被压在身后的我 LEAST）「看不懂、好乱、自创概念」，且上方条形图（净分 12+net/2）与下方图（MOST/LEAST 原始计数）数值不一致。要求：**只要一个 DISC 结果，不乱创造，保证信效度**。

### 改动
1. **删双图**：DiscDetail 回到单图 DiscTendencyChart(dims 净分, max=24/12)；删 v2Counts prop、discV2Split useMemo、相关 import；contracts/assessments.ts 删除 discV2Counts 函数。
2. **分数口径注明**：DiscTendencyChart 默认 note（V2）改为「得分口径：该因子被『最像我』选中的次数 −『最不像我』选中的次数，归一到 0—24 量尺（12 分为中性，与上方条形图为同一份分数）」——消除数值对不上的困惑。
3. **保留**：竖线折线样式 + 顶部灰色反弹区（≥80% 物极必反）+ 底部「X 型（名称）」标签 + 反弹提示条 + 说明卡（用户明确要求的样式）。

### 验证
smoke-render-v43 全过（DISC 段改单图断言：反弹区/物极必反/得分口径/类型标签；负断言双图概念全灭；D 净分 24 进反弹区提示「果敢可能反成专断」）。tsc 无新增错误。BUILD_TAG=v43-2026-09-14。发布同 v42 合并考虑：发布顺序 迁移(0013/0014) → v40 → v41 → v42/v43。


---

## v44（2026-09-14，版本 2b3d47b，commit 9c00d73）— DISC 计分口径重做（信效度修正）

用户质疑 DISC 得分计算是否正确、要求采用国际通用计分并保证信效度、反弹区上下都要有。

### 诊断结论
- 计分算法本身**没有错误**：24 组×4 词强迫选择（最像/最不像），M+1、L−1 净分（-24..+24）= Thomas PPA 同构的国际通行原始分算法；学生版/家长版共用 scoreDiscV2（家长版词组家庭视角、维度映射逐组一致）。
- 真正问题：**展示换算把双极数据压成单极**（12+net/2 的 0-24 分），丢了方向信息（S -66% 被压成看不出方向的 6 分）；且反弹区只有上没有下。

### 新口径（全站统一）
- **双极倾向度 = 净分÷24×100%**（-100%…+100%，四因子合计恒为 0——附件「I 倾向度 86%、S -66%」同口径）。无常模表（PPA 常模为商业机密），全站标注「原始倾向度，未做常模转换」。
- 契约新增（contracts/assessments.ts）：DiscTendency、DISC_REBOUND_PCT=80、discTendencyFromDims（V2 (dims-12)/12×100；V1 (dims-6)/6×100）、discTendencyFromV2（原始作答权威口径）、DISC_BIPOLAR（D 掌控/配合、I 外向/内向、S 沉稳/急迫、C 严谨/灵活，附件原词）、discBand（<25 轻微/<50 中等/<75 明显/≥75 强）、discTendencyText（+50% 格式）。
- **ReportView DiscTendencyChart 重写为双极图**：Y 轴 -100…+100，中线 0% 加粗带箭头，每 25% 分段刻度；**上反弹区 ≥+80%、下反弹区 ≤-80% 双灰带**；落点标 +100% 式倾向度；底部「X 型（名称）」标签保留；高/低反弹各有提示条（高=物极必反专断/浮躁/僵化/挑剔；低=对立面走极端：失去主见/自我封闭/持续焦躁/散漫无章）。特征词阵定位改用倾向度。
- **DiscDetail 顶部四条 bar 替换为「行为特征轴 · 双极倾向度」**（附件式：掌控 D+ ←→ D- 配合，中线 0，条向左右伸展，右侧「+50% · 明显」徽章，底部「强 明显 中等 轻微 | 中等 明显 强」刻度）——与竖线图同一份分数。
- **DiscParentCompare 亲子对照**：改双极倾向度条（中线 0），冲突阈值 |Δ|≥50% 明显顶牛 / 33-49% 略有差异（与原 0-24 尺差 6/差 4 等比换算）；家长 tab 家长个人卡四条 bar 同步双极化；冰山 disc chips 改倾向度。
- **combined.ts**：disc 概览卡 note、discStateCard 逐因子解读与数据分析、亲子冲突文案（discNorm→倾向度，≥50% 阈值）全部换口径。
- scoreDiscV2 **未改**（dims 保留，数据库存储兼容；倾向度由 dims+version 推导，契约单一来源）。

### 验证
smoke-render-v44 全过：契约层（V2/V1/原始作答三种倾向度换算、discBand 分档、文本格式）、双极图关键词（高/低反弹区、行为特征轴、掌控/配合、+100%、未做常模转换、合计恒为 0）、负断言（旧单极口径、双图概念全灭）、D +100% 高反弹提示、C -100% 低反弹提示、亲子对照倾向度文案。tsc 无新增错误。BUILD_TAG=v44-2026-09-14。
发布顺序不变：迁移(0013/0014) → v40 → v41 → v44（含 v42/v43 全部内容，v42/v43 可不发布）。


---

## v45（2026-09-14，版本 7444d98，commit 5470779）— DISC 图形精修

用户三个反馈（附截图）：
1. 行为特征轴数值标注换顺序：**正值 +N% 标左轴、负值 -N% 标右轴**（值跟轴走，不再统一挤最右列）。
2. 竖线图**正值落点标注动物象徽**：D 老虎、I 孔雀、S 考拉、C 猫头鹰（>0 才标；负值/0 仍是普通圆点）。
3. **家长版也出单独的 DISC 行为详版**（与学生详版同构，标注清楚是家长版），几位家长显示几份；综合报告/家长/学生对应图形同步。

### 改动
- **contracts/assessments.ts**：新增 DISC_ANIMAL_FULL（老虎/孔雀/考拉/猫头鹰）、DISC_ANIMAL_BADGE（单字徽章 虎/孔/考/枭）。
- **ReportView**：
  - 提取共用组件 `DiscBipolarAxis`（值跟轴走版行为特征轴：左标签+左数值列+中心条+右数值列+右标签；t≥0 数值在左列、t<0 在右列；程度刻度按新列宽 padding 160）与 `DiscReboundExplain`（反弹区说明卡）；DiscDetail 换用。
  - `DiscTendencyChart` 落点：t>0 渲染动物象徽（r=12 因子色圆底+白色动物单字，反弹时外加深色光晕），t≤0 普通圆点；分值标签偏移 ±18/24 避让徽章；图下新增图例行「虎 = D（老虎）｜孔 = I（孔雀）｜考 = S（考拉）｜枭 = C（猫头鹰）」。
  - 新增 `DiscParentDetail`（家长版 DISC 行为详版）：家长版金色徽章（家长版 · {label}）+ 类型 + 管教风格一句话 + DiscBipolarAxis + DiscTendencyChart（标题「{label} 的行为之镜 · DISC 四因子倾向度（家长版）」）+ DiscReboundExplain + 与孩子冲突点/管教建议；家长 tab 的 parents.map 由旧个人卡改为渲染 DiscParentDetail（几位家长几份）。
- 综合报告/亲子对照：DiscParentCompare 与 combined 文本口径沿用 v44 倾向度（本次未动）；冒烟确认综合详版亲子章与文本卡正常。

### 验证
smoke-render-v45 全过（v37-v44 全量 + v45 增量）：动物象徽图例与正值徽章（D +100% 有「虎」、C -100% 无「枭」）、家长版详版（1 位家长渲染 1 份，含家长版徽章/特征轴/双反弹区/管教风格/冲突点/建议）。tsc 无新增错误。BUILD_TAG=v45-2026-09-14。
发布顺序：迁移(0013/0014) → v40 → v41 → v45（含 v42-v44 全部内容，中间版可跳过）。
