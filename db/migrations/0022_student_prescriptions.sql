CREATE TABLE `student_prescriptions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`student_user_id` bigint unsigned NOT NULL,
	`tutor_user_id` bigint unsigned NOT NULL,
	`methods` json NOT NULL,
	`custom_text` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `student_prescriptions_id` PRIMARY KEY(`id`)
);
