-- v191：校园模式注册（粤华学校专用系统）
-- 渠道码加校园开关；学生档案加班级字段
ALTER TABLE `invite_channels` ADD `campus` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `student_profile` ADD `class_name` varchar(32);
