-- 校园报告逐学生授权：NULL 不回填，历史校园学生默认不开放任何报告。
ALTER TABLE `student_profile` ADD `campus_report_kinds` json NULL;
