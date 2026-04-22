import { getBackendBaseURL } from "../config";

function encodePath(path: string) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function urlOfReviewFile({
  filepath,
  threadId,
  download = false,
}: {
  filepath: string;
  threadId: string;
  download?: boolean;
}) {
  return `${getBackendBaseURL()}/api/threads/${threadId}/review/file/${encodePath(filepath)}${download ? "?download=true" : ""}`;
}

export function urlOfReviewPreview({
  filepath,
  threadId,
}: {
  filepath: string;
  threadId: string;
}) {
  return `${getBackendBaseURL()}/api/threads/${threadId}/review/preview/${encodePath(filepath)}`;
}
