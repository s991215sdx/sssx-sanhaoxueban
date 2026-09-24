CREATE TABLE `student_tutor` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `student_user_id` bigint unsigned NOT NULL,
  `tutor_user_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_tutor_pair` (`student_user_id`,`tutor_user_id`)
);
