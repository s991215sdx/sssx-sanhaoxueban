ALTER TABLE `users` ADD `deleted_at` timestamp NULL;--> statement-breakpoint
ALTER TABLE `users` ADD INDEX `users_deleted_idx` (`deleted_at`);
