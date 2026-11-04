-- v238：家庭码——父母扫同一个码，答案都落到同一个孩子名下
-- 码本身不入库：由「孩子编号 + 版本 + 签名（APP_SECRET 派生）」算出，见 api/familyCode.ts。
-- 这里只加版本号：换码 = 版本 +1，旧码立刻对不上，历史答卷一条不动。
ALTER TABLE `student_profile` ADD COLUMN `family_code_ver` int NOT NULL DEFAULT 0;
