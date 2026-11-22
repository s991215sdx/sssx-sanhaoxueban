import { eq } from "drizzle-orm";
import { assessmentActivities, assessmentActivityItems, assessmentAssignments } from "@db/schema";
import type { getDb } from "./queries/connection";
import type { PointTx } from "./orgPoints";

type Db = ReturnType<typeof getDb> | PointTx;

/** 由逐生任务推导活动状态；取消项不阻塞其他学员完成，过期与全部完成严格区分。 */
export async function syncAssessmentActivityStatus(db: Db, activityId: number) {
  const rows = await db.select({ status: assessmentAssignments.status }).from(assessmentAssignments)
    .innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
    .where(eq(assessmentActivityItems.activityId, activityId));
  if (!rows.length) return null;
  const effective = rows.filter((row) => row.status !== "cancelled");
  const status = !effective.length ? "cancelled"
    : effective.some((row) => ["pending", "in_progress"].includes(row.status)) ? "open"
      : effective.every((row) => row.status === "completed") ? "completed" : "expired";
  await db.update(assessmentActivities).set({ status }).where(eq(assessmentActivities.id, activityId));
  return status;
}
