-- 陪跑运营待办、站内通知与可配置负荷预警。
CREATE TABLE IF NOT EXISTS `coaching_notifications` (
 `id` serial AUTO_INCREMENT NOT NULL,
 `org_id` bigint unsigned NOT NULL,
 `case_id` bigint unsigned NULL,
 `recipient_id` bigint unsigned NOT NULL,
 `type` varchar(40) NOT NULL,
 `channel` varchar(16) NOT NULL DEFAULT 'in_app',
 `title` varchar(180) NOT NULL,
 `body` varchar(1000) NOT NULL DEFAULT '',
 `priority` varchar(16) NOT NULL DEFAULT 'normal',
 `status` varchar(16) NOT NULL DEFAULT 'pending',
 `not_before` timestamp NOT NULL,
 `sent_at` timestamp NULL,
 `delivered_at` timestamp NULL,
 `read_at` timestamp NULL,
 `failed_at` timestamp NULL,
 `failure_reason` varchar(500) NOT NULL DEFAULT '',
 `retry_count` int NOT NULL DEFAULT 0,
 `manual_reason` varchar(500) NOT NULL DEFAULT '',
 `manual_at` timestamp NULL,
 `idempotency_key` varchar(191) NOT NULL,
 `created_by` bigint unsigned NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_notifications` ADD UNIQUE INDEX `coaching_notifications_idempotency_unique` (`idempotency_key`);
--> statement-breakpoint
ALTER TABLE `coaching_notifications` ADD INDEX `coaching_notifications_recipient_status_idx` (`recipient_id`,`status`,`not_before`);
--> statement-breakpoint
ALTER TABLE `coaching_notifications` ADD INDEX `coaching_notifications_org_created_idx` (`org_id`,`created_at`);
--> statement-breakpoint
ALTER TABLE `coaching_notifications` ADD INDEX `coaching_notifications_case_idx` (`case_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_notification_settings` (
 `id` serial AUTO_INCREMENT NOT NULL,
 `org_id` bigint unsigned NOT NULL,
 `quiet_start` varchar(5) NOT NULL DEFAULT '22:00',
 `quiet_end` varchar(5) NOT NULL DEFAULT '07:00',
 `suggested_case_load` int NOT NULL DEFAULT 20,
 `updated_by` bigint unsigned NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_notification_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_notification_settings` ADD UNIQUE INDEX `coaching_notification_settings_org_unique` (`org_id`);
