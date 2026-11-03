-- v245 一生一册成长档案 P1：教务成绩导入 + 学校指导记录
-- 1) academic_records 扩展：校园版教务导入的成绩（保留 C 端旧写入兼容，新字段均可空/默认）
-- 2) counseling_records：学校老师指导/约谈记录，可关联预警形成处置闭环

ALTER TABLE `academic_records` ADD `org_id` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `academic_records` ADD `class_name` varchar(32) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `academic_records` ADD `term` varchar(16) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `academic_records` ADD `exam_date` varchar(10) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `academic_records` ADD `total` int NULL;
--> statement-breakpoint
ALTER TABLE `academic_records` ADD `class_rank` int NULL;
--> statement-breakpoint
ALTER TABLE `academic_records` ADD `grade_rank` int NULL;
--> statement-breakpoint
ALTER TABLE `academic_records` ADD `imported_by` bigint unsigned NULL;
--> statement-breakpoint
ALTER TABLE `academic_records` ADD INDEX `academic_records_org_idx` (`org_id`);
--> statement-breakpoint
CREATE TABLE `counseling_records` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`org_id` bigint unsigned NULL,
	`teacher_id` bigint unsigned NOT NULL,
	`date` varchar(10) NOT NULL,
	`type` enum('心理','学业','生涯','行为','家庭') NOT NULL DEFAULT '学业',
	`channel` enum('面谈','电话','家访','线上') NOT NULL DEFAULT '面谈',
	`summary` text NOT NULL,
	`follow_up` varchar(512) NOT NULL DEFAULT '',
	`warning_id` bigint unsigned NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `counseling_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `counseling_records` ADD INDEX `counseling_records_user_idx` (`user_id`);
--> statement-breakpoint
ALTER TABLE `counseling_records` ADD INDEX `counseling_records_org_idx` (`org_id`);
