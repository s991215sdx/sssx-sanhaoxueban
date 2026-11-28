-- v297：伴学师对自己发出的码注册的学员，报告恒可看。
-- 1) 伴学师/管理员「邀请学员默认可看报告」全部置开（存量开关统一，后台不再出现「默认无报告」）
UPDATE `users` SET `invite_report_default` = true WHERE `role` IN ('tutor', 'admin');
--> statement-breakpoint
-- 2) 历史分配记录里被锁住的渠道学员：一律放开并清掉有效期。
--    只动「渠道归属该伴学师」的行，管理员手动收回别人的权限不受影响。
UPDATE `student_tutor` `st`
  JOIN `invite_registrations` `ir` ON `ir`.`user_id` = `st`.`student_user_id`
  JOIN `invite_channels` `ic` ON `ic`.`id` = `ir`.`channel_id`
  SET `st`.`report_access` = true, `st`.`report_access_expires_at` = NULL
  WHERE `ic`.`tutor_id` = `st`.`tutor_user_id`;
