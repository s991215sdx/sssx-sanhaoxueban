-- 独立陪跑四类服务场景：A 晚自习、B 周末、C 全日制、D 假期集训
-- 同一主档可叠加多个场景；停用只结束当前记录，历史周期与原因不覆盖。
CREATE TABLE IF NOT EXISTS `coaching_case_scenarios` (
 `id` serial AUTO_INCREMENT NOT NULL,
 `case_id` bigint unsigned NOT NULL,
 `org_id` bigint unsigned NOT NULL,
 `scenario` varchar(8) NOT NULL,
 `active_key` varchar(64) NULL,
 `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 `ended_at` timestamp NULL,
 `created_by` bigint unsigned NOT NULL,
 `ended_by` bigint unsigned NULL,
 `change_reason` varchar(500) NOT NULL DEFAULT '',
 `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT `coaching_case_scenarios_id` PRIMARY KEY(`id`),
 CONSTRAINT `coaching_case_scenarios_active_key_unique` UNIQUE(`active_key`)
);
--> statement-breakpoint
ALTER TABLE `coaching_case_scenarios` ADD INDEX `coaching_case_scenarios_case_idx` (`case_id`,`ended_at`,`scenario`);
--> statement-breakpoint
ALTER TABLE `coaching_case_scenarios` ADD INDEX `coaching_case_scenarios_org_idx` (`org_id`,`scenario`,`ended_at`);
--> statement-breakpoint
-- 不猜测旧主档的服务场景；旧数据由授权伴学师在下次编辑时明确补选。
