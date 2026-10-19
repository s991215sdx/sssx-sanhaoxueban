-- v220：学校版专版（粤华打样）——选科意向三轮、预警中心、成长档案、催办提醒
-- 1) 选科意向：家长/学生从三大推荐中确认或自定义，custom 必填理由；按轮次组织（管理员开轮）
CREATE TABLE `subject_intentions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `org_id` bigint unsigned,
  `round_no` tinyint NOT NULL DEFAULT 1,
  `choice` enum('rec1','rec2','rec3','custom') NOT NULL,
  `subjects` json NOT NULL,
  `reason` varchar(500) NOT NULL DEFAULT '',
  `source` enum('parent','student','tutor') NOT NULL DEFAULT 'parent',
  `term` varchar(64) NOT NULL DEFAULT '',
  `created_by` bigint unsigned,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `subject_intentions_user_idx` (`user_id`),
  KEY `subject_intentions_org_idx` (`org_id`)
);
--> statement-breakpoint
-- 2) 意向轮次：管理员开启/关闭每一轮，家长端只对 open 轮可提交
CREATE TABLE `intention_rounds` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `org_id` bigint unsigned NOT NULL,
  `round_no` tinyint NOT NULL,
  `label` varchar(64) NOT NULL DEFAULT '',
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `created_by` bigint unsigned,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `intention_rounds_org_round` (`org_id`,`round_no`)
);
--> statement-breakpoint
-- 3) 预警中心：心理红线 / 学业下滑 / 动力预警，处置留痕
CREATE TABLE `warning_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `org_id` bigint unsigned,
  `type` enum('mental_redline','academic_drop','low_motivation') NOT NULL,
  `level` enum('关注','预警','高风险') NOT NULL DEFAULT '关注',
  `detail` json,
  `status` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  `handled_by` bigint unsigned,
  `handled_at` timestamp NULL,
  `handle_note` varchar(500) NOT NULL DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `warning_events_user_idx` (`user_id`),
  KEY `warning_events_org_idx` (`org_id`),
  KEY `warning_events_status_idx` (`status`)
);
--> statement-breakpoint
-- 4) 催办提醒：未参测学生名单推给班主任/年级主任/管理员（学校脱敏场景：不依赖手机号）
CREATE TABLE `reminders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `org_id` bigint unsigned,
  `student_id` bigint unsigned NOT NULL,
  `kind` enum('unassessed') NOT NULL DEFAULT 'unassessed',
  `message` varchar(500) NOT NULL DEFAULT '',
  `audience` enum('tutor','admin','jiaowu') NOT NULL DEFAULT 'admin',
  `audience_user_id` bigint unsigned,
  `read` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `reminders_org_idx` (`org_id`),
  KEY `reminders_audience_idx` (`audience_user_id`),
  KEY `reminders_student_idx` (`student_id`)
);
