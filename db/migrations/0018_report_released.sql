-- V54：报告由伴学师把关。新增 report_released 开关：默认 false（家长不可见），伴学师/管理员推送后为 true。
ALTER TABLE `student_profile` ADD `report_released` boolean NOT NULL DEFAULT false;
