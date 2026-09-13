# 三好学伴 · 部署与二次开发指南

## 项目简介
K12 个性化伴学 Web 应用（React 19 + Vite + Tailwind 前端；Hono + tRPC + Drizzle ORM 后端；MySQL 兼容数据库，线上用 TiDB Serverless）。

## 目录结构
- `src/` 前端页面与组件（React + Tailwind）
- `api/` 后端（Hono 服务 + tRPC routers，入口 `api/boot.ts`）
- `db/` Drizzle schema、迁移（`db/migrations/`）、种子数据（`db/seed-*.ts`，含 K12 知识骨架与四年级全科深度内容）
- `contracts/` 前后端共享的类型与常量
- `Dockerfile` 一键容器化部署
- `HANDOFF.md`（在压缩包根目录）完整开发交接文档：版本历史、架构决策、踩坑记录

## 环境变量（复制 .env.example 为 .env 并填写）
| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | MySQL 连接串，如 `mysql://user:pass@host:4000/db?ssl={...}`（TiDB Serverless / 任意 MySQL 8） |
| `APP_ID` / `APP_SECRET` | 应用 ID / 密钥（JWT 签名用） |
| `KIMI_AUTH_URL` / `VITE_KIMI_AUTH_URL` / `VITE_APP_ID` | Kimi 登录 OAuth（如不用 Kimi 登录，需自行替换 `api/` 内的 auth 中间件） |
| `KIMI_OPEN_URL` | Kimi 开放平台 API（AI 伴学功能用） |
| `OWNER_UNION_ID` | 创建者的 union id，首次登录自动授予 admin |

> 注意：压缩包未包含 `.env`（含数据库密码等敏感信息）。请向原开发者索取或在原平台的环境变量设置中查看。

## 方式一：Docker 部署（推荐，直接上传服务器）
```bash
docker build -t sanhao .
docker run -d -p 3000:3000 --env-file .env sanhao
```
访问 http://服务器IP:3000 。首次启动自动跑数据库迁移与知识点播种（约 5-10 分钟，后台执行不阻塞启动）。

## 方式二：手动部署
```bash
npm ci
npm run build        # 产出 dist/（前端静态 + dist/boot.js 后端）
node dist/boot.js    # 监听 3000 端口
```

## 本地开发
```bash
npm ci
npm run dev          # 前后端热更新
```

## 在其他大模型平台继续建设
把本压缩包整个上传给新会话，并先让它阅读根目录的 `HANDOFF.md`——里面有完整版本史、数据库播种机制、已知坑位（尤其是「同一文件一次只改一处、改后必须 grep 验证」的教训）。

## 健康检查
- `GET /api/trpc/ping?input={"json":null}` → 服务存活
- `GET /api/trpc/system.dbHealth?input={"json":null}` → 迁移与播种状态（init.ready=true 表示完成）
