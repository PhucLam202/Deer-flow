"use client";

import { useMemo, useState } from "react";

import { ReviewFileDetail } from "@/components/workspace/review-file-detail";
import { ReviewTree } from "@/components/workspace/review-tree";
import { Button } from "@/components/ui/button";
import { useThreadStream } from "@/core/threads/hooks";
import { useReviewTree } from "@/core/review/hooks";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { ThreadContext } from "@/components/workspace/messages/context";
import { useSpecificChatMode, useThreadChat } from "@/components/workspace/chats";
import { useThreadSettings } from "@/core/settings";
import { useI18n } from "@/core/i18n/hooks";

export default function ReviewPage() {
  const { threadId, isNewThread, isMock } = useThreadChat();
  const [settings] = useThreadSettings(threadId);
  useSpecificChatMode();
  const { t } = useI18n();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { data: tree, isLoading, error } = useReviewTree(threadId);

  const [thread] = useThreadStream({
    threadId: isNewThread ? undefined : threadId,
    context: settings.context,
    isMock,
  });

  const selected = useMemo(() => selectedPath, [selectedPath]);
  return (
    <ThreadContext.Provider value={{ thread, isMock }}>
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex h-12 items-center gap-3 border-b px-4">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/workspace/chats/${threadId}`}>
              <ArrowLeftIcon className="size-4" />
              Back to chat
            </Link>
          </Button>
          <div className="text-sm font-medium">Review mode</div>
          <div className="text-muted-foreground text-xs">
            {t.common.artifacts}
          </div>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="min-h-0 border-r p-3">
            {isLoading && <div className="text-muted-foreground text-sm">Loading tree…</div>}
            {error && <div className="text-destructive text-sm">Failed to load review tree</div>}
            {!isLoading && !error && <ReviewTree node={tree ?? null} selectedPath={selected} onSelect={setSelectedPath} />}
          </aside>
          <main className="min-h-0">
            {selected ? (
              <ReviewFileDetail
                className="size-full"
                filepath={selected}
                threadId={threadId}
                onClose={() => setSelectedPath(null)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Select a file to inspect it.
              </div>
            )}
          </main>
        </div>
      </div>
    </ThreadContext.Provider>
  );
}
