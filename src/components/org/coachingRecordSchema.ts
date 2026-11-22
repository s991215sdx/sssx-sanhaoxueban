export type CoachingRecordType = "planning" | "parent_cycle" | "family_action" | "home_visit" | "fulltime" | "holiday" |
  "subject_review" | "four_line_review" | "mindset_action" | "pause" | "resume" | "renewal" | "termination" |
  "closure_assessment" | "closure_interview" | "transfer_export" | "disposal";
export type RecordPayload = Record<string, unknown>;
export type PayloadChange = (key: string, value: unknown) => void;

export const PLANNING_STEPS = ["服务启动与资料核对", "学生目标访谈", "家长期待访谈", "全科成绩与排名口径", "选科与升学政策核对", "目标院校与专业初探", "综合测评结论核对", "优势与可用资源", "学习现状与关键卡点", "目标差距量化", "学期总目标", "学科分目标", "学习路径与课程组合", "前三个月一对一与督学", "后三个月形式评估", "家庭配合与沟通机制", "风险预案与复测节点", "三方确认与滚动复盘"] as const;
export const FULLTIME_FIELDS = [
  ["taskFocus", "本时段任务重点"], ["studied", "实际学习内容"], ["difficulty", "困难与卡点"], ["blankFilling", "补漏动作"],
  ["previewHomework", "预习与作业"], ["timeBudget", "时间预算与执行"], ["keyTasks", "关键任务验收"], ["tomorrowFirst", "明日第一件事"],
] as const;
export const RECORD_LABELS: Record<CoachingRecordType, string> = {
  planning: "规划课·18 步", parent_cycle: "亲子美言课·月度周期", family_action: "家庭行动与核验", home_visit: "家访记录（敏感）",
  fulltime: "全日制三时段", holiday: "寒暑假计划与打卡", subject_review: "学科考试复盘", four_line_review: "目标／学科／执行／家庭四线复盘",
  mindset_action: "心智成长行动", pause: "暂停服务", resume: "恢复服务", renewal: "续约安排", termination: "终止服务",
  closure_assessment: "结课前后对照评估", closure_interview: "结课访谈与材料交接", transfer_export: "转交与导出", disposal: "附件到期销毁",
};
export const FIELD_LABELS: Record<string, string> = {
  steps: "规划步骤", no: "序号", done: "已完成", evidence: "证据", nextAction: "下一步", studentGoal: "学生目标", parentExpectation: "家长期待",
  academicBaseline: "学情起点", pathway: "升学与学习路径", reviewDate: "复盘日期", guardianUserId: "监护人", cycleStart: "周期开始",
  sessions: "课程记录", topic: "主题", occurredAt: "日期", practice: "现场练习", observation: "家庭观察", relationshipGoal: "亲密关系目标",
  familyFeedback: "家庭反馈", responsibleUserId: "责任人", action: "行动／操作", result: "结果", verifiedBy: "核验人", verificationNote: "核验结论",
  address: "家访地址", contact: "联系方式", participants: "参与人", guardianConfirmed: "监护人确认", purpose: "目的", observations: "观察",
  nextActions: "后续行动", blocks: "三时段", signInAt: "签到", signOutAt: "签退", leaveReason: "请假原因", makeupPlan: "补学安排",
  handoffNote: "交接说明", theme: "主题", overallPlan: "总计划", dailyCheckins: "每日打卡", day: "日期", task: "任务", completed: "已完成",
  outcome: "成果", schoolHandoff: "开学交接", subject: "学科", examName: "考试", scoreFacts: "成绩事实", knowledgeGap: "知识差距",
  methodGap: "方法差距", executionGap: "执行差距", correction: "订正安排", nextCheckDate: "下次检查", goalLine: "目标线", academicLine: "学科线",
  executionLine: "执行线", familyLine: "家庭线", nextPhase: "下一阶段", familyCommunicated: "已与家庭沟通", growthTheme: "成长主题",
  studentReflection: "学生反思", nextStep: "下一步", effectiveDate: "生效日期", reason: "原因", resumeCondition: "恢复条件", catchUpPlan: "补齐计划",
  nextStart: "下一阶段开始", nextEnd: "下一阶段结束", scope: "范围", feeAgreement: "费用约定", familyConfirmed: "家庭确认", outstandingItems: "未尽事项",
  beforeAfter: "前后对照", nextSteps: "后续建议", familyCommunication: "家庭沟通", continuationIntent: "继续意向", outcomeEvidence: "结果证据",
  interviewedAt: "访谈时间", conclusion: "结论", handoffMaterials: "交接材料", familyQuestions: "家庭问题", destination: "转交去向",
  familyAuthorized: "家庭授权", deliverableId: "附件编号", retentionChecked: "保留期限已核验", submittedAt: "提交时间", verifiedAt: "核验时间",
  ...Object.fromEntries(FULLTIME_FIELDS),
};

export function text(payload: RecordPayload, key: string): string { return typeof payload[key] === "string" ? payload[key] as string : ""; }
export function bool(payload: RecordPayload, key: string): boolean { return payload[key] === true; }
export function num(payload: RecordPayload, key: string): number { return typeof payload[key] === "number" ? payload[key] : 0; }
export function rows<T extends Record<string, unknown>>(payload: RecordPayload, key: string): T[] { return Array.isArray(payload[key]) ? payload[key] as T[] : []; }
export function localDateTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
