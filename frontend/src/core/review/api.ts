import { getBackendBaseURL } from "../config";
import type { ReviewTreeNode } from "./types";
import { urlOfReviewFile } from "./utils";

export async function loadReviewTree(threadId: string) {
  const response = await fetch(
    `${getBackendBaseURL()}/api/threads/${threadId}/review/tree`,
  );
  if (!response.ok) {
    throw new Error(`Failed to load review tree (${response.status})`);
  }
  return (await response.json()) as ReviewTreeNode;
}

export async function loadReviewFileContent({
  filepath,
  threadId,
}: {
  filepath: string;
  threadId: string;
}) {
  const url = urlOfReviewFile({ filepath, threadId });
  const response = await fetch(url);
  const text = await response.text();
  return { content: text, url };
}
