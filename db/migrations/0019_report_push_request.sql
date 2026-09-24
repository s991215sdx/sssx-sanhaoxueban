-- V55：家长可一键「请伴学师推送报告」——记录请求时间，伴学师在学员卡上看到提醒，推送后清空。
ALTER TABLE `student_profile` ADD `report_push_requested_at` timestamp;
