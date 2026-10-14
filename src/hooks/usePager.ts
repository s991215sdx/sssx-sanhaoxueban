/**
 * v160：客户端分页 hook——对已加载的数组做切片分页（列表数据量可控，避免改后端契约）。
 * resetKey 变化（如搜索词更新）时自动回到第 1 页。
 */
import { useEffect, useMemo, useState } from "react";

export const PAGER_PAGE_SIZE = 20;

export function usePager<T>(items: T[], pageSize = PAGER_PAGE_SIZE, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
    // resetKey 变化（搜索词/筛选变化）时重置到第一页
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );
  return { page: safePage, setPage, totalPages, total, pageItems };
}
