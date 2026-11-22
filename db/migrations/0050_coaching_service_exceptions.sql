-- 独立陪跑 S1—S4 异常：接收人、补救期限、处理历史与关闭证据。
-- 敏感正文仅由服务端按权限返回；普通时间线只写非敏感元数据。
CREATE TABLE IF NOT EXISTS `coaching_exceptions` (
 `id` serial AUTO_INCREMENT NOT NULL,
 `org_id` bigint unsigned NOT NULL,
 `case_id` bigint unsigned NOT NULL,
 `severity` varchar(4) NOT NULL,
 `category` varchar(32) NOT NULL,
 `title` varchar(180) NOT NULL,
 `detail` text NOT NULL,
 `sensitive` boolean NOT NULL DEFAULT false,
 `status` varchar(16) NOT NULL DEFAULT 'open',
 `assignee_id` bigint unsigned NOT NULL,
 `due_at` timestamp NOT NULL,
 `created_by` bigint unsigned NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `closed_by` bigint unsigned NULL,
 `closed_at` timestamp NULL,
 `close_evidence` text NULL,
 CONSTRAINT `coaching_exceptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_exceptions` ADD INDEX `coaching_exceptions_org_status_idx` (`org_id`,`status`);
--> statement-breakpoint
ALTER TABLE `coaching_exceptions` ADD INDEX `coaching_exceptions_case_status_idx` (`case_id`,`status`);
--> statement-breakpoint
ALTER TABLE `coaching_exceptions` ADD INDEX `coaching_exceptions_assignee_due_idx` (`assignee_id`,`due_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `coaching_exception_actions` (
 `id` serial AUTO_INCREMENT NOT NULL,
 `exception_id` bigint unsigned NOT NULL,
 `case_id` bigint unsigned NOT NULL,
 `action` varchar(16) NOT NULL,
 `note` text NOT NULL,
 `evidence` text NOT NULL,
 `actor_user_id` bigint unsigned NOT NULL,
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_exception_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `coaching_exception_actions` ADD INDEX `coaching_exception_actions_exception_idx` (`exception_id`,`created_at`);
--> statement-breakpoint
ALTER TABLE `coaching_exception_actions` ADD INDEX `coaching_exception_actions_case_idx` (`case_id`,`exception_id`);
