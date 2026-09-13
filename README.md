# 三好学伴（网站智能体）

K12 个性化伴学 Web 应用。当前版本 **v33.2（2026-09-13）**，线上地址 <https://sanhao2.kimi.site>。

- 前端：React 19 + Vite + Tailwind CSS + shadcn/ui + Recharts
- 后端：Hono + tRPC（superjson）+ Drizzle ORM（mysql2）
- 数据库：MySQL 兼容（线上用 TiDB Serverless）
- AI：Moonshot Kimi API（可选，不配置则自动降级为规则引擎）

## 一、安装与运行

```bash
npm ci                # 安装依赖（Node 20+）

# 本地开发（前后端热更新）
npm run dev

# 生产构建 + 启动
npm run build         # 产出 dist/（前端静态资源 + dist/boot.js 后端）
npm start             # 等价于 NODE_ENV=production node dist/boot.js，监听 3000 端口

# 类型检查 / 测试 / 数据库
npm run check         # tsc 全量检查
npm test              # vitest
npm run db:migrate    # 执行数据库迁移（启动时也会自动执行）
```

首次启动会自动执行数据库迁移与知识点播种（约 5-10 分钟，后台执行不阻塞启动）。
健康检查：`GET /api/trpc/ping?input={"json":null}`；`GET /api/trpc/system.dbHealth?input={"json":null}`。

## 二、环境变量

复制 `.env.example` 为 `.env` 并填写（**压缩包不含 `.env`**，内含数据库密码等敏感信息，请向原开发者索取或在部署平台的环境变量设置中查看）：

| 变量 | 必需 | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ | MySQL 连接串（TiDB Serverless / 任意 MySQL 8） |
| `APP_ID` / `APP_SECRET` | ✅ | 应用 ID / 密钥（JWT 签名） |
| `KIMI_AUTH_URL` / `VITE_KIMI_AUTH_URL` / `VITE_APP_ID` | ✅ | Kimi 登录 OAuth |
| `KIMI_OPEN_URL` | ✅ | Kimi 开放平台地址 |
| `OWNER_UNION_ID` | ✅ | 创建者 union id，首次登录自动成为 admin |
| `MOONSHOT_API_KEY` | 可选 | AI 能力（不配置则全部降级为规则引擎）；`MOONSHOT_BASE_URL` / `MOONSHOT_MODEL` 有默认值 |

## 三、已实现功能（截至 v33.2）

**学生端**
- 注册向导：MBTI、DISC、E3 学业诊断三项必测，逐题作答 + 进度自动保存（误退出可续测）
- **学业诊断 V3.7 三阶九能**（小学/初中/高中三版各 70 题）：乐学（动力/信心/韧劲）、会学（学懂/记住/会用）、善学（计划/复盘/智学）独立计分；条件（状态/关系/资源）与学能筛查（注意力/工作记忆/加工速度）单独报告；状态单选、学科快扫（喜欢/掌握/发挥/排名/薄弱，高中支持 3+1+2 选科）、生活事件、开放题；红黄绿三级判定（<3.0 卡点 / 3.0-3.7 待提升 / ≥3.8 正常）、心理红线、效度校验、卡点优先级链（条件→乐学→会学→善学→学能）
- 选做测评：家长卷 V3.7（含家长认知盲区分析）、**家长 DISC（家庭版，多位家长可各测一次）**、多元智能五项、职业锚、霍兰德、**心理健康筛查（PHQ-9 + GAD-7 三甲医院通用量表，含自伤红线提示与免责声明）**
- 综合分析报告（详细版 + 一页版）：概要九宫格、学习力系统框架图、总冰山模型（五大系统两级展开到关注点分数）、模块化章节（每模块：结论直出 + 折叠图表/数据分析/详细建议/该模块答题明细）、亲子 DISC 冲突对照（强烈冲突红色标注）、附录逐题得分明细；网页打印即得零变形 PDF
- 预习 / 查漏补缺 / 树洞 / 成绩与目标管理 / AI 伴学对话

**伴学师端（admin）**
- 学生列表、学生详情抽屉（报告卡、答题明细、V3.7 概览、打印）、陪跑方案（旧版 V2.7 数据）

## 四、待办与已知问题

- 伴学师端「陪跑方案」卡目前仅对旧版 V2.7 数据渲染，V3.7 训练方案移植待做
- 伴学师端学生详情暂未暴露 家长DISC / 家长卷 记录（与历史行为一致，如需展示要另加）
- 旧版心理测评（30 题自编）已替换为 PHQ-9+GAD-7，老结果显示"请重测"提示；旧 E3 V2.7 结果同理
- 学科快扫的成绩字段已下线（成绩统一在「个人中心·成绩与目标」填写），旧作答中已存的成绩仅不再展示
- 老版冒烟脚本在 /tmp 已丢失，现有冒烟脚本需重新归入仓库（建议后续提交到 scripts/）

## 五、部署

- **当前发布方式**：本项目托管于 Kimi 站点构建管线，由版本快照发布到 <https://sanhao2.kimi.site>（用户手动点「发布」生效）。
- **Docker 自托管（推荐）**：
  ```bash
  docker build -t sanhao .
  docker run -d -p 3000:3000 --env-file .env sanhao
  ```
- **手动部署**：`npm ci && npm run build && node dist/boot.js`（监听 3000）。
- 详见根目录 `DEPLOY.md`；完整版本史、架构决策与踩坑记录见 `HANDOFF.md`。

## 目录结构

- `src/` 前端页面与组件；`api/` 后端（入口 `api/boot.ts`，tRPC routers）
- `db/` Drizzle schema、`db/migrations/` 迁移、`db/seed-*.ts` 种子数据
- `contracts/` 前后端共享类型与常量（测评题库/计分器在这里）
- `docs/`、`plan.md`、`HANDOFF.md`、`DEPLOY.md` 文档
