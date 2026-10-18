-- v200：新增「教务」角色——只能搜索学员（可按手机号搜，但看不到完整手机号）+
-- 给学员分配伴学师 + 给伴学师开通/关闭该学员报告查看权限，其余管理权限一律没有。
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','tutor','admin','jiaowu') NOT NULL DEFAULT 'user';
