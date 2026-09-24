# v61 计划：报告下载修复 + 开方功能 + 三系统分离

## 1. 报告下载乱码（图1）
现状：onDownload = window.print() 打印实时 DOM，绝对定位徽章/网格在打印介质下重叠乱码。
修法：改用 reportDownload.ts 的独立打印窗口生成器（干净内联样式 HTML）——
e3/mbti/disc/multi5/anchor/holland/mental(legacy)/combined 各有现成生成器；
parent/discparent/心理新量表变体保留 window.print 兜底。

## 2. AI 问诊训练方法可点开（图2）
- askAdvice 兜底返回 methods（id/name/sub/ability 结构数组）；AI 路径也附带命中能力的方案库方法
- AiCoachPanel 答案下方渲染「推荐训练方法」可展开卡（复用方法详情字段：适用/目的/步骤/频率/工具）

## 3. 开方功能（图3）
- TrainingPlanLibrary：grid-cols-3→2，详情区加大字号/内边距（阅读友好）
- AbilityPlanCard 每个方法加勾选框（受控选中态上提）
- 底部「开方」浮动条：已选 N 个方法 → 开方面板：学员选择 + 自定义方案文本 + [确认开方并推送学员端] [下载开方单]
- 后端：student_prescriptions 表（迁移 0022）+ coach.createPrescription/listPrescriptions（同机构/名下校验）
- 学员端：Dashboard 首页加「伴学处方」卡（方法详情可展开 + 自定义方案 + 开方伴学师 + 日期）

## 4. 三系统分离
- Layout：admin/tutor 隐藏学员端导航（首页/预习/查漏/测评/试卷/树洞/伴学师/报告），只留伴学工作台+后台管理
- App：RoleGate——staff 访问学员页一律重定向 /tutor；staff 跳过 ProfileGuard/ModuleGate
- 超管后台：机构管理 + 数据仪表盘（全系统合计 + 各机构分栏统计）+ 系统选择器（选定机构→总览/学员/伴学师/邀请按机构查看）
- 后端：adminRouter overview/students/users/tutors 加可选 orgId 入参（机构管理员强制本机构）；orgRouter.dashboard 每机构业务量统计

## 5. 收尾
smoke-render-v61 + tsc + build + commit + 保存版本
