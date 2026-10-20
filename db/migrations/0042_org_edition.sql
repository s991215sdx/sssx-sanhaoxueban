-- v227：机构版本——校园版(school)/机构版(org)，平台超管开通时二选一
-- organizations.edition：决定整套后台形态（学校控制台/机构后台）、测评登录页与术语体系
-- 1) 新增版本字段，存量默认机构版（纯加法，老代码无感）
ALTER TABLE `organizations` ADD COLUMN `edition` enum('school','org') NOT NULL DEFAULT 'org';
-- 2) 存量回填：存在 campus=true 邀请渠道的机构 = 校园版
--    （与现行「有无校园渠道」判定逐字节一致，粤华自动归位，零行为变化）
UPDATE `organizations` SET `edition` = 'school' WHERE EXISTS (SELECT 1 FROM `invite_channels` c WHERE c.org_id = `organizations`.`id` AND c.campus = 1);
