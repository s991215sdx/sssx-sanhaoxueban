/**
 * 家庭码（v238）：一个孩子一张码，爸爸、妈妈扫同一个码，答卷都落到这个孩子名下。
 *
 * 为什么是「码」而不是「家长账号 + 绑定」：
 * 家长多数不在系统里，也不会为一页问卷去注册；家长卷的结果本来就是孩子档案的一部分
 * （报告给孩子与伴学师看），所以码只要回答「这份问卷是哪个孩子的」就够了。
 * 填卷人（爸爸 / 妈妈 / 其他）走 answers.respondent，不靠账号区分。
 *
 * 码是「算出来的」而不是「存下来的」：孩子编号 + 版本 + 签名，签名用应用密钥派生
 * （见 api/familyCode.ts）。这样不必为它建一张表——老库上建表会被数据目录权限卡住，
 * 而一张码本来也不需要独立存储。版本号存在学生档案里，「换码」就是把版本加一，
 * 旧码立刻对不上，历史答卷一条不动。
 */

/** 签名用的字母表：与邀请码一致，剔除 0/o、1/l/i 这类易混字符。 */
export const FAMILY_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** 签名长度（位数）。6 位约 1e9 种，试不出来。 */
export const FAMILY_CODE_SIG_LEN = 6;

/**
 * 合法码形状：`<孩子编号>-<版本>-<签名>`，如 `i-0-2w3rqe`。
 * 编号最长 12 位（36 进制的 12 位远超 int），版本 1—3 位，签名固定 6 位。
 * 只允许小写字母数字与短横线——扫码链接里可能带大小写/空白，先归一化再校验。
 */
export const FAMILY_CODE_RE = /^[a-z0-9]{1,12}-[a-z0-9]{1,3}-[a-z0-9]{6}$/;

/** 归一化：去空白、转小写、去掉粘贴时混进来的全角横线。手输时大小写不该成为障碍。 */
export function normalizeFamilyCode(raw: string): string {
  return (raw ?? "").trim().toLowerCase().replace(/[—–－]/g, "-");
}

/** 家长扫码 / 点链接进入的路径。 */
export function familyJoinPath(code: string): string {
  return `/f/${normalizeFamilyCode(code)}`;
}

/** 家长端可见的孩子称谓：只给「姓氏 + 同学」，不露全名（码可能被转发）。 */
export function familyChildAlias(name: string): string {
  const n = (name ?? "").trim();
  if (!n) return "孩子";
  /* 复姓（欧阳、司马…）取两字；其余取首字。都用「X同学」，让家长一眼确认是不是自家孩子。 */
  const compound = ["欧阳", "司马", "上官", "诸葛", "东方", "皇甫", "尉迟", "公孙", "慕容", "长孙"];
  const head = compound.some((c) => n.startsWith(c)) ? n.slice(0, 2) : n.slice(0, 1);
  return `${head}同学`;
}

/**
 * 同一位家长重填只留最新一份。
 *
 * 传入的行必须已按时间倒序：妈妈改一遍答案不该变成「两位家长」，
 * 报告里的盲区对照也不能拿她上一次的旧答案。两个调用点（家长卷计数、
 * 报告聚合）共用这一条口径，免得一处去重一处不去重。
 */
export function latestPerRespondent<T extends { respondent: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.respondent)) continue;
    seen.add(r.respondent);
    out.push(r);
  }
  return out;
}
