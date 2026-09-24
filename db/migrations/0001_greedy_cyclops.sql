CREATE TABLE `assessment_results` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`kind` enum('mbti','disc','e3') NOT NULL,
	`result` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessment_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_plans` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`minutes` int NOT NULL,
	`items` json NOT NULL,
	`note` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_plans_date_unique` UNIQUE(`date`)
);
--> statement-breakpoint
CREATE TABLE `guide_sessions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`step` int NOT NULL DEFAULT 0,
	`answers` json NOT NULL,
	`done` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guide_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mood_entries` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`mood` int NOT NULL,
	`tags` json NOT NULL,
	`content` text NOT NULL,
	`reply` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mood_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `papers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`title` varchar(128) NOT NULL,
	`exam_date` varchar(10),
	`score` varchar(32),
	`images` json NOT NULL,
	`items` json NOT NULL,
	`summary` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `papers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recordings` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`title` varchar(128) NOT NULL,
	`rec_date` varchar(10) NOT NULL,
	`kp_codes` json NOT NULL,
	`duration_sec` int,
	`transcript` text,
	`note` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recordings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_profile` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL DEFAULT '同学',
	`grade` varchar(32) NOT NULL DEFAULT '初一',
	`school` varchar(128),
	`target_school` varchar(128),
	`daily_minutes` int NOT NULL DEFAULT 45,
	`mbti` varchar(8),
	`disc` varchar(8),
	`diagnosis` json,
	`onboarded` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `student_profile_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `error_logs` ADD `band` int DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `error_logs` ADD `image_data` longtext;