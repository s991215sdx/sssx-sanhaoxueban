CREATE TABLE `organizations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`brand_name` varchar(128) NOT NULL,
	`logo_url` varchar(512),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `org_id` bigint unsigned;
--> statement-breakpoint
ALTER TABLE `invite_channels` ADD `org_id` bigint unsigned;
--> statement-breakpoint
INSERT INTO `organizations` (`name`, `brand_name`) SELECT '默认机构', '三好学伴';
--> statement-breakpoint
UPDATE `users` SET `org_id` = (SELECT MIN(`id`) FROM `organizations`) WHERE `org_id` IS NULL;
--> statement-breakpoint
UPDATE `invite_channels` SET `org_id` = (SELECT MIN(`id`) FROM `organizations`) WHERE `org_id` IS NULL;
