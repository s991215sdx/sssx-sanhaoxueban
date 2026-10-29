-- v235：家庭教育测评独立题包
-- 1) assessment_results.kind 增加两个枚举值：familystudent（学生侧补充题包）/ familyparent（家长侧家庭卷）
--    独立于 e3 / e3parent，家庭包不复用学习力诊断的题号，改题互不影响
ALTER TABLE `assessment_results` MODIFY COLUMN `kind` enum('mbti','disc','e3','e3parent','multi','multi5','anchor','holland','mental','mentalsdq','mentalpa','scl90','discparent','subject','subject4d','familystudent','familyparent') NOT NULL;
--> statement-breakpoint
-- 2) 学员档案：走读 day / 寄宿 board
--    寄宿家庭每周可相处时间本就更少，台阶判定阈值需整体下调 0.4 分（见 contracts/familyProfile.ts）
ALTER TABLE `student_profile` ADD COLUMN `boarding` varchar(16) NULL;
