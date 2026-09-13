import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { recordings } from "@db/schema";
import { getKpIndex } from "./helpers";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式须为 YYYY-MM-DD");

export const recordingRouter = createRouter({
  /** 录音列表（按日期倒序），kpCodes 映射为知识点标题。 */
  list: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const [rows, kpIndex] = await Promise.all([
      db.select().from(recordings).where(eq(recordings.userId, userId)).orderBy(desc(recordings.recDate), desc(recordings.id)),
      getKpIndex(),
    ]);
    return rows.map((r) => ({
      ...r,
      kpTitles: r.kpCodes.map((code) => kpIndex.byCode.get(code)?.title ?? code),
    }));
  }),

  /** 新增一条课堂录音元数据。 */
  add: authedQuery
    .input(
      z.object({
        title: z.string().min(1).max(128),
        recDate: dateStr,
        kpCodes: z.array(z.string().max(32)).max(50).default([]),
        durationSec: z.number().int().min(0).optional(),
        transcript: z.string().max(100_000).optional(),
        note: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const [{ id }] = await db
        .insert(recordings)
        .values({
          userId,
          title: input.title,
          recDate: input.recDate,
          kpCodes: input.kpCodes,
          durationSec: input.durationSec ?? null,
          transcript: input.transcript ?? null,
          note: input.note ?? null,
        })
        .$returningId();
      return { id };
    }),

  /** 删除一条录音记录。 */
  remove: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    await db.delete(recordings).where(and(eq(recordings.id, input.id), eq(recordings.userId, userId)));
    return { ok: true as const };
  }),
});
