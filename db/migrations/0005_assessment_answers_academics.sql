ALTER TABLE `assessment_results` ADD `answers` json NULL;--> statement-breakpoint
ALTER TABLE `assessment_results` MODIFY COLUMN `kind` enum('mbti','disc','e3','multi') NOT NULL;--> statement-breakpoint
ALTER TABLE `student_profile` ADD `academics` json NULL;