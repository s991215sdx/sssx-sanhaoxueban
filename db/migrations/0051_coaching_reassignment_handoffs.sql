-- H5 人员改派保存原负责人快照，待新督学接收后才原子更新主档。
ALTER TABLE `coaching_handoffs` ADD `from_coach_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `from_supervisor_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `next_coach_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `next_supervisor_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD `applied_at` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `coaching_handoffs` ADD INDEX `coaching_handoffs_recipient_status_idx` (`to_user_id`,`status`);
