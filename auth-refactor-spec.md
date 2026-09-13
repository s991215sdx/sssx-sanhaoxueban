## 用户隔离重构规则（必须逐条执行）
项目已接入 Kimi 登录：`authedQuery`（import 自 ./middleware）的 `ctx.user` 保证非空（含 id/role）。
所有用户数据表已加 `userId` 列（number）。knowledgePoints/questions 是全局题库，无 userId，不过滤。
users 表结构见 db/schema.ts 末尾。

helpers 新签名（api/helpers.ts 已改好）：
getMasteryMap(userId) / getPreviewedSet(userId) / bumpMasteryFloor(userId, kpId, min) / findRootKp(userId, kpId) / adjustMastery(userId, kpId, correct, total)；getKpIndex()/dayStr()/grade()/normalize()/REVIEW_STAGES 不变。

规则：
1. publicQuery → authedQuery（import 改为含 authedQuery）。
2. 每个 procedure 回调取 ctx：`const userId = ctx.user.id;`
3. 所有 select/update/delete：用户表的 where 必须含 eq(table.userId, userId)；按 id 查/改/删单条也必须同时 eq userId，防越权。
4. 所有 insert 必须带 userId。
5. reviewItems 无 userId 列：先取当前用户 errorLogs 的 id 集合，再 inArray(reviewItems.errorLogId, ids)；ids 为空直接返回空结果/默认值，严禁 inArray(空数组)。
6. chatMessages：操作前先校验对应 previewSession 属于当前用户。
7. dailyPlans：date 唯一约束已移除，upsert 改为按 and(eq(dailyPlans.userId, userId), eq(dailyPlans.date, today))。
8. profile.get：where eq(userId) 取第一条；setup/updateMinutes 无记录则 insert（带 userId），有则按记录 id update。
9. assessment.submit：写 assessmentResults 带 userId；更新 studentProfile 按 userId；onboarded 判定逻辑不变。plan/treehole 内部查 moodEntries 同样加 userId。
10. 返回值形状、字段名、路由名一律不变（前端零改动）。
11. 只准改分配给你的文件；不运行 tsc -b / npm / db 命令；可 `npx tsc --noEmit --skipLibCheck <你的文件>` 粗查。
