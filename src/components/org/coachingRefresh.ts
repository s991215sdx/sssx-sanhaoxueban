import type { trpc } from "@/providers/trpc";

type CoachingUtils = ReturnType<typeof trpc.useUtils>;

/** 业务动作办结后同步失效运营视图，避免主档已更新而待办、负荷和通知仍是旧数据。 */
export async function invalidateCoachingOperations(utils: CoachingUtils) {
  await Promise.all([
    utils.coaching.operations.invalidate(),
    utils.coaching.staffWorkloads.invalidate(),
    utils.coaching.notifications.invalidate(),
  ]);
}
