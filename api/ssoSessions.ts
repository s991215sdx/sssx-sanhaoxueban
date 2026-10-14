/**
 * v158：一体通 SSO 短会话的内存存储（单进程 Node 服务内共享；服务重启即全部失效，
 * 比落库更安全——短会话本来就不该活得比进程久）。
 * ticket 兑换成功时创建，10 分钟有效；仅能读取绑定的那个学员的详情（ssoRouter 校验）。
 */
import { randomBytes } from "node:crypto";
import { SsoSession } from "@contracts/constants";

type Entry = { studentId: number; name: string; exp: number };

const store = new Map<string, Entry>();

function sweep() {
  const now = Date.now();
  for (const [k, v] of store) if (v.exp < now) store.delete(k);
}

export function createSsoSession(studentId: number, name: string): string {
  const token = randomBytes(32).toString("hex");
  store.set(token, { studentId, name, exp: Date.now() + SsoSession.maxAgeMs });
  if (store.size > 10000) sweep();
  return token;
}

/** 校验并返回会话（过期即删）。 */
export function verifySsoSession(token: string): { studentId: number; name: string } | null {
  const e = store.get(token);
  if (!e) return null;
  if (e.exp < Date.now()) {
    store.delete(token);
    return null;
  }
  return { studentId: e.studentId, name: e.name };
}
