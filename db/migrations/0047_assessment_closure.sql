-- 机构测评完整闭环：期限策略、逐生状态、复测链与不可覆盖的验收版本
ALTER TABLE `assessment_activities` ADD `expiry_policy` varchar(24) NOT NULL DEFAULT 'auto_refund';
--> statement-breakpoint
ALTER TABLE `assessment_assignments` ADD `expired_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `assessment_assignments` ADD `cancelled_reason` varchar(500) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `assessment_assignments` ADD `retest_of_assignment_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `assessment_assignments` ADD INDEX `assessment_assignments_retest_idx` (`retest_of_assignment_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_task_verifications` (
 `id` serial AUTO_INCREMENT NOT NULL, `task_id` bigint unsigned NOT NULL, `case_id` bigint unsigned NOT NULL,
 `version` int NOT NULL, `previous_id` bigint unsigned NULL, `evidence` text NOT NULL, `result` text NOT NULL,
 `verifier_id` bigint unsigned NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_task_verifications_id` PRIMARY KEY(`id`),
 CONSTRAINT `coaching_task_verifications_task_version_unique` UNIQUE(`task_id`,`version`)
);
--> statement-breakpoint
ALTER TABLE `coaching_task_verifications` ADD INDEX `coaching_task_verifications_case_idx` (`case_id`,`task_id`,`version`);
--> statement-breakpoint
-- 0046 已验收但没有版本表的存量记录，只补一次 V1；不重写原任务与结果。
INSERT INTO `coaching_task_verifications` (`task_id`,`case_id`,`version`,`previous_id`,`evidence`,`result`,`verifier_id`,`created_at`)
SELECT `id`,`case_id`,1,NULL,`evidence`,`result`,`verifier_id`,COALESCE(`completed_at`,`updated_at`,`created_at`) FROM `coaching_tasks`
WHERE `status` = 'verified' AND NOT EXISTS (SELECT 1 FROM `coaching_task_verifications` AS `history` WHERE `history`.`task_id` = `coaching_tasks`.`id`);
