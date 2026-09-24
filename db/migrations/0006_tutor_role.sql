ALTER TABLE `users` MODIFY COLUMN `role` enum('user','tutor','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `student_profile` ADD `tutor_id` bigint unsigned NULL;