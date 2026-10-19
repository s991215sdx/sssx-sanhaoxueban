-- v223：测评中心批量推送——管理员组选测评推送给校园学生，留痕可审计
CREATE TABLE `campus_assess_pushes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `org_id` bigint unsigned,
  `created_by` bigint unsigned NOT NULL,
  `kinds` json NOT NULL,
  `user_ids` json NOT NULL,
  `user_count` int NOT NULL DEFAULT 0,
  `note` varchar(200) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `campus_assess_pushes_org_idx` (`org_id`)
);
