export const COACHING_SERVICE_ROLES = [
  { key: "consultant", label: "咨询师", responsibility: "谈单成交与服务衔接" },
  { key: "tutor", label: "伴学师", responsibility: "学员陪跑统筹与成长陪伴" },
  { key: "supervisor", label: "督学师", responsibility: "学习督学、执行检查与当月总结" },
  { key: "coach", label: "学习教练", responsibility: "心法课、技法课与当月总结" },
  { key: "admin", label: "管理员", responsibility: "教学主管、服务团队分配与下月计划" },
] as const;

export type CoachingServiceRole = (typeof COACHING_SERVICE_ROLES)[number]["key"];
export const COACHING_SERVICE_ROLE_KEYS = COACHING_SERVICE_ROLES.map((role) => role.key) as CoachingServiceRole[];

export function coachingServiceRoleLabel(role: string): string {
  return COACHING_SERVICE_ROLES.find((item) => item.key === role)?.label ?? role;
}

function assertMonth(month: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("月份格式应为 YYYY-MM");
}

export function shiftCoachingServiceMonth(month: string, offset: number): string {
  assertMonth(month);
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1 + offset, 1)).toISOString().slice(0, 7);
}

function assertServiceDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("服务开始日期无效");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("服务开始日期无效");
}

export function coachingNaturalMonthRange(month: string, serviceStart?: string): { start: string; end: string } {
  assertMonth(month);
  if (serviceStart !== undefined) assertServiceDate(serviceStart);
  const [year, mon] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
  const firstServiceMonth = serviceStart?.slice(0, 7) === month;
  const start = firstServiceMonth && serviceStart! > `${month}-01` ? serviceStart! : `${month}-01`;
  if (start > end) throw new Error("服务开始日期不能晚于计划月份");
  return { start, end };
}

/** 首个不完整自然月与紧随其后的完整自然月；1 日开课只建立当月。 */
export function initialCoachingNaturalMonths(serviceStart: string): { month: string; start: string; end: string }[] {
  assertServiceDate(serviceStart);
  const month = serviceStart.slice(0, 7);
  const months = serviceStart.endsWith("-01") ? [month] : [month, shiftCoachingServiceMonth(month, 1)];
  return months.map((key) => ({ month: key, ...coachingNaturalMonthRange(key, serviceStart) }));
}

export function isCoachingNaturalMonthPlan(startDate: string, endDate: string, serviceStart: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return false;
  if (startDate.slice(0, 7) !== endDate.slice(0, 7)) return false;
  try {
    const expected = coachingNaturalMonthRange(startDate.slice(0, 7), serviceStart);
    return expected.start === startDate && expected.end === endDate;
  } catch {
    return false;
  }
}

/** 当月最后一个周四是计划与总结的完成期限，不禁止提前完成。 */
export function lastThursdayOfCoachingMonth(month: string): string {
  assertMonth(month);
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon, 0));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - 4 + 7) % 7));
  return date.toISOString().slice(0, 10);
}
