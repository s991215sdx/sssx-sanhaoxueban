import { desc, eq } from "drizzle-orm";
import { inviteChannels, inviteRegistrations, studentProfile } from "@db/schema";
import { normalizeCampusReportKinds } from "@contracts/campusReports";
import type { getDb } from "./queries/connection";

type Db = ReturnType<typeof getDb>;

/** 最新注册渠道决定身份；非校园返回 null，校园（包括历史 NULL）返回真实授权数组。 */
export async function getCampusReportKinds(db: Db, userId: number): Promise<string[] | null> {
  const [row] = await db
    .select({ campus: inviteChannels.campus, kinds: studentProfile.campusReportKinds })
    .from(inviteRegistrations)
    .innerJoin(inviteChannels, eq(inviteChannels.id, inviteRegistrations.channelId))
    .leftJoin(studentProfile, eq(studentProfile.userId, inviteRegistrations.userId))
    .where(eq(inviteRegistrations.userId, userId))
    .orderBy(desc(inviteRegistrations.id))
    .limit(1);
  return row?.campus ? normalizeCampusReportKinds(row.kinds) : null;
}
