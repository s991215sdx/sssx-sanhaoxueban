ALTER TABLE `mastery` DROP INDEX `mastery_kp_id_unique`;--> statement-breakpoint
CREATE TABLE `tutor_sessions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned DEFAULT 0 NOT NULL,
	`error_id` bigint unsigned NOT NULL,
	`kp_id` bigint unsigned NOT NULL,
	`question_id` bigint unsigned,
	`phase` enum('review','quiz','tutor','done') NOT NULL DEFAULT 'review',
	`concepts_hit` json NOT NULL,
	`messages` json NOT NULL,
	`turn` int NOT NULL DEFAULT 0,
	`understood` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutor_sessions_id` PRIMARY KEY(`id`)
);
