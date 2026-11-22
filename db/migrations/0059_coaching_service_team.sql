-- v280 五类服务职能与按学员主档分配的服务团队；停用不删除历史。
CREATE TABLE `org_staff_roles` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `org_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `service_role` varchar(24) NOT NULL,
  `created_by` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `org_staff_roles_id` PRIMARY KEY(`id`),
  CONSTRAINT `org_staff_roles_org_user_role_unique` UNIQUE(`org_id`,`user_id`,`service_role`)
);
--> statement-breakpoint
CREATE INDEX `org_staff_roles_org_role_idx` ON `org_staff_roles` (`org_id`,`service_role`);
--> statement-breakpoint
CREATE TABLE `coaching_case_staff` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `org_id` bigint unsigned NOT NULL,
  `case_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `service_role` varchar(24) NOT NULL,
  `active` boolean NOT NULL DEFAULT true,
  `change_reason` varchar(500) NOT NULL DEFAULT '',
  `created_by` bigint unsigned NOT NULL,
  `ended_by` bigint unsigned,
  `ended_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `coaching_case_staff_id` PRIMARY KEY(`id`),
  CONSTRAINT `coaching_case_staff_case_user_role_unique` UNIQUE(`case_id`,`user_id`,`service_role`)
);
--> statement-breakpoint
CREATE INDEX `coaching_case_staff_org_user_active_idx` ON `coaching_case_staff` (`org_id`,`user_id`,`active`);
--> statement-breakpoint
CREATE INDEX `coaching_case_staff_case_active_idx` ON `coaching_case_staff` (`case_id`,`active`);
--> statement-breakpoint
INSERT IGNORE INTO `org_staff_roles` (`org_id`,`user_id`,`service_role`,`created_by`)
SELECT `org_id`,`id`,IF(`role`='admin','admin','tutor'),`id` FROM `users`
WHERE `org_id` IS NOT NULL AND `role` IN ('tutor','admin') AND `deleted_at` IS NULL;
--> statement-breakpoint
INSERT IGNORE INTO `coaching_case_staff` (`org_id`,`case_id`,`user_id`,`service_role`,`active`,`change_reason`,`created_by`)
SELECT `org_id`,`id`,`coach_id`,'coach',true,'迁移：保留原主教负责人',`coach_id` FROM `coaching_cases`;
--> statement-breakpoint
INSERT IGNORE INTO `coaching_case_staff` (`org_id`,`case_id`,`user_id`,`service_role`,`active`,`change_reason`,`created_by`)
SELECT `org_id`,`id`,`supervisor_id`,'supervisor',true,'迁移：保留原督学负责人',`supervisor_id` FROM `coaching_cases`;
