-- v253 人才测评：四类岗位（销售咨询师 / 教学服务 / 行政 / 管理）的评估记录
-- 与 assessment_results 分开建表的原因：
--   1) 那张表的 kind 是学生/家庭量表的枚举，人才测评还带「岗位」「候选人」两维，塞进去要改枚举；
--   2) 人才测评的报告体量大（十维 + 四岗匹配 + 情商十五维），且要按机构、按发起人查列表，
--      独立表能建索引，不会让「查一个孩子的测评历史」扫到一堆员工数据。

CREATE TABLE `talent_assessments` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`org_id` bigint unsigned NULL,
	`owner_id` bigint unsigned NOT NULL DEFAULT 0,
	`candidate_name` varchar(64) NOT NULL DEFAULT '',
	`position` enum('sales','service','admin','mgmt') NOT NULL,
	`source` enum('self','invite') NOT NULL DEFAULT 'self',
	`completeness` int NOT NULL DEFAULT 0,
	`fit_score` int NOT NULL DEFAULT 0,
	`report` json NOT NULL,
	`answers` json,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	KEY `talent_assessments_owner_idx` (`owner_id`),
	KEY `talent_assessments_org_idx` (`org_id`),
	KEY `talent_assessments_time_idx` (`created_at`)
);
