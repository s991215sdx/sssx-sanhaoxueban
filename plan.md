# 三好学伴 v34 开发计划（2026-09-13）

基于包内 v33.2 代码继续开发。项目已置于 `/mnt/agents/output/app`。线上地址 sanhao2.kimi.site 不变（用户手动点发布）。

## 需求拆解（来自用户反馈 + 4 张截图）

1. **综合报告头部**：删除概要九宫格（OverviewGrid）；学习力系统框架图移到最上面；框架图融入所有测评节点，并标明「已测（带结果值）/ 未测」。
2. **综合结论章**：顶部两段文字（你是ESTP…/优先训练方向…）合并下沉到章末「概要总论」；章节直接以「第一步 · 理清现状与目标」卡片开场。
3. **冰山图重排**：冰山下从上→下依次为：学能·能力系统、善学·加速系统、会学·行为系统、乐学·动力系统、条件·支持系统、心理健康、DISC行为、MBTI性格、职业锚（新增行）、霍兰德兴趣。各系统内部行序也倒转（如乐学：韧劲/信心/动力；条件：资源/关系/状态；善学：智学/复盘/计划；会学：会用/记住/学懂）。第三步「建议进步方案」表行序同步倒转。
4. **答题明细折叠上移一级**：从「详细报告文字」折叠内部移出，成为与「图形与图表」「详细报告文字」并列的独立折叠。
5. **删除「成绩现状与目标分数」独立章节**（信息已在第一步表格与概要总论中体现）。
6. **「给家长的话」重写**：分块卡片化、短句、通俗易懂、排版清晰。
7. **成绩与目标 · 伴学师代填**：coachRouter 新增 saveAcademics mutation（伴学师仅限名下学员，admin 不限）；伴学抽屉中学业目标区变为可编辑。
8. **成绩与目标 · 注册即填**：Welcome 向导在「认识一下」后新增「成绩与目标」步骤（可跳过）。
9. **学员报告完整同步到伴学师端**：报告渲染与学生端完全一致（含框架图/冰山/雷达等所有图）；伴学师可查名下所有学生的所有报告 tab；伴学端保留训练方案（V2.7 旧卡保留 + 新增 V3.7 训练方案卡）。

## 阶段规划

### Stage 0 · 环境基线（Orchestrator）
- npm ci；tsc 双配置基线；npm run build 基线。

### Stage 1 · 并行（文件不交叉）
- **Agent A（coder）· 报告内容层** `src/data/reports/combined.ts`：
  - secConclusion：两段 paragraphs 改写融入 closing（概要总论），paragraphs 清空；
  - secAcad 不再 push 进 sections（保留计算逻辑供他处引用，若 acadPriorityNames 无他用则一并清理）；
  - secParents「给家长的话」重写为 items 卡片结构（三件事/沟通/陪写/动力/聊分数/提醒，短句通俗）。
- **Agent B（coder）· 后端** `api/coachRouter.ts` + `api/studentDetail.ts`：
  - coach.saveAcademics mutation（tutor 校验名下、admin 放行，zod 校验复用 profileRouter 规则）；
  - getStudentDetail 的 assessments 增加 e3parent、discParents（数组，含 label/result/createdAt），raw 也收录这两种 kind——支撑伴学端报告与学生端完全一致。

### Stage 2 · 并行（文件不交叉）
- **Agent C（coder）· 报告视图层大重构**：
  - 新增 `src/components/reports/ReportView.tsx`：把 ReportDetail 页面全部渲染（含所有 tab、图表、RoadmapSection、CollapsibleSection 等内部组件）提取为受控组件，props 接收 assessment data + profile + viewer("student"|"tutor") + 可选 academics 编辑回调；`src/pages/ReportDetail.tsx` 变为数据获取壳（assessment.latest + profile.get）。
  - 需求 1：删 OverviewGrid；SystemFramework 改造（可选 props：各测评状态→已测带值/未测灰虚线徽标；新增「深层特质」行：MBTI/DISC/霍兰德/职业锚；心理健康挂条件系统、多元五项与八维挂学能系统、成绩挂顶部节点），置于报告最上方。
  - 需求 3：RoadmapSection 冰山重排 + 新增职业锚行 + 层内行序倒转 + 第三步方案表倒序。
  - 需求 4：CollapsibleSection 增加 answers 折叠（与图形/详细文字并列）。
- **Agent D（coder）· 成绩表单复用 + 注册向导**：
  - AcademicsForm 抽取受控核心编辑器（grade/initial/onSubmit 由外部注入），学生版保持现行为；
  - Welcome.tsx 新增「成绩与目标」步骤（认识一下之后，可跳过），用核心编辑器 + profile.saveAcademics。

### Stage 3 · 伴学端整合（依赖 Stage 1B + 2C + 2D）
- **Agent E（coder）**：StudentDetailDrawer / StudentReportCards 改造——测评报告区整体替换为 ReportView（tutor 模式，全部 tab、图表齐全）；学业目标区接入核心编辑器（coach.saveAcademics）；保留 CoachingPlanCard（V2.7）并新增 V3.7 训练方案卡（src/data/training/ 新建 e3v37Training 映射，方法 id 引用 methods.ts）。

### Stage 4 · 集成验证（Orchestrator 亲自）
- tsc 双配置全绿（除已知 router.ts:72）；npm run build；grep 构建产物关键文案；逐项核对需求清单。

### Stage 5 · 交付
- 更新 HANDOFF.md（v34 记录）；website_version_manager build_version（type=dynamic, project_dir=/mnt/agents/output/app）；告知用户点「发布」。

## 红线（沿用 HANDOFF）
- 禁改 api/kimi/、api/lib/、api/queries/connection.ts、drizzle.config.ts、.env
- 改文件前必读；同文件不并行编辑；每次编辑后 grep 验证
- 交付前 tsc + build 必须真实通过
