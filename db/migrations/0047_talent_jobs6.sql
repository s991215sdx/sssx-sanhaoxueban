-- v270：岗位从四值扩到六值，管理改为「潜质通道」
-- 1) enum 先保留 mgmt 作中间态，否则下面的 UPDATE 没有落点
-- 2) 老 mgmt 记录迁到 pot：报告 JSON 是提交时的快照，内容不受影响；
--    列表页的岗位名会显示为「管理潜质」——语义上正是它本来的意思（那本来就是一次管理评估）
-- 3) 再去掉 mgmt，避免新旧两套并存、以后写代码还要兼容一个已死的值
ALTER TABLE `talent_assessments` MODIFY COLUMN `position` enum('mkt','sales','admin','fin','service','pot','mgmt') NOT NULL;
--> statement-breakpoint
UPDATE `talent_assessments` SET `position` = 'pot' WHERE `position` = 'mgmt';
--> statement-breakpoint
ALTER TABLE `talent_assessments` MODIFY COLUMN `position` enum('mkt','sales','admin','fin','service','pot') NOT NULL;
