-- v221：机构级设置（JSON）——选科成绩权重等按机构可调项
-- organizations.settings: { xuanke: { scoreWeight: 0-60 } }，空 = 默认（校园机构35/通用机构40）
ALTER TABLE `organizations` ADD COLUMN `settings` json NULL;
