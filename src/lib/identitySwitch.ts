import type { QueryClient } from "@tanstack/react-query";

/** 清空上一身份的所有查询、变更和临时测评状态，并去掉学员详情等 URL 参数。 */
export async function clearIdentityScopedState(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  queryClient.removeQueries();
  queryClient.getMutationCache().clear();
  const browser = (globalThis as unknown as {
    window: {
      sessionStorage: { clear: () => void };
      history: { replaceState: (state: null, unused: string, url: string) => void };
      location: { pathname: string };
    };
  }).window;
  browser.sessionStorage.clear();
  browser.history.replaceState(null, "", browser.location.pathname);
}
