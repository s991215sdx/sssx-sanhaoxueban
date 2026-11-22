import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { clearAssessmentAssignment, prepareAssessmentSubmission } from "@/lib/assessmentSubmission";
import { clearIdentityScopedState } from "@/lib/identitySwitch";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();

/** 身份切换必须先清除上一机构的数据与在途请求，再刷新会话和页面。 */
export const prepareIdentitySwitch = () => clearIdentityScopedState(queryClient);
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const url = String(input);
        const prepared = prepareAssessmentSubmission(url, init);
        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          body: prepared.body,
          credentials: "include",
        });
        if (response.ok && prepared.assignmentId != null) {
          try {
            const body = JSON.parse(init?.body as string) as Record<string, { json?: { kind?: string; input?: { kind?: string } } }>;
            for (const value of Object.values(body)) {
              const kind = value.json?.kind ?? value.json?.input?.kind;
              if (kind) clearAssessmentAssignment(kind);
            }
          } catch { /* 下一次开始任务会重新写入标识 */ }
        }
        return response;
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
