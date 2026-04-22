"use client";

import { useQuery } from "@tanstack/react-query";

import { loadReviewFileContent, loadReviewTree } from "./api";

export function useReviewTree(threadId: string) {
  return useQuery({
    queryKey: ["review-tree", threadId],
    queryFn: () => loadReviewTree(threadId),
  });
}

export function useReviewFileContent({
  filepath,
  threadId,
  enabled,
}: {
  filepath: string;
  threadId: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["review-file", filepath, threadId],
    queryFn: () => loadReviewFileContent({ filepath, threadId }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
