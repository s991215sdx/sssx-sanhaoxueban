-- 月度学习报告保留真实数据快照、正文版本和家庭推送记录。
CREATE TABLE IF NOT EXISTS `coaching_monthly_reports` (
 `id` serial AUTO_INCREMENT NOT NULL,
 `case_id` bigint unsigned NOT NULL,
 `org_id` bigint unsigned NOT NULL,
 `month` varchar(7) NOT NULL,
 `version` int NOT NULL,
 `previous_id` bigint unsigned NULL,
 `metric_snapshot` json NOT NULL,
 `goal_progress` text NOT NULL,
 `academic_progress` text NOT NULL,
 `task_execution` text NOT NULL,
 `learning_method` text NOT NULL,
 `habit_family` text NOT NULL,
 `meeting_notes` text NOT NULL DEFAULT (''),
 `next_actions` json NOT NULL,
 `family_action` text NOT NULL,
 `created_by` bigint unsigned NOT NULL,
 `pushed_by` bigint unsigned NULL,
 `pushed_at` timestamp NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_monthly_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_monthly_reports` ADD UNIQUE INDEX `coaching_monthly_reports_case_month_version_unique` (`case_id`,`month`,`version`);
--> statement-breakpoint
ALTER TABLE `coaching_monthly_reports` ADD INDEX `coaching_monthly_reports_org_month_idx` (`org_id`,`month`);
--> statement-breakpoint
-- 自查、互查和主管抽查共用五模块框架，内部整改关闭必须保留证据。
CREATE TABLE IF NOT EXISTS `coaching_quality_reviews` (
 `id` serial AUTO_INCREMENT NOT NULL,
 `case_id` bigint unsigned NOT NULL,
 `org_id` bigint unsigned NOT NULL,
 `review_type` varchar(16) NOT NULL,
 `reviewer_id` bigint unsigned NOT NULL,
 `period_key` varchar(24) NOT NULL,
 `framework_version` varchar(16) NOT NULL DEFAULT '1.0',
 `version` int NOT NULL DEFAULT 1,
 `previous_id` bigint unsigned NULL,
 `plan_score` int NULL,
 `execution_score` int NULL,
 `archive_score` int NULL,
 `family_score` int NULL,
 `review_score` int NULL,
 `findings` text NOT NULL DEFAULT (''),
 `improvement_actions` text NOT NULL DEFAULT (''),
 `status` varchar(16) NOT NULL DEFAULT 'pending',
 `due_at` timestamp NULL,
 `assigned_by` bigint unsigned NOT NULL,
 `submitted_at` timestamp NULL,
 `closed_by` bigint unsigned NULL,
 `closed_at` timestamp NULL,
 `close_evidence` text NOT NULL DEFAULT (''),
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_quality_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_quality_reviews` ADD UNIQUE INDEX `coaching_quality_reviews_version_unique` (`case_id`,`review_type`,`reviewer_id`,`period_key`,`version`);
--> statement-breakpoint
ALTER TABLE `coaching_quality_reviews` ADD INDEX `coaching_quality_reviews_reviewer_status_idx` (`reviewer_id`,`status`);
--> statement-breakpoint
ALTER TABLE `coaching_quality_reviews` ADD INDEX `coaching_quality_reviews_org_created_idx` (`org_id`,`created_at`);
