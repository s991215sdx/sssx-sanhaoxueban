-- v277 陪跑知识底座：内部画像档案；不承载原始心理作答，不向家庭端自动开放。
CREATE TABLE `coaching_case_profiles` (
  `id` serial AUTO_INCREMENT NOT NULL,
  `org_id` bigint unsigned NOT NULL,
  `case_id` bigint unsigned NOT NULL,
  `birth_date` varchar(10),
  `student_info` text NOT NULL,
  `three_party` text NOT NULL,
  `parent_profile` text NOT NULL,
  `attention` text NOT NULL,
  `comm_advice` text NOT NULL,
  `updated_by` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `coaching_case_profiles_id` PRIMARY KEY(`id`),
  CONSTRAINT `coaching_case_profiles_case_id_unique` UNIQUE(`case_id`)
);
--> statement-breakpoint
CREATE INDEX `coaching_case_profiles_org_case_idx` ON `coaching_case_profiles` (`org_id`,`case_id`);
