CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);
--> statement-breakpoint
ALTER TABLE `daily_plans` DROP INDEX `daily_plans_date_unique`;--> statement-breakpoint
ALTER TABLE `assessment_results` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `attempts` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `daily_plans` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `error_logs` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `guide_sessions` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mastery` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `mood_entries` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `papers` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `preview_sessions` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recordings` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `student_profile` ADD `user_id` bigint unsigned DEFAULT 0 NOT NULL;