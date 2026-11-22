-- 独立陪跑：结构化目标、三方会签、逐份家庭授权、服务场景与敏感数据保护。
-- 仅新增结构；旧监护人不会因主档授权自动获得每份内容的访问权。
ALTER TABLE `coaching_plans` ADD `issued_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `coaching_plans` ADD `cancelled_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `coaching_exceptions` ADD `detail_ciphertext` longtext NULL;
--> statement-breakpoint
ALTER TABLE `coaching_exceptions` ADD `close_evidence_ciphertext` longtext NULL;
--> statement-breakpoint
ALTER TABLE `coaching_exception_actions` ADD `note_ciphertext` longtext NULL;
--> statement-breakpoint
ALTER TABLE `coaching_exception_actions` ADD `evidence_ciphertext` longtext NULL;
--> statement-breakpoint
ALTER TABLE `course_sessions` ADD `cancelled_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `course_sessions` ADD `cancel_reason` varchar(1000) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `course_sessions` ADD `cancelled_by` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `course_participants` ADD `guardian_user_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `study_supervision_records` ADD `time_blocks` json NULL;
--> statement-breakpoint
ALTER TABLE `study_supervision_records` ADD `sign_out_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `study_supervision_records` ADD `leave_reason` text NULL;
--> statement-breakpoint
ALTER TABLE `study_supervision_records` ADD `makeup_plan` text NULL;
--> statement-breakpoint
ALTER TABLE `study_supervision_records` ADD `handoff_note` text NULL;
--> statement-breakpoint
ALTER TABLE `study_supervision_records` ADD `cancelled_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `study_supervision_records` ADD `cancel_reason` varchar(1000) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `coaching_deliverables` ADD `disposal_reason` varchar(1000) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `coaching_deliverables` ADD `disposed_by` bigint unsigned NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_grow_profiles` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `case_id` bigint unsigned NOT NULL,
 `version` int NOT NULL, `previous_id` bigint unsigned NULL, `student_goal` text NOT NULL, `parent_expectation` text NOT NULL,
 `target_school` varchar(180) NOT NULL DEFAULT '', `target_date` varchar(10) NULL, `target_subjects` json NOT NULL,
 `current_situation` text NOT NULL, `evidence` text NOT NULL, `follow_up_actions` text NOT NULL,
 `next_contact_at` timestamp NULL, `retest_due_at` timestamp NULL, `change_reason` varchar(500) NOT NULL DEFAULT '',
 `created_by` bigint unsigned NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_grow_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_grow_profiles` ADD UNIQUE INDEX `coaching_grow_profiles_version_unique` (`case_id`,`version`);
--> statement-breakpoint
ALTER TABLE `coaching_grow_profiles` ADD INDEX `coaching_grow_profiles_org_case_idx` (`org_id`,`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_grow_report_links` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `case_id` bigint unsigned NOT NULL,
 `profile_id` bigint unsigned NOT NULL, `result_id` bigint unsigned NOT NULL, `conclusion` text NOT NULL,
 `evidence` text NOT NULL, `training_suggestion` text NOT NULL, `cycle` varchar(80) NOT NULL,
 `owner_id` bigint unsigned NOT NULL, `review_at` timestamp NOT NULL, `created_by` bigint unsigned NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT `coaching_grow_report_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_grow_report_links` ADD UNIQUE INDEX `coaching_grow_report_links_unique` (`profile_id`,`result_id`);
--> statement-breakpoint
ALTER TABLE `coaching_grow_report_links` ADD INDEX `coaching_grow_report_links_case_idx` (`org_id`,`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_plan_confirmations` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `case_id` bigint unsigned NOT NULL,
 `plan_id` bigint unsigned NOT NULL, `role` varchar(16) NOT NULL, `user_id` bigint unsigned NOT NULL,
 `comment` text NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_plan_confirmations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_plan_confirmations` ADD UNIQUE INDEX `coaching_plan_confirmations_unique` (`plan_id`,`role`,`user_id`);
--> statement-breakpoint
ALTER TABLE `coaching_plan_confirmations` ADD INDEX `coaching_plan_confirmations_case_idx` (`org_id`,`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_extended_records` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `case_id` bigint unsigned NOT NULL,
 `record_type` varchar(32) NOT NULL, `period_key` varchar(32) NOT NULL, `title` varchar(180) NOT NULL,
 `payload` json NULL, `payload_ciphertext` longtext NULL, `sensitive` boolean NOT NULL DEFAULT false,
 `status` varchar(24) NOT NULL DEFAULT 'completed', `version` int NOT NULL, `previous_id` bigint unsigned NULL,
 `owner_id` bigint unsigned NOT NULL, `due_at` timestamp NULL, `change_reason` varchar(500) NOT NULL DEFAULT '',
 `created_by` bigint unsigned NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT `coaching_extended_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_extended_records` ADD UNIQUE INDEX `coaching_extended_records_version_unique` (`case_id`,`record_type`,`period_key`,`version`);
--> statement-breakpoint
ALTER TABLE `coaching_extended_records` ADD INDEX `coaching_extended_records_owner_due_idx` (`owner_id`,`status`,`due_at`);
--> statement-breakpoint
ALTER TABLE `coaching_extended_records` ADD INDEX `coaching_extended_records_org_case_idx` (`org_id`,`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_session_events` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `case_id` bigint unsigned NOT NULL,
 `session_id` bigint unsigned NOT NULL, `action` varchar(24) NOT NULL, `previous_start_at` timestamp NULL,
 `next_start_at` timestamp NULL, `previous_status` varchar(24) NOT NULL, `next_status` varchar(24) NOT NULL,
 `snapshot` json NOT NULL, `reason` varchar(1000) NOT NULL, `actor_user_id` bigint unsigned NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT `coaching_session_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_session_events` ADD INDEX `coaching_session_events_session_idx` (`session_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_deliverable_recipients` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `case_id` bigint unsigned NOT NULL, `resource_type` varchar(24) NOT NULL,
 `resource_id` bigint unsigned NOT NULL, `recipient_user_id` bigint unsigned NOT NULL, `scope` varchar(16) NOT NULL DEFAULT 'read',
 `active` boolean NOT NULL DEFAULT true, `created_by` bigint unsigned NOT NULL, `revoked_by` bigint unsigned NULL,
 `revoked_at` timestamp NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT `coaching_deliverable_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_deliverable_recipients` ADD UNIQUE INDEX `coaching_deliverable_recipients_unique` (`resource_type`,`resource_id`,`recipient_user_id`);
--> statement-breakpoint
ALTER TABLE `coaching_deliverable_recipients` ADD INDEX `coaching_deliverable_recipients_user_idx` (`recipient_user_id`,`active`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_delivery_settings` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `h3_hours` int NOT NULL DEFAULT 24,
 `weekly_plan_day` int NOT NULL DEFAULT 1, `weekly_review_day` int NOT NULL DEFAULT 0,
 `quality_version` varchar(16) NOT NULL DEFAULT '1.0', `retention_days` int NOT NULL DEFAULT 365,
 `hard_case_limit` int NOT NULL DEFAULT 0, `s1_hours` int NOT NULL DEFAULT 8, `s2_hours` int NOT NULL DEFAULT 2,
 `s3_hours` int NOT NULL DEFAULT 24, `updated_by` bigint unsigned NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_delivery_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_delivery_settings` ADD UNIQUE INDEX `coaching_delivery_settings_org_unique` (`org_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_crisis_followups` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `case_id` bigint unsigned NOT NULL,
 `exception_id` bigint unsigned NOT NULL, `kind` varchar(32) NOT NULL, `detail_ciphertext` longtext NOT NULL,
 `evidence_ciphertext` longtext NOT NULL, `status` varchar(16) NOT NULL DEFAULT 'pending',
 `owner_id` bigint unsigned NOT NULL, `due_at` timestamp NOT NULL, `completed_at` timestamp NULL,
 `created_by` bigint unsigned NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT `coaching_crisis_followups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_crisis_followups` ADD INDEX `coaching_crisis_followups_exception_idx` (`exception_id`,`status`);
--> statement-breakpoint
ALTER TABLE `coaching_crisis_followups` ADD INDEX `coaching_crisis_followups_owner_due_idx` (`owner_id`,`status`,`due_at`);
--> statement-breakpoint
UPDATE `coaching_handoffs` SET `type`='REASSIGN' WHERE `type`='H5' AND `next_supervisor_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `coaching_plans` SET `issued_at`=`confirmed_at` WHERE `status`='confirmed' AND `issued_at` IS NULL;
--> statement-breakpoint
INSERT INTO `coaching_plan_confirmations` (`org_id`,`case_id`,`plan_id`,`role`,`user_id`,`comment`)
 SELECT c.`org_id`,p.`case_id`,p.`id`,'coach',p.`confirmed_by`,'历史计划教练确认迁移留痕'
 FROM `coaching_plans` p INNER JOIN `coaching_cases` c ON c.`id`=p.`case_id`
 WHERE p.`status`='confirmed' AND p.`confirmed_by` IS NOT NULL
 ON DUPLICATE KEY UPDATE `comment`=`comment`;
--> statement-breakpoint
INSERT INTO `coaching_deliverable_recipients` (`org_id`,`case_id`,`resource_type`,`resource_id`,`recipient_user_id`,`created_by`)
 SELECT c.`org_id`,c.`id`,'plan',p.`id`,c.`student_user_id`,c.`student_user_id`
 FROM `coaching_plans` p INNER JOIN `coaching_cases` c ON c.`id`=p.`case_id`
 WHERE p.`status`='confirmed' ON DUPLICATE KEY UPDATE `active`=`active`;
