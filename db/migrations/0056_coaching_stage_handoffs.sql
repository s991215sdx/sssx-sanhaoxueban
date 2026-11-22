-- H5 家庭阶段交接：关联月报、正式计划、家庭行动与私有交接单；不改变负责人。
-- 全部为可空字段，历史 H5 改派以 next_supervisor_id 非空继续识别。
ALTER TABLE `coaching_handoffs` ADD `monthly_report_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `next_plan_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `family_action_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `attachment_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `family_snapshot` json NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `accepted_channel` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `accepted_comment` text NULL;
