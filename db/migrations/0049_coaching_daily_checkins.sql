-- 独立陪跑结构化日检验：量化检验、错因订正、费曼输出、学习痕迹与补位。
-- 同一主档同一天可追加 V2、V3……；历史版本只读，不用 UPDATE 覆盖。
CREATE TABLE IF NOT EXISTS `coaching_checkins` (
 `id` serial AUTO_INCREMENT NOT NULL,
 `case_id` bigint unsigned NOT NULL,
 `org_id` bigint unsigned NOT NULL,
 `supervision_id` bigint unsigned NULL,
 `check_date` varchar(10) NOT NULL,
 `version` int NOT NULL,
 `previous_id` bigint unsigned NULL,
 `change_reason` varchar(500) NOT NULL DEFAULT '',
 `completion_rate` int NOT NULL,
 `accuracy_rate` int NOT NULL,
 `actual_completion` text NOT NULL,
 `gap_reason` text NOT NULL,
 `error_cause` text NOT NULL,
 `correction` text NOT NULL,
 `evidence` text NOT NULL,
 `follow_up` text NOT NULL,
 `follow_up_date` varchar(10) NULL,
 `tomorrow_first` text NOT NULL,
 `feynman_concept` text NOT NULL,
 `feynman_output` text NOT NULL,
 `feynman_grade` varchar(1) NOT NULL DEFAULT '',
 `feynman_stuck` text NOT NULL,
 `feynman_question` text NOT NULL,
 `retest_date` varchar(10) NULL,
 `traces` json NOT NULL,
 `trace_evidence` text NOT NULL,
 `trace_follow_up` text NOT NULL,
 `created_by` bigint unsigned NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_checkins_id` PRIMARY KEY(`id`),
 CONSTRAINT `coaching_checkins_case_date_version_unique` UNIQUE(`case_id`,`check_date`,`version`)
);
--> statement-breakpoint
ALTER TABLE `coaching_checkins` ADD INDEX `coaching_checkins_case_date_version_idx` (`case_id`,`check_date`,`version`);
--> statement-breakpoint
ALTER TABLE `coaching_checkins` ADD INDEX `coaching_checkins_org_date_idx` (`org_id`,`check_date`);
