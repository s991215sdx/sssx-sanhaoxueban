CREATE TABLE `attempts` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`question_id` bigint unsigned NOT NULL,
	`kp_id` bigint unsigned NOT NULL,
	`stage` varchar(32) NOT NULL,
	`correct` boolean NOT NULL,
	`given` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`session_id` bigint unsigned NOT NULL,
	`role` enum('tutor','student') NOT NULL,
	`content` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `error_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`kp_id` bigint unsigned NOT NULL,
	`stem` text NOT NULL,
	`cause` enum('概念不清','审题失误','计算错误','方法不会','粗心大意') NOT NULL,
	`note` varchar(512),
	`root_kp_id` bigint unsigned,
	`status` enum('active','mastered') NOT NULL DEFAULT 'active',
	`variant_streak` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `error_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_points` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`chapter` varchar(64) NOT NULL,
	`title` varchar(128) NOT NULL,
	`summary` json NOT NULL,
	`example` json NOT NULL,
	`prereq_codes` json NOT NULL,
	`common_errors` json NOT NULL,
	`socratic` json NOT NULL,
	`sort_order` int NOT NULL,
	CONSTRAINT `knowledge_points_id` PRIMARY KEY(`id`),
	CONSTRAINT `knowledge_points_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `mastery` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`kp_id` bigint unsigned NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mastery_id` PRIMARY KEY(`id`),
	CONSTRAINT `mastery_kp_id_unique` UNIQUE(`kp_id`)
);
--> statement-breakpoint
CREATE TABLE `preview_sessions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`kp_id` bigint unsigned NOT NULL,
	`prereq_total` int NOT NULL DEFAULT 0,
	`prereq_correct` int NOT NULL DEFAULT 0,
	`practice_total` int NOT NULL DEFAULT 0,
	`practice_correct` int NOT NULL DEFAULT 0,
	`feynman_concepts_hit` json NOT NULL,
	`class_questions` json NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `preview_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`kp_id` bigint unsigned NOT NULL,
	`type` enum('choice','fill') NOT NULL,
	`stage` enum('check','practice','variant') NOT NULL,
	`difficulty` int NOT NULL,
	`stem` text NOT NULL,
	`options` json,
	`answer` varchar(255) NOT NULL,
	`hint` varchar(512) NOT NULL,
	`explanation` text NOT NULL,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`error_log_id` bigint unsigned NOT NULL,
	`due_date` varchar(10) NOT NULL,
	`stage_index` int NOT NULL,
	`done` boolean NOT NULL DEFAULT false,
	`done_at` timestamp,
	CONSTRAINT `review_items_id` PRIMARY KEY(`id`)
);
