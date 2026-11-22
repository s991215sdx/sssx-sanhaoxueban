-- 机构版测评任务、积分钱包、独立陪跑与五课执行闭环
ALTER TABLE `assessment_results` ADD `submission_key` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `assessment_results` ADD `assignment_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `assessment_results` ADD UNIQUE INDEX `assessment_results_submission_key_unique` (`submission_key`);
--> statement-breakpoint
ALTER TABLE `assessment_results` ADD INDEX `assessment_results_assignment_idx` (`assignment_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `org_point_accounts` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `owner_user_id` bigint unsigned NOT NULL DEFAULT 0,
 `balance` int NOT NULL DEFAULT 0, `initialized` boolean NOT NULL DEFAULT true,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `org_point_accounts_id` PRIMARY KEY(`id`), CONSTRAINT `org_point_accounts_org_owner_unique` UNIQUE(`org_id`,`owner_user_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `org_point_ledger` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `account_id` bigint unsigned NOT NULL,
 `owner_user_id` bigint unsigned NOT NULL DEFAULT 0, `actor_user_id` bigint unsigned NOT NULL,
 `event_group` varchar(96) NOT NULL, `event_key` varchar(128) NOT NULL, `type` varchar(32) NOT NULL, `amount` int NOT NULL,
 `balance_before` int NOT NULL, `balance_after` int NOT NULL, `related_account_id` bigint unsigned NULL, `related_ledger_id` bigint unsigned NULL,
 `activity_id` bigint unsigned NULL, `assignment_id` bigint unsigned NULL, `student_user_id` bigint unsigned NULL,
 `kind` varchar(48) NULL, `reason` varchar(500) NOT NULL DEFAULT '', `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `org_point_ledger_id` PRIMARY KEY(`id`), CONSTRAINT `org_point_ledger_event_key_unique` UNIQUE(`event_key`)
);
--> statement-breakpoint
ALTER TABLE `org_point_ledger` ADD INDEX `org_point_ledger_org_idx` (`org_id`,`owner_user_id`,`id`);
--> statement-breakpoint
ALTER TABLE `org_point_ledger` ADD INDEX `org_point_ledger_group_idx` (`event_group`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assessment_activities` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `created_by` bigint unsigned NOT NULL,
 `request_key` varchar(64) NOT NULL, `title` varchar(128) NOT NULL, `note` varchar(500) NOT NULL DEFAULT '',
 `due_at` timestamp NULL, `status` varchar(24) NOT NULL DEFAULT 'open', `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `assessment_activities_id` PRIMARY KEY(`id`), CONSTRAINT `assessment_activities_request_key_unique` UNIQUE(`request_key`)
);
--> statement-breakpoint
ALTER TABLE `assessment_activities` ADD INDEX `assessment_activities_org_idx` (`org_id`,`id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assessment_activity_items` (
 `id` serial AUTO_INCREMENT NOT NULL, `activity_id` bigint unsigned NOT NULL, `selection_key` varchar(48) NOT NULL,
 `title` varchar(160) NOT NULL, `included_kinds` json NOT NULL, `price_snapshot` int NOT NULL DEFAULT 0,
 `category` varchar(32) NOT NULL, `sort_order` int NOT NULL DEFAULT 0, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `assessment_activity_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `assessment_activity_items` ADD INDEX `assessment_activity_items_activity_idx` (`activity_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `assessment_assignments` (
 `id` serial AUTO_INCREMENT NOT NULL, `activity_item_id` bigint unsigned NOT NULL, `student_user_id` bigint unsigned NOT NULL,
 `tutor_user_id` bigint unsigned NOT NULL, `kind` varchar(32) NOT NULL, `status` varchar(24) NOT NULL DEFAULT 'pending',
 `result_id` bigint unsigned NULL, `started_at` timestamp NULL, `completed_at` timestamp NULL, `cancelled_at` timestamp NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `assessment_assignments_id` PRIMARY KEY(`id`), CONSTRAINT `assessment_assignments_item_student_unique` UNIQUE(`activity_item_id`,`student_user_id`,`kind`)
);
--> statement-breakpoint
ALTER TABLE `assessment_assignments` ADD INDEX `assessment_assignments_student_idx` (`student_user_id`,`kind`,`status`,`id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_cases` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `student_user_id` bigint unsigned NOT NULL,
 `coach_id` bigint unsigned NOT NULL, `supervisor_id` bigint unsigned NOT NULL, `scenario` varchar(24) NOT NULL DEFAULT '新生接手',
 `status` varchar(24) NOT NULL DEFAULT 'active', `goal` text NOT NULL, `current_situation` text NOT NULL, `plan_summary` text NOT NULL,
 `service_start` varchar(10) NOT NULL, `service_end` varchar(10) NOT NULL, `phase_mode` varchar(24) NOT NULL DEFAULT 'one_to_one',
 `phase_change_reason` varchar(500) NOT NULL DEFAULT '', `phase_change_confirmed_by` bigint unsigned NULL, `version` int NOT NULL DEFAULT 1,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_cases_id` PRIMARY KEY(`id`), CONSTRAINT `coaching_cases_org_student_unique` UNIQUE(`org_id`,`student_user_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_plans` (
 `id` serial AUTO_INCREMENT NOT NULL, `case_id` bigint unsigned NOT NULL, `parent_id` bigint unsigned NULL,
 `level` varchar(16) NOT NULL, `title` varchar(160) NOT NULL, `content` text NOT NULL, `start_date` varchar(10) NOT NULL, `end_date` varchar(10) NOT NULL,
 `source_result_id` bigint unsigned NULL, `status` varchar(24) NOT NULL DEFAULT 'draft', `version` int NOT NULL DEFAULT 1,
 `confirmed_by` bigint unsigned NULL, `confirmed_at` timestamp NULL, `created_by` bigint unsigned NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_plans` ADD INDEX `coaching_plans_case_idx` (`case_id`,`level`,`id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_tasks` (
 `id` serial AUTO_INCREMENT NOT NULL, `case_id` bigint unsigned NOT NULL, `plan_id` bigint unsigned NULL,
 `title` varchar(180) NOT NULL, `detail` text NOT NULL, `owner_id` bigint unsigned NOT NULL, `verifier_id` bigint unsigned NOT NULL,
 `due_date` varchar(10) NOT NULL, `status` varchar(24) NOT NULL DEFAULT 'pending', `evidence` text NOT NULL, `result` text NOT NULL,
 `completed_at` timestamp NULL, `created_by` bigint unsigned NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT `coaching_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_tasks` ADD INDEX `coaching_tasks_case_idx` (`case_id`,`status`,`due_date`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_reviews` (
 `id` serial AUTO_INCREMENT NOT NULL, `case_id` bigint unsigned NOT NULL, `period` varchar(16) NOT NULL, `period_key` varchar(24) NOT NULL,
 `content` text NOT NULL, `next_actions` text NOT NULL, `version` int NOT NULL DEFAULT 1, `created_by` bigint unsigned NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT `coaching_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_reviews` ADD INDEX `coaching_reviews_case_idx` (`case_id`,`period`,`period_key`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_handoffs` (
 `id` serial AUTO_INCREMENT NOT NULL, `case_id` bigint unsigned NOT NULL, `type` varchar(8) NOT NULL,
 `from_user_id` bigint unsigned NOT NULL, `to_user_id` bigint unsigned NOT NULL, `title` varchar(180) NOT NULL, `content` text NOT NULL,
 `due_at` timestamp NULL, `status` varchar(24) NOT NULL DEFAULT 'pending', `accepted_at` timestamp NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_handoffs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD INDEX `coaching_handoffs_case_idx` (`case_id`,`type`,`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_events` (
 `id` serial AUTO_INCREMENT NOT NULL, `case_id` bigint unsigned NOT NULL, `actor_user_id` bigint unsigned NOT NULL,
 `type` varchar(40) NOT NULL, `content` text NOT NULL, `visibility` varchar(16) NOT NULL DEFAULT 'internal', `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_events` ADD INDEX `coaching_events_case_idx` (`case_id`,`id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `course_catalog` (
 `id` serial AUTO_INCREMENT NOT NULL, `org_id` bigint unsigned NOT NULL, `course_key` varchar(24) NOT NULL, `version` varchar(16) NOT NULL DEFAULT '1.0',
 `title` varchar(64) NOT NULL, `audience` varchar(32) NOT NULL, `purpose` varchar(64) NOT NULL, `description` text NOT NULL,
 `rhythm` varchar(255) NOT NULL, `outline` json NOT NULL, `active` boolean NOT NULL DEFAULT true,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `course_catalog_id` PRIMARY KEY(`id`), CONSTRAINT `course_catalog_org_key_version_unique` UNIQUE(`org_id`,`course_key`,`version`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `study_supervision_records` (
 `id` serial AUTO_INCREMENT NOT NULL, `case_id` bigint unsigned NOT NULL, `student_user_id` bigint unsigned NOT NULL, `supervisor_id` bigint unsigned NOT NULL,
 `visit_at` timestamp NOT NULL, `phase` varchar(16) NOT NULL, `mode` varchar(24) NOT NULL DEFAULT 'direct', `sign_in_at` timestamp NULL,
 `self_study_minutes` int NOT NULL DEFAULT 0, `alignment` text NOT NULL, `checks` text NOT NULL, `exit_check` text NOT NULL, `follow_up` text NOT NULL,
 `status` varchar(24) NOT NULL DEFAULT 'draft', `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `study_supervision_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `study_supervision_records` ADD INDEX `study_supervision_case_idx` (`case_id`,`visit_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `course_sessions` (
 `id` serial AUTO_INCREMENT NOT NULL, `case_id` bigint unsigned NOT NULL, `org_id` bigint unsigned NOT NULL, `supervision_id` bigint unsigned NULL,
 `coach_id` bigint unsigned NOT NULL, `start_at` timestamp NOT NULL, `phase` varchar(16) NOT NULL, `format` varchar(24) NOT NULL,
 `status` varchar(24) NOT NULL DEFAULT 'draft', `change_reason` varchar(500) NOT NULL DEFAULT '', `change_confirmed_by` bigint unsigned NULL,
 `shared_summary` text NOT NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `course_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `course_sessions` ADD INDEX `course_sessions_case_idx` (`case_id`,`start_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `course_session_units` (
 `id` serial AUTO_INCREMENT NOT NULL, `session_id` bigint unsigned NOT NULL, `course_key` varchar(24) NOT NULL, `lesson_no` int NULL,
 `title` varchar(180) NOT NULL, `snapshot` json NOT NULL, `learning_points` text NOT NULL, `practice_evidence` text NOT NULL,
 `sort_order` int NOT NULL DEFAULT 0, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `course_session_units_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `course_session_units` ADD INDEX `course_session_units_session_idx` (`session_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `course_participants` (
 `id` serial AUTO_INCREMENT NOT NULL, `session_id` bigint unsigned NOT NULL, `student_user_id` bigint unsigned NOT NULL,
 `guardian_label` varchar(64) NOT NULL DEFAULT '', `attendance` varchar(24) NOT NULL DEFAULT 'present', `personal_observation` text NOT NULL,
 `private_note` text NOT NULL, `action_task_id` bigint unsigned NULL, `feedback_text` text NOT NULL, `feedback_at` timestamp NULL,
 `feedback_version` int NOT NULL DEFAULT 0, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `course_participants_id` PRIMARY KEY(`id`), CONSTRAINT `course_participants_session_student_unique` UNIQUE(`session_id`,`student_user_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_deliverables` (
 `id` serial AUTO_INCREMENT NOT NULL, `case_id` bigint unsigned NOT NULL, `session_id` bigint unsigned NULL, `participant_id` bigint unsigned NULL,
 `task_id` bigint unsigned NULL, `kind` varchar(24) NOT NULL, `body` text NOT NULL, `media_data` longtext NULL, `mime_type` varchar(80) NULL,
 `size_bytes` int NOT NULL DEFAULT 0, `visibility` varchar(24) NOT NULL DEFAULT 'internal', `version` int NOT NULL DEFAULT 1,
 `previous_id` bigint unsigned NULL, `uploaded_by` bigint unsigned NOT NULL, `pushed_at` timestamp NULL, `expires_at` timestamp NULL,
 `disposed_at` timestamp NULL, `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT `coaching_deliverables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_deliverables` ADD INDEX `coaching_deliverables_case_idx` (`case_id`,`kind`,`id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_guardian_grants` (
 `id` serial AUTO_INCREMENT NOT NULL, `case_id` bigint unsigned NOT NULL, `guardian_user_id` bigint unsigned NOT NULL,
 `label` varchar(64) NOT NULL, `active` boolean NOT NULL DEFAULT true, `created_by` bigint unsigned NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_guardian_grants_id` PRIMARY KEY(`id`), CONSTRAINT `coaching_guardian_grants_case_user_unique` UNIQUE(`case_id`,`guardian_user_id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_guardian_grants` ADD INDEX `coaching_guardian_grants_user_idx` (`guardian_user_id`,`active`);
