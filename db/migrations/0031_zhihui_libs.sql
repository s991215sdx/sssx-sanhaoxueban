-- 智慧生涯规划：数据底座三库 + 分年级规划模板 + 学员未来期望
-- 1) major_lib   专业底层库（天生智慧 1152+ 专业 × 27 字段）
-- 2) career_lib  职业库（种子 20 条随迁移插入，后台可扩充）
-- 3) gd_scores   广东院校专业分数库（后台上传 JSON 导入）
-- 4) grade_plans 分年级条件准备规划模板（按分数段 band × 年级 × 升学路径）
-- 5) student_aspirations 学员未来期望（允许留空，伴学师可后台编辑，系统可兜底建议）

CREATE TABLE `major_lib` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`menlei_code` varchar(8) NOT NULL DEFAULT '',
	`menlei` varchar(16) NOT NULL DEFAULT '',
	`cat_code` varchar(16) NOT NULL DEFAULT '',
	`cat` varchar(32) NOT NULL DEFAULT '',
	`code` varchar(16) NOT NULL,
	`name` varchar(128) NOT NULL,
	`level` varchar(16) NOT NULL DEFAULT '本科',
	`added_year` varchar(8) NOT NULL DEFAULT '',
	`one_liner` text,
	`jobs` text,
	`intro` text,
	`goal` text,
	`require` text,
	`knowledge` text,
	`kaoyan` text,
	`courses` text,
	`famous` text,
	`employment` text,
	`male_pct` varchar(16),
	`female_pct` varchar(16),
	`degree` varchar(64),
	`regions` text,
	`industries` text,
	`occupations` text,
	`salary` text,
	`schools` text,
	`internship` text,
	`certs` text,
	CONSTRAINT `major_lib_id` PRIMARY KEY(`id`),
	CONSTRAINT `major_lib_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `major_lib` ADD INDEX `major_lib_menlei_idx` (`menlei`);
--> statement-breakpoint
ALTER TABLE `major_lib` ADD INDEX `major_lib_cat_idx` (`cat`);
--> statement-breakpoint
ALTER TABLE `major_lib` ADD INDEX `major_lib_name_idx` (`name`);
--> statement-breakpoint
CREATE TABLE `career_lib` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT '',
	`duties` json,
	`content` text,
	`skills_pro` json,
	`skills_gen` json,
	`prospect` text,
	`path` text,
	`trend` text,
	CONSTRAINT `career_lib_id` PRIMARY KEY(`id`),
	CONSTRAINT `career_lib_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `gd_scores` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL DEFAULT 2025,
	`kelei` varchar(16) NOT NULL DEFAULT '',
	`batch` varchar(32) NOT NULL DEFAULT '',
	`school_code` varchar(16) NOT NULL DEFAULT '',
	`school` varchar(128) NOT NULL DEFAULT '',
	`group_code` varchar(32) NOT NULL DEFAULT '',
	`group_name` varchar(255) NOT NULL DEFAULT '',
	`major_code` varchar(16) NOT NULL DEFAULT '',
	`major_full` varchar(255) NOT NULL DEFAULT '',
	`major` varchar(128) NOT NULL DEFAULT '',
	`req` varchar(64) NOT NULL DEFAULT '',
	`plan` int,
	`years` varchar(16) NOT NULL DEFAULT '',
	`fee` varchar(32) NOT NULL DEFAULT '',
	`menlei` varchar(16) NOT NULL DEFAULT '',
	`cat` varchar(64) NOT NULL DEFAULT '',
	`y1_min` int,
	`y1_rank` int,
	`y2_min` int,
	`y2_rank` int,
	`y3_min` int,
	`y3_rank` int,
	`est_rank26` int,
	`city` varchar(32) NOT NULL DEFAULT '',
	`tier` varchar(16) NOT NULL DEFAULT '',
	`tags` varchar(255) NOT NULL DEFAULT '',
	CONSTRAINT `gd_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `gd_scores` ADD INDEX `gd_scores_school_idx` (`school`);
--> statement-breakpoint
ALTER TABLE `gd_scores` ADD INDEX `gd_scores_major_idx` (`major`);
--> statement-breakpoint
ALTER TABLE `gd_scores` ADD INDEX `gd_scores_menlei_idx` (`menlei`);
--> statement-breakpoint
CREATE TABLE `grade_plans` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`band` varchar(32) NOT NULL DEFAULT '',
	`grade` varchar(8) NOT NULL DEFAULT '',
	`path` varchar(32) NOT NULL DEFAULT '',
	`title` varchar(128) NOT NULL DEFAULT '',
	`content` text,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `grade_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_aspirations` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`school` varchar(128),
	`school_raw` varchar(128),
	`major` varchar(128),
	`major_raw` varchar(128),
	`career` varchar(128),
	`career_raw` varchar(128),
	`source` enum('student','tutor','system') NOT NULL DEFAULT 'student',
	`updated_by` bigint unsigned,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE now(),
	CONSTRAINT `student_aspirations_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_aspirations_user_unique` UNIQUE(`user_id`)
);

--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('中学教师','教育 · 中等教育教师','["钻研教材与课程标准，组织课堂教学，帮助学生掌握教学大纲规定的文化科学知识", "备课、讲课、听课、辅导、批改作业，组织考试与质量分析", "承担班主任工作：班级管理、家校沟通、学生思想教育", "参与教研活动、公开课评比与教育科研"]','教师是以传授知识、帮助学生树立正确价值观为主要目的的职业，承担着教书育人、培养社会建设者的使命。中学阶段学科分化明显，学科教师的专业深度直接影响学生的升学走向。','["扎实的学科专业知识与教学技能", "教学设计能力：把大纲要求转化为可操作的课堂", "班级管理与学生心理引导能力", "命题、批改与学业质量分析能力"]','["普通话与粉笔字等教师基本功", "办公软件与课件制作（PPT、学科工具）", "语言表达能力：讲解清晰、条理分明", "沟通能力：与学生、家长、同事良好协作"]','教师职业受社会尊重，随着教育投入持续加大，中西部与农村地区仍有大量缺口；同时教师专业化、学历要求逐年提高，研究生学历在重点中学越来越常见。','实习教师 → 中学三级/二级/一级教师 → 高级教师 → 正高级/特级教师；职称评定与教龄、业绩、学历密切相关，也可向教研员、教务管理等方向发展。','基础教育对优质师资的需求长期存在；招聘门槛（学历、资格证）不断提高，公费师范生、教师专项等定向培养通道值得关注。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('大学教师','教育 · 高等教育教师','["承担本专科与研究生的课程教学，编写教材与讲义", "开展科学研究：设计实验、发表论文、申请专利与课题", "指导毕业论文、生产实习、社会实践与学科竞赛", "参与学科建设、实验室建设与学校行政工作"]','大学教师是教学与科研双肩挑的职业，从助教、讲师起步，学术与科研成果是晋升的主轴。学术自由度高、社会地位高，但入门门槛（博士学历）与科研压力也最高。','["所在学科深厚的专业知识", "科研能力：选题、实验设计、论文写作与课题申报", "教学能力：把前沿研究转化为课堂教学", "学术合作与研究生指导能力"]','["学术写作与外语能力（阅读国际文献）", "演讲与课堂组织能力", "时间管理：平衡教学、科研与行政", "跨学科沟通与项目协作"]','高等教育正从规模扩张转向质量提升，对高水平师资的需求持续旺盛；「非升即走」的预聘制普遍化，青年教师的竞争加剧，但顶尖人才始终稀缺。','助教 → 讲师 → 副教授 → 教授；另有管理岗（科员 → 科长 → 处长）与双肩挑路线。海外名校博士与代表性成果是快速晋升的关键。','高校招聘与学科发展强相关：人工智能、集成电路、生物医药等战略学科需求大；同时教学型岗位与产业教授等新形态出现。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('小学教师','教育 · 初等教育教师','["对学生全面实施素质教育，完成学校规定的教学任务与指标", "进行学科教学与习惯培养，促进小学生全面发展", "保障学生在校安全，做好家校联系与学生思想工作", "组织班会、少先队活动与课外兴趣活动"]','小学教师是孩子系统教育的启蒙者，全科素养与耐心同样重要：既要教知识，更要养习惯、护安全、育品格。职业稳定性高，与学生成长的即时成就感强。','["学科教学能力（语数英+综合）", "儿童发展与教育心理学应用", "课堂组织与班级管理能力", "活动设计与社团指导能力"]','["普通话（二级甲等以上）、板书与简笔画", "亲和力、责任心与公平心", "与家长沟通的能力", "多媒体教学工具使用"]','小学教师受社会尊重，学历门槛逐年提高（本科化、优质校研究生化）；随着对孩子教育重视度提升，教师待遇与社会地位持续向好。','实习 → 小学二级/一级教师 → 小教高级 → 正高级；五年一评职称，学历高、专业对口是优势，也可向教务主任、校长等管理岗发展。','出生人口变化带来结构性调整：城市优质校竞争激烈，乡村学校缺口仍在；心理健康教育、科学教育等新岗位增加。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('幼儿教师','教育 · 学前教育教师','["组织幼儿唱歌、跳舞、绘画、游戏等活动，培养安全意识与生活习惯", "落实《幼儿园工作规程》与《3-6岁儿童学习与发展指南》", "安排幼儿一日活动，做好保育与教育的结合", "填写家园联系手册，与家长保持沟通，做好教研记录"]','幼儿教师是启蒙教育者，角色不仅是知识传递者，更是幼儿学习活动的支持者、合作者与引导者。以爱心与耐心为先，专业技能（弹唱跳画）全面。','["幼儿五大领域教学：健康、语言、社会、科学、艺术", "幼儿行为观察与发展评估", "班级常规管理与安全管理", "环境创设与玩教具制作"]','["普通话（最重要的一项技能）", "音乐、舞蹈、美术等艺术技能", "与幼儿及家长的沟通能力", "应急处理与保育知识"]','学前教育是人生发展的奠基性教育，国家持续加大投入；出生率下降带来区域分化，普惠性公办园师资质量要求不断提高。','见习生 → 实习生 → 配班教师 → 主班教师 → 教研组长/年级组长 → 保教主任 → 副园长 → 园长。','幼师就业压力相对小于其他教育阶段，但公办园对学历与资格证要求逐年提高，高素质幼师始终紧缺。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('科研人员','科学研究','["围绕某一领域开展专业研究：试验设计、数据分析、论文撰写", "申请国家/省市级课题与科研基金", "在核心期刊与学术会议发表研究成果", "申请研究专利，推动成果转移转化"]','科研人员是从事科学研究的高级专业人才，可在高校、科研院所、企业研发中心工作。科学分为自然科学与社会科学，研究可以是实验也可以是调查与分析。','["某一学科深厚的专业知识", "实验设计与数据分析能力", "学术写作与论文发表能力", "课题申报与项目管理能力"]','["外语能力（阅读与撰写国际论文）", "文献检索与学习能力", "团队合作与跨学科协作", "学术演讲与交流"]','科研人员享有较高社会地位，也是我国向创新型国家迈进过程中极为缺乏的人才；企业研发岗薪酬竞争力强，基础科研则靠长期投入产出。','研究实习员/博士后 → 助理研究员（讲师） → 副研究员（副教授） → 研究员（教授） → 学科带头人 → 院士级。','国家持续加大研发经费投入，企业研发中心（华为、比亚迪、头部药企等）成为科研就业新高地；交叉学科（AI+生物、计算材料等）机会最多。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('临床医生','医疗卫生 · 医师','["接诊患者：问诊、查体、开具检查与诊断", "制定治疗方案：用药、手术或转诊", "书写病历，执行查房与值班制度", "参与科室业务学习、病例讨论与科研"]','临床医生是直接守护生命的职业，培养周期最长的职业之一（5+3+ 专科培训）。社会尊重度高、职业壁垒强、越老越吃香，但对责任心、抗压能力与终身学习要求极高。','["扎实的医学理论与临床技能（诊断/操作/手术）", "循证医学思维：基于证据做决策", "急危重症识别与处置能力", "专科纵深（内/外/妇/儿等方向）"]','["医患沟通能力与共情", "病历书写与医学文献检索", "团队协作（护士/医技/药师）", "抗压能力与体力（值班制度）"]','医疗需求随老龄化持续增长，优质医师长期稀缺；公立医院编制改革与多点执业并行，专科医生（口腔、眼科、肿瘤等）市场价值突出。','住院医师规范化培训（3 年） → 主治医师 → 副主任医师 → 主任医师；每级职称需年限+考试+业绩，亚专科化是主流方向。','「5+3+X」培养制度下成才周期明确；社会办医、互联网医疗提供新舞台，但顶尖人才始终集中于大型公立医院。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('软件工程师','信息技术','["根据需求设计与实现软件功能模块", "编写高质量代码：实现、测试、调试、优化", "与产品、测试、运维协作完成功能交付", "持续学习新技术栈，参与技术方案评审"]','软件工程师是用代码构建数字世界的职业，覆盖互联网、金融、制造等所有行业。逻辑强、自驱力强的从业者成长极快，是数学与逻辑智能优势者的首选之一。','["数据结构与算法功底", "至少一门主力语言（Java/Go/Python/C++ 等）", "操作系统、网络、数据库等计算机基础", "工程能力：版本管理、测试、性能优化"]','["逻辑思维与问题分解能力", "英文文档阅读与写作", "团队协作与代码评审", "持续学习能力（技术迭代快）"]','数字化转型的底层人才，需求长期旺盛；行业从「人海」转向「精兵」，AI 工具重塑初级岗位的同时抬高了资深工程师的天花板。','初级工程师 → 中级 → 高级 → 技术专家/架构师（P 序列），或 转管理：组长 → 技术经理 → 技术总监；大厂履历显著加速成长。','基础编码岗位受 AI 冲击明显，但「懂业务+懂架构」的复合型工程师更值钱；芯片、工业软件、AI 基础设施等新赛道人才紧缺。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('数据分析师','信息技术 · 数据分析','["收集、清洗与整理业务数据，建立分析口径", "用统计方法与模型分析数据，输出洞察报告", "搭建与维护数据看板（BI）", "与业务团队协作，用数据支持决策"]','数据分析师是「用数据说话」的职业，连接业务与技术。数学统计基础+业务理解+可视化表达三位一体，金融、零售、互联网、制造都需要。','["统计学与概率论基础", "SQL 与数据仓库常识", "Python/R 数据处理（pandas 等）", "可视化工具（Excel/Tableau/PowerBI）"]','["业务理解与指标拆解能力", "报告撰写与数据讲故事能力", "跨部门沟通协作", "逻辑思维与细节严谨"]','数据要素价值被越来越多企业重视，分析岗渗透各行业；门槛低于纯技术岗，但「懂行业」的分析师溢价明显。','初级分析师 → 资深分析师 → 分析专家/商业分析师（BA），或转向数据产品经理、数据科学家（需补机器学习）。','自助式 BI 降低了取数门槛，分析岗价值向上游（指标体系设计、因果推断）迁移；与 AI 结合（智能分析）是明确方向。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('律师','法律服务','["接受委托，提供法律咨询与法律文书起草", "代理诉讼：出庭、举证、辩论，维护委托人权益", "担任企业法律顾问：合同审查、合规建议", "参与谈判、调解与仲裁"]','律师是法治社会的专业服务人员，用法律规则帮当事人解决问题。前期积累期较长（实习律师阶段收入一般），但专业壁垒高、成长复利强。','["扎实的法律专业知识与检索能力", "法律文书的起草与审查", "庭审辩论与证据组织能力", "特定领域的纵深（刑事/民商/知识产权等）"]','["逻辑思维与表达能力", "谈判与沟通技巧", "抗压能力与时间管理", "职业伦理与责任心"]','法治建设持续推进，企业合规、知识产权、数据合规等新领域需求旺盛；头部律所与红圈所薪酬可观，但二八分化明显。','实习律师（1 年） → 执业律师 → 团队主办律师 → 合伙人；或进入公检法系统、企业法务总监路线。','律师人数持续增长，竞争加剧；细分专业化（金融、医疗、数据等）与涉外法律服务是突围方向。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('会计师','财务 · 会计/审计','["账务处理：凭证审核、记账、结账与报表编制", "纳税申报与税务筹划支持", "参与预算编制与成本费用管控", "配合审计，提供财务资料与说明"]','会计师是企业财务信息的生产者，记录并解释企业的经营结果。职业路径清晰、证书体系成熟（初级→中级→CPA），经验积累带来稳定溢价。','["会计准则与账务处理能力", "财务软件（用友/金蝶/SAP）", "Excel 与财务建模", "税务法规与申报实务"]','["细致严谨与原则性", "数据敏感度", "沟通协作（业务/税务/审计）", "持续学习（准则与政策更新）"]','所有企业都需要财务，基础核算岗正被财务共享中心与自动化工具压缩；管理会计、财务分析等高阶岗位价值上升。','出纳/会计助理 → 会计 → 总账会计/财务主管 → 财务经理 → 财务总监（CFO）；CPA/中级职称是关键跳板。','业财融合趋势下，「懂业务的财务」最受欢迎；财务共享与 RPA 取代重复性核算，倒逼会计向分析与管理升级。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('护士','医疗卫生 · 护理','["执行医嘱：给药、输液、护理操作与病情观察", "记录生命体征与护理文书", "做好患者基础护理与心理安抚", "参与急救与病房管理，做好交接班"]','护士是医疗体系中人数最多的专业力量，与医生协作直接照护患者。工作强度大但就业极稳，专科护士（ICU/手术室/肿瘤）有明确的技术纵深。','["护理操作技能（静脉/导尿/吸痰等）", "病情观察与应急处理能力", "专科护理知识（内/外/妇/儿）", "护理文书书写"]','["同理心与沟通能力", "体力与抗压能力", "团队协作", "责任心与慎独精神"]','老龄化社会护理需求爆发，护理人才缺口巨大；国际护理（出国）通道薪酬可观，男护士在急诊/ICU 尤为紧缺。','新护士（规范化培训） → 护师 → 主管护师 → 副主任/主任护师；或向护理管理、专科护士、护理教育方向发展。','护理服务从医院延伸到社区、养老、康复与互联网+护理，就业场景持续拓宽；本科化培养成为大势。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('心理咨询师','心理健康服务','["接待来访者，进行心理评估与咨询", "运用谈话疗法等技术帮助来访者疏导情绪、调整认知", "建立咨询档案，做好保密与伦理规范", "开展心理健康讲座、团体辅导与危机干预"]','心理咨询师用专业方法帮助人们解决心理困扰，工作场景包括学校心理中心、医院心理科、咨询机构与自主执业。是一个「越老越值钱」的助人性职业。','["心理咨询理论与技术（认知行为/人本/家庭治疗等）", "心理评估与测量工具使用", "危机识别与干预能力", "个案概念化与督导素养"]','["共情与倾听能力", "语言表达与沟通", "自我觉察与情绪稳定", "职业伦理与边界感"]','全社会心理健康关注度快速提升，学校心理教师、企业 EAP 需求旺盛；行业规范化（学历教育+注册系统）正在重建门槛。','实习咨询师（受督导） → 初级咨询师 → 成熟咨询师 → 督导师/机构合伙人；学历教育（心理学硕士）是专业背书的核心。','学校心理咨询室建设纳入政策要求，体制内岗位增加；线上咨询平台成熟，远程服务拓宽了执业半径。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('设计师','创意设计','["理解客户需求，产出视觉/产品设计方案", "绘制草图与效果图，完成设计交付物", "与文案、开发、印刷等协作落地", "跟进设计趋势，维护品牌视觉一致性"]','设计师用视觉解决问题：平面、UI/UX、产品与空间设计都属于这一大家族。作品集是硬通货，审美×商业理解×软件技能三者兼备者稀缺。','["设计软件（PS/AI/Figma/建模工具）", "版式、色彩与字体设计功底", "用户研究与需求转化能力", "特定领域纵深（品牌/UI/空间）"]','["审美与创意表达", "沟通与提案能力", "时间管理与多任务", "接受反馈与快速迭代"]','商业社会对设计的付费意愿持续增强，UI/UX、品牌设计需求稳定；AI 生成工具冲击低端美工，但对「提出好问题」的设计师是放大器。','设计助理 → 设计师 → 资深设计师 → 设计主管/艺术总监；或积累客户后成立独立工作室。','设计岗位从「执行美」转向「解决商业问题」，懂数据与转化的设计师溢价最高；自由职业与远程接单成为常态选项。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('建筑师','建筑与工程设计','["参与建筑设计方案创作：概念、平立剖与效果图", "协调结构、机电、暖通等专业完成施工图", "对接报建、审图与施工现场配合", "研究规范，把控项目品质与进度"]','建筑师是建筑项目的设计总协调，艺术与工程思维的结合体。行业正经历调整期，但城市更新、乡村振兴与绿色建筑带来新机会。','["建筑设计理论与方案能力", "建筑设计软件（CAD/SU/Rhino/Revit）", "建筑规范与结构常识", "项目汇报与文本表达"]','["空间想象与审美", "多方协调能力（甲方/施工/专业）", "吃苦耐劳（工地与改图）", "商业理解（成本控制）"]','房地产增量时代落幕，但城市更新、存量改造、产业园区与公共建筑仍有稳定需求；头部设计院与明星事务所强者恒强。','助理建筑师 → 建筑师 → 主创建筑师 → 主任建筑师/合伙人；注册建筑师资格是重要分水岭。','行业从增量开发转向存量运营，建筑师能力向策划、更新、室内与城市设计延展；参数化与 AI 辅助设计提升效率。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('新媒体运营','传媒 · 内容运营','["策划并生产图文/短视频内容，维护账号更新", "分析数据（阅读/完播/转化），迭代内容策略", "策划线上活动与粉丝互动", "对接商务合作与投放"]','新媒体运营是移动互联网时代的「内容+增长」复合岗位，存在于每一家重视线上阵地的企业。写作、审美、数据sense 三者结合的从业者最抢手。','["内容策划与写作（选题/标题/脚本）", "平台规则与流量机制（公众号/视频号/抖音/小红书）", "数据分析与复盘", "基础剪辑与设计（剪映/PS）"]','["网感与热点敏感度", "用户同理心", "项目管理与执行力", "沟通协作（设计/商务/客服）"]','全域运营（公域+私域）成为企业标配，复合型人才稀缺；AI 工具普及后，「有品味、懂用户」的运营价值进一步凸显。','运营助理 → 新媒体运营 → 资深运营/主编 → 运营经理/内容总监；或转型自媒体创业。','短视频与直播电商仍扩编，但单纯「发内容」的岗位被整合，「内容+投放+转化」的全链路运营是晋升方向。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('企业管理者','企业 · 管理','["制定团队目标并分解到部门与个人", "组织资源：人员、预算与流程的配置", "激励与考核团队，处理跨部门协作", "对经营结果负责，向更高层汇报"]','管理者通过他人完成工作：定方向、配资源、带队伍、拿结果。金字塔式晋升竞争激烈，但回报（物质与成就感）也最丰厚，是 E 型（企业型）兴趣者的主赛道。','["业务理解与战略拆解能力", "团队管理与人才培养", "数据分析与经营决策", "行业专业知识（所在领域纵深）"]','["领导力与影响力", "沟通谈判与冲突处理", "抗压与韧性", "结构化思维与表达"]','优秀管理者永远是稀缺品；经管类出身+一线业务历练+关键时刻的战果，是通往高层的通用路径。','管培生/业务骨干 → 主管 → 经理 → 总监 → 高管（VP/CXO）；或创业成为创始人。','组织扁平化让「官本位」晋升变窄，专业序列（P 序列）与管理序列并行；懂数字化与AI转型的管理者最受追捧。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('市场营销专员','企业 · 市场','["市场调研与竞品分析，输出洞察", "策划并执行营销活动（线上+线下）", "管理品牌物料与传播内容", "跟进销售线索与转化数据"]','市场营销是发现需求、塑造价值并促成交换的职业，介于创意与数据之间。从文案策划到增长黑客，赛道内细分极多，适合表达强、点子多的学生。','["市场营销理论与 4P/用户旅程", "市场调研与数据分析", "活动策划与项目管理", "文案与内容能力"]','["创意与热点敏感", "沟通与提案表达", "跨部门协作", "结果导向与韧性"]','所有行业都需要市场岗，数字化营销（信息流/私域/内容营销）人才缺口大；经验复利强，优秀的市场负责人薪酬上限高。','市场助理 → 市场专员 → 市场经理 → 市场总监（CMO）；也可在品牌、公关、增长等细分深耕。','「品效合一」要求市场人既懂品牌又懂投放转化；AI 内容工具改变生产方式，策略与洞察能力成为核心竞争力。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('公务员','公共管理 · 党政机关/事业单位','["贯彻执行政策：起草文件、组织落实、督查反馈", "办理群众事务：审批、服务与矛盾调解", "撰写公文、汇报材料与会议材料", "参与专项工作与应急值守"]','公务员在党政机关与事业单位行使公共职能，特点是稳定、规范、社会价值感强；考试（国考/省考/选调）是最主流的入口，应届生身份与专业对口都很关键。','["公文写作与政策理解", "行政实务与流程办理", "所在领域专业知识（财政/法律/规划等）", "调查研究与材料综合"]','["沟通协调与群众工作", "纪律性与保密意识", "文字功底与办公软件", "抗压与情绪稳定"]','考公热度持续高位，报录比逐年攀升；法学、汉语言、财会、计算机等专业岗位多、机会大，应届选调生是优质通道。','科员 → 副科 → 正科 → 副处 → 正处……职级并行制下也可走职级序列；遴选考试是跨层级流动主渠道。','编制管理趋紧、逢进必考；数字政府建设催生数据治理、网络安全等新岗位，理工科专业在体制内同样吃香。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('金融从业者','金融服务','["银行：柜面/客户经理/信贷审批与风险管理", "证券基金：研究分析、投资交易、渠道销售", "保险：产品设计、精算与核保理赔", "企业：投融资、资金管理（司库）"]','金融行业连接资金与实体经济，岗位细分极多：前台（销售/交易）、中台（风控/产品）、后台（运营/科技）。名校背景与证书（CFA/FRM/CPA）是硬通货。','["金融理论与财务分析", "数据建模与估值", "风险管理常识", "细分资质（基金/证券/银行从业资格）"]','["沟通与客户服务能力", "抗压与合规意识", "英文与信息检索", "逻辑思维与数字敏感"]','行业从粗放增长转向精细化，头部机构集中度提升；财富管理、养老金融、绿色金融等新赛道扩张，金融科技人才紧缺。','柜员/分析师助理 → 客户经理/研究员 → 团队负责人 → 分支行行长/投资总监；证书与业绩是双引擎。','数字化转型压缩传统柜面岗位，理财顾问与机构业务岗扩张；监管趋严下，合规与风控人才价值上升。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
--> statement-breakpoint
INSERT INTO `career_lib` (`name`,`category`,`duties`,`content`,`skills_pro`,`skills_gen`,`prospect`,`path`,`trend`) VALUES ('工程师','工程技术','["根据设计规范完成产品/系统的设计与图纸", "跟进制造、安装与调试，解决现场技术问题", "编写技术文档、测试报告与工艺文件", "持续改进：降本、提质与工艺优化"]','工程师是把科学原理变成现实生产力的职业，覆盖机械、电气、电子、土木、化工等方向。经验与项目履历是立身之本，注册类资格（一建/注电等）显著抬升身价。','["工程设计与计算（CAD/CAE/仿真）", "本专业规范与标准", "项目管理与进度控制", "故障诊断与现场解决问题"]','["动手与空间想象能力", "技术文档写作", "跨专业协作（工艺/生产/质量）", "责任心与安全底线"]','制造强国与基建更新带来长期需求，智能制造、新能源、半导体设备方向景气度高；资深工程师+注册资格是稀缺组合。','助理工程师 → 工程师 → 高级工程师 → 教授级高工/技术专家；或转向项目经理、技术管理（总工）。','「工程师红利」替代人口红利，研发与工艺工程师待遇持续上行；跨学科（机电一体化、软硬件结合）人才最抢手。') ON DUPLICATE KEY UPDATE `category`=VALUES(`category`), `duties`=VALUES(`duties`), `content`=VALUES(`content`), `skills_pro`=VALUES(`skills_pro`), `skills_gen`=VALUES(`skills_gen`), `prospect`=VALUES(`prospect`), `path`=VALUES(`path`), `trend`=VALUES(`trend`);
