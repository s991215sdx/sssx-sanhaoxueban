-- v274 GROW 表单化：规划课四要素（目的/目标/策略/衡量）结构化数据，空则回退纯文本展示。
ALTER TABLE `coaching_cases` ADD `grow_form` json NULL;
