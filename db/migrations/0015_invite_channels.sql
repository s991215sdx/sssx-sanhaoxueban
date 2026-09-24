CREATE TABLE `invite_channels` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`code` varchar(24) NOT NULL,
	`name` varchar(64) NOT NULL,
	`kind` varchar(24) NOT NULL DEFAULT '地推',
	`note` varchar(255),
	`active` boolean NOT NULL DEFAULT true,
	`created_by` bigint unsigned NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invite_channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `invite_channels_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `invite_registrations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`channel_id` bigint unsigned NOT NULL,
	`channel_code` varchar(24) NOT NULL,
	`parent_name` varchar(64) NOT NULL,
	`student_name` varchar(64) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`grade` varchar(16) NOT NULL,
	`user_id` bigint unsigned NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invite_registrations_id` PRIMARY KEY(`id`)
);
