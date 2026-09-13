# 启思学伴 v2 — 前端规格（Stage 3 共用）

> 读者：Agent D（Welcome + Companion）、Agent E（Papers + Treehole）、Agent F（Dashboard/Gaps/Feynman/Layout/App 改造）。
> 接口一律以 /mnt/agents/output/app/api-v2-spec.md 为准（后端按它实现）。trpc 客户端：`import { trpc } from "@/providers/trpc"`，用法参照现有页面（如 src/pages/Gaps.tsx）。
> contracts 共享数据：`@contracts/content`（BANDS/SEVEN_STEPS/MOOD_TAGS/PLAN_KIND_LABELS）、`@contracts/assessments`（MBTI_QUESTIONS/DISC_QUESTIONS/E3_RATINGS 等题库）。若该文件暂缺，按 api-v2-spec.md 的字段定义先用类型占位，集成时对齐。
> 图片压缩工具已就绪：`import { pickAndCompress, compressImage } from "@/lib/image"`（返回 base64 dataURL）。

## 设计系统（必须遵守，不得另起风格）
- 色板：背景 cream `#fcfcdc`（bg-cream）、卡片 cream-card `#fffef0`（bg-card / .paper-card）、主文字与按钮 olive `#3d4a27`（text-olive / bg-olive）、次文字 olive-soft `#5a6a3d`、弱化 olive-mute `#8a9470`、主强调 lime `#8ebb3e`、lime-light `#a5cd50`、lime-tint `#c7d460`、lime-pale `#eef5da`、butter `#f2e297`、警示 terra `#c25e3a`。border 用 `border-border`。
- 工具类：`.mono`（数字/标签等宽）、`.paper-card`（纸卡阴影）、`.chip`（小胶囊）、`.accent-l`（左竖条强调）。Tailwind 色名见 tailwind.config.js（olive/lime/cream/butter/terra 系列）。
- 组件库：shadcn/ui 在 src/components/ui（Button/Card/Input/Textarea/Select 或原生 select/Tabs/Badge/Dialog/Progress 等 40+，先查再用）。图标用 lucide-react。
- 语气：面向初中生的中文，温暖具体，不说教；按钮文案动词开头（「开始预习」「录入错题」）。
- 禁：蓝紫渐变、emoji 堆砌（每张卡最多 1 个）、卡片套卡片超过两层、阴影脏背景。
- 加载态用 skeleton 或「加载中…」；空态给一句引导 + 一个行动按钮。
- 所有页面移动端优先（max-w-5xl 容器内），桌面同样好看。

## 路由总表（App.tsx 由 Agent F 维护）
- `/` Dashboard（F 改） · `/preview` `/preview/:code`（已有） · `/gaps`（F 改） · `/report`（已有）
- `/papers` 试卷分析（E） · `/treehole` 树洞心情（E） · `/companion` 伴学师（D） · `/welcome` 首次引导（D，无 Layout 包裹）
- 档案守卫：ProfileGuard 包裹 Layout 路由——`trpc.profile.get.useQuery()`；profile 为 null 或 (!onboarded 且 localStorage 无 `onboardingSkipped`) → `<Navigate to="/welcome" replace>`。加载中返回全屏「学伴唤醒中…」（F 实现）。

## Agent D：Welcome.tsx + Companion.tsx
### /welcome（首次引导向导，全屏无侧边栏，paper-card 居中，顶部进度点）
分 4 阶段，每阶段可「下一步」；顶部有「稍后再测，先进去看看」（写 localStorage.onboardingSkipped=1 → navigate("/")）：
1. **认识一下**：name、grade（下拉 初一~初三）、school（选填）、targetSchool（选填，「想考的高中」）、dailyMinutes（滑块/步进 15-120，默认 45，文案「每天大概能挤出多少分钟给自己？」）→ `profile.setup`。
2. **MBTI 快测**：`assessment.questions({kind:"mbti"})` → 28 题逐题二选一（A/B 大按钮卡片），可上一题；提交 `assessment.submit` → 展示结果卡（type 大字 + summary）。
3. **DISC 快测**：同上，24 题 → 结果卡（primary + summary）。
4. **学业陪跑诊断（E3）**：分组展示 40 道 1-5 评分题（按「动力与心态/习惯与执行/策略与应考/状态与环境」四组分节，1-5 用五个圆点选择，反向题不标注），然后动机单选（6 个大选项卡）、生活事件 10 题（0-3 四级）、3 道开放题（textarea，可留空）→ submit → 结果卡：三阶得分条（乐学/会学/善学）、九项涂档 chips（正常 lime / 警戒 butter / 危险 terra）、六型倾向 + 首步建议、redFlags 若有则温和提示卡（「最近是不是有点累？树洞随时可以说说话」）；最后按钮「开始使用 →」navigate("/")。
   - E3 结果页底部注明：本测评为初始定位，后续以你的真实学习行为数据持续校准。
### /companion（伴学师，Layout 内）
顶部标题「伴学师 · 陪你学会学习」。四个区块（Tabs 或纵向锚点均可，推荐 Tabs）：
1. **我的档案**：profile 信息卡（name/grade/dailyMinutes 可改保存：updateMinutes；mbti/disc 标签 chip）；测评入口按钮（跳 /welcome 可重测）。
2. **测评报告**：`assessment.latest` → MBTI 卡 + DISC 卡 + E3 卡（三阶条 + 九项 grid + 六型 + redFlags 提示 + priority 大字「XX优先」）。无数据时各卡显示「还没测过 → 去测一测」跳 /welcome。
3. **七步法导学**：`guide.today`/`guide.start` → 步骤条（SEVEN_STEPS 7 步，当前步高亮）；当前步卡片：title + why + prompt + tips 列表 + textarea + 「写好啦，下一步」(`guide.answer`) → 下一步；第 7 步后「完成今日导学」(`guide.finish`) → summary 卡。文案强调「每天 10 分钟，把学习流程走一遍」。
4. **课堂录音**：`recording.list` 列表（title/date/kpTitles chips/duration/note/transcript 折叠）；「记一节录音」表单：title、recDate（date input）、关联知识点（从 `graph.overview` 扁平化多选 chips）、durationSec（分钟数）、note；transcript 大 textarea（「把录音转文字/课堂要点粘到这里」）→ `recording.add`。删除按钮。

## Agent E：Papers.tsx + Treehole.tsx
### /papers（试卷分析）
- 列表态：`paper.list` 卡片流（title、examDate、score、itemCount、三区区间 mini 条）+ 顶部大按钮「+ 丢一份试卷进来」。
- 新建流（Dialog 或内联页）：
  1. 拍照上传：多图 input（accept="image/*" capture="environment" multiple），每张经 pickAndCompress，缩略图墙可删除（最多 6 张）；填写 title（默认「X 月 X 日试卷」）、examDate、score（如 82/100 选填）→ `paper.create`。
  2. **逐题定性（三步法第 1 步）**：「这套卷一共几道题？」输入 N → 生成题号列表，每题一行：结果三态按钮（✓ 做对 / ✗ 做错 / ½ 半对）；做错/半对时展开：提分区间三选一（BANDS 卡：1 会了但错=送分区 / 2 讲一遍就会=提分区 / 3 讲了也不会=攻坚区）、知识点下拉（graph.overview 扁平化，可空）、错因下拉（五种错因，可空）。工具条：「全卷都对」「以下全错」快捷。
  3. `paper.analyze` → **分析结果**：得分概览（right/wrong/half 计数条）、三区分布横条（BANDS 色）、每区一句话建议卡（summary.advice）、「已自动把 X 道错题收进错题本并排好复习」提示；CTA「去查漏补缺巩固 →」。
- 详情态：`paper.get` 展示照片（可点开大图）、逐题表格、summary。
- 空态：「把最近一张试卷丢进来，3 分钟告诉你分数都丢在哪。」
### /treehole（树洞心情）
- 顶部：「今天感觉怎么样？」心情选择（1-5 五个大圆钮：😣😟😐🙂😄 或自绘 SVG 脸）+ 标签 chips 多选（MOOD_TAGS）+ textarea（「这一周遇到的、烦的、开心的，都可以讲给我听」）→ `treehole.talk`。
- 提交后展示**树洞回信**：信纸样式卡（bg-butter/40 + accent-l），reply 全文；底部「回信已存进树洞」。
- 近 7 天心情条：CSS 实现的 7 根柱（高度=mood/5，无记录灰色矮柱，今天高亮）——不要用 recharts。
- 历史列表：`treehole.history` 倒序卡片（mood 表情 + tags chips + content 摘要 + reply 折叠「看回信」）。
- 页底一行小字：「树洞说的每句话只有你知道。如果烦恼很重，也试试告诉家长或老师，好吗？」

## Agent F：既有页面改造 + 导航 + 路由（你拥有 App.tsx / Layout.tsx / Dashboard.tsx / Gaps.tsx / FeynmanChat.tsx / PreviewList.tsx）
1. **Layout.tsx**：侧边栏 NAV 扩为 7 项（首页/预习中心/查漏补缺/试卷分析(ClipboardList)/树洞心情(HeartHandshake)/伴学师(Sprout)/学习报告）；移动底部导航 5 项（首页/预习/查漏/树洞/我的→/companion）；grid-cols-4 改 grid-cols-5。
2. **App.tsx**：新增 /papers /treehole /companion /welcome 路由；ProfileGuard（见上）；`/welcome` 不套 Layout；Report 和 Dashboard 的图表按需加载（React.lazy + Suspense，fallback 用 skeleton 高度占位）：把 Dashboard 里的 recharts 图抽成 `src/components/DashboardCharts.tsx` 默认导出并 lazy 引入；Report.tsx 整页 lazy。目标：首屏 JS 里不再直接 import recharts。
3. **Dashboard.tsx**：
   - 顶部加「今日计划」大卡：分钟快选 [20,40,60,90] + 「生成今日安排」(`plan.generate`) → 计划项列表（PLAN_KIND_LABELS chip + title + 分钟数 mono + 圆形勾选 `plan.toggleItem`）；已有计划（`plan.today`）直接展示并可继续勾选；「为什么这样安排」折叠区展示 explanation 列表。genereate 后 invalidate plan.today。
   - 心情小组件：若 `treehole.todayMood` 无记录 → 小条「今天感觉如何？去树洞说一句 →」；mood≤2 → 温和提示「今天计划已为你减量」。
   - 保留原有：streak、两张任务卡（预习/查漏）、统计、雷达+柱状图（挪进 DashboardCharts）、最弱 5 知识点。
4. **Gaps.tsx**：
   - AddErrorForm 增加：a) 提分区间三选一卡（BANDS，默认 2；每个卡 name + desc）；b) 「拍题目照片」按钮（input file capture="environment"，pickAndCompress → 缩略图预览可删除）→ addError 带 imageData。
   - 错题列表每行加 band chip（BANDS[b].short + 色）与 📷 标记（hasImage 时）；ErrorDetail 里若 hasImage 用 `gaps.getImage` 懒加载展示照片。
   - 页头右侧加按钮「试卷分析 →」跳 /papers。
   - 复习队列项显示 band chip。
5. **FeynmanChat.tsx**：输入框左上加麦克风按钮——Web Speech API：`(window as any).webkitSpeechRecognition || (window as any).SpeechRecognition`，lang="zh-CN"，interimResults=true；录音态按钮变 terra 呼吸动画，实时转写追加进 textarea（可编辑）；再点停止。不支持则隐藏按钮。加一行小字「也可以直接按住说话转文字」。
6. **PreviewList.tsx**：知识点行/掌握度条处使用 overview 新增的 `previewed` 字段——已预习但 score<60 的行显示 lime chip「已预习」；分数为 0 且未预习显示「未开始」。useQuery 加 `refetchOnMount: "always"`（修复「预习完仍显示未开始」）。

## 质量门槛
- 每个文件 ≤450 行，超出就拆子组件（src/components/ 下新文件归各自前缀，如 WelcomeXxx.tsx 放 src/components/welcome/）。
- 不得修改：api/、db/、contracts/、.env、package.json、tailwind.config.js、index.css、不属于自己的页面文件。
- 自查：`npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -40`（只读不写 buildinfo），把与你文件相关的报错清零；与后端路由类型相关的报错（trpc.paper.* 不存在）属正常，留给主代理集成。
