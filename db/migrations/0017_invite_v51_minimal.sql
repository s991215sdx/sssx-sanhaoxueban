-- V51 极简注册：邀请注册不再采集家长称呼/学生姓名/年级，三列改为可空（历史记录保留展示）。
ALTER TABLE `invite_registrations` MODIFY `parent_name` varchar(64);
--> statement-breakpoint
ALTER TABLE `invite_registrations` MODIFY `student_name` varchar(64);
--> statement-breakpoint
ALTER TABLE `invite_registrations` MODIFY `grade` varchar(16);
