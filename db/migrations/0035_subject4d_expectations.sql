-- v175：学科四维测评 kind + 未来期望表
-- 1) assessment_results.kind 枚举加 subject4d（9 科 × 4 维 × 3 题李克特量表）
ALTER TABLE `assessment_results` MODIFY COLUMN `kind` enum('mbti','disc','e3','e3parent','multi','multi5','anchor','holland','mental','mentalsdq','mentalpa','scl90','discparent','subject','subject4d') NOT NULL;
--> statement-breakpoint
-- 2) 学生未来期望（期望院校/专业/职业）：允许留空，伴学师可后台代编，系统建议兜底
CREATE TABLE `student_expectations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `student_id` int NOT NULL,
  `school` varchar(128) NOT NULL DEFAULT '',
  `major_cat` varchar(64) NOT NULL DEFAULT '',
  `careers` varchar(255) NOT NULL DEFAULT '',
  `source` enum('student','tutor','system') NOT NULL DEFAULT 'student',
  `note` varchar(500) NOT NULL DEFAULT '',
  `updated_by` int,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `student_expectations_student_unique` UNIQUE(`student_id`)
);
--> statement-breakpoint
CREATE INDEX `student_expectations_student_idx` ON `student_expectations` (`student_id`);
