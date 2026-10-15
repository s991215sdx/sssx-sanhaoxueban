-- 智慧生涯规划 · 院校库（掌上高考院校基础信息总表，2991 所，按省份归类）
-- 后台上传 JSON 导入；测评报告「目标院校规划」与伴学师演示（查大学）底层调用。

CREATE TABLE `university_lib` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`zs_id` varchar(16) NOT NULL DEFAULT '',
	`name` varchar(128) NOT NULL,
	`province` varchar(16) NOT NULL DEFAULT '',
	`city` varchar(32) NOT NULL DEFAULT '',
	`district` varchar(32) NOT NULL DEFAULT '',
	`school_type` varchar(32) NOT NULL DEFAULT '',
	`level` varchar(16) NOT NULL DEFAULT '',
	`nature` varchar(16) NOT NULL DEFAULT '',
	`tags` varchar(255) NOT NULL DEFAULT '',
	`page_tags` varchar(255) NOT NULL DEFAULT '',
	`found_year` varchar(16) NOT NULL DEFAULT '',
	`area` varchar(32) NOT NULL DEFAULT '',
	`supervisor` varchar(64) NOT NULL DEFAULT '',
	`zs_website` varchar(255) NOT NULL DEFAULT '',
	`zs_phone` varchar(255) NOT NULL DEFAULT '',
	`website` varchar(255) NOT NULL DEFAULT '',
	`motto` varchar(255) NOT NULL DEFAULT '',
	`alias` varchar(128) NOT NULL DEFAULT '',
	`former_names` varchar(255) NOT NULL DEFAULT '',
	`intro` text,
	`intro_short` text,
	`doctor` varchar(64) NOT NULL DEFAULT '',
	`doctor_detail` text,
	`master` varchar(64) NOT NULL DEFAULT '',
	`master_detail` text,
	`key_disciplines` varchar(128) NOT NULL DEFAULT '',
	`dfc` text,
	`departments` text,
	`campus` text,
	`canteen` text,
	`dorm` text,
	`scholarship` text,
	`aid` text,
	`male_pct` varchar(16) NOT NULL DEFAULT '',
	`female_pct` varchar(16) NOT NULL DEFAULT '',
	`logo_url` varchar(512) NOT NULL DEFAULT '',
	`campus_photos` text,
	`dorm_photos` text,
	`history` text,
	`ranking` varchar(255) NOT NULL DEFAULT '',
	`subject_eval` varchar(128) NOT NULL DEFAULT '',
	`academicians` varchar(64) NOT NULL DEFAULT '',
	`library_books` varchar(64) NOT NULL DEFAULT '',
	`labs` varchar(64) NOT NULL DEFAULT '',
	`baoyan` varchar(64) NOT NULL DEFAULT '',
	`video_url` varchar(512) NOT NULL DEFAULT '',
	`address` varchar(255) NOT NULL DEFAULT '',
	`zs_code` varchar(16) NOT NULL DEFAULT '',
	`detail_url` varchar(512) NOT NULL DEFAULT '',
	CONSTRAINT `university_lib_id` PRIMARY KEY(`id`),
	CONSTRAINT `university_lib_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `university_lib` ADD INDEX `university_lib_province_idx` (`province`);
--> statement-breakpoint
ALTER TABLE `university_lib` ADD INDEX `university_lib_city_idx` (`city`);
--> statement-breakpoint
ALTER TABLE `university_lib` ADD INDEX `university_lib_level_idx` (`level`);
