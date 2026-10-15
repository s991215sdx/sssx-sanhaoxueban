ALTER TABLE `student_tutor` ADD `report_access` boolean NOT NULL DEFAULT true;
ALTER TABLE `student_tutor` ADD `report_access_expires_at` timestamp NULL;
