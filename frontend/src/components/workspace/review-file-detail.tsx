import {
  Code2Icon,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  RefreshCwIcon,
  SquareArrowOutUpRightIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactContent,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CodeEditor } from "@/components/workspace/code-editor";
import { useI18n } from "@/core/i18n/hooks";
import { useReviewFileContent } from "@/core/review/hooks";
import { urlOfReviewFile, urlOfReviewPreview } from "@/core/review/utils";
import { checkCodeFile, getFileName } from "@/core/utils/files";
import { cn } from "@/lib/utils";

import { ArtifactFilePreview } from "./artifacts";

export function ReviewFileDetail({
  className,
  filepath,
  threadId,
  onClose,
}: {
  className?: string;
  filepath: string;
  threadId: string;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const { isCodeFile, language } = useMemo(() => checkCodeFile(filepath), [filepath]);
  const isSupportPreview = useMemo(() => language === "html" || language === "markdown", [language]);
  const { data } = useReviewFileContent({
    threadId,
    filepath,
    enabled: isCodeFile,
  });
  const content = data?.content ?? "";
  const [viewMode, setViewMode] = useState<"code" | "preview">("code");
  const [previewNonce, setPreviewNonce] = useState(0);
  useEffect(() => {
    setViewMode(isSupportPreview ? "preview" : "code");
  }, [isSupportPreview]);

  useEffect(() => {
    setPreviewNonce(0);
  }, [filepath]);

  const previewUrl = useMemo(() => {
    if (!(isSupportPreview && language === "html")) return null;
    const url = new URL(urlOfReviewPreview({ filepath, threadId }));
    url.searchParams.set("v", String(previewNonce));
    return url.toString();
  }, [filepath, threadId, isSupportPreview, language, previewNonce]);

  const openInNewWindow = useCallback(() => {
    const w = window.open(
      isSupportPreview && language === "html"
        ? previewUrl ?? urlOfReviewPreview({ filepath, threadId })
        : urlOfReviewFile({ filepath, threadId }),
      "_blank",
      "noopener,noreferrer",
    );
    if (w) w.opener = null;
  }, [filepath, threadId, isSupportPreview, language, previewUrl]);

  return (
    <Artifact className={cn(className)}>
      <ArtifactHeader className="px-2">
        <div className="flex items-center gap-2">
          <ArtifactTitle>
            <div className="px-2">{getFileName(filepath)}</div>
          </ArtifactTitle>
        </div>
        <div className="flex min-w-0 grow items-center justify-center">
          {isSupportPreview && (
            <ToggleGroup
              className="mx-auto"
              type="single"
              variant="outline"
              size="sm"
              value={viewMode}
              onValueChange={(value) => {
                if (value) setViewMode(value as "code" | "preview");
              }}
            >
              <ToggleGroupItem value="code">
                <Code2Icon />
              </ToggleGroupItem>
              <ToggleGroupItem value="preview">
                <EyeIcon />
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ArtifactActions>
            {isSupportPreview && language === "html" && (
              <ArtifactAction
                icon={RefreshCwIcon}
                label="Reload preview"
                tooltip="Reload preview"
                onClick={() => setPreviewNonce((value) => value + 1)}
              />
            )}
            <ArtifactAction
              icon={SquareArrowOutUpRightIcon}
              label={t.common.openInNewWindow}
              tooltip={t.common.openInNewWindow}
              onClick={openInNewWindow}
            />
            <ArtifactAction
              icon={CopyIcon}
              label={t.clipboard.copyToClipboard}
              disabled={!content}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(content);
                  toast.success(t.clipboard.copiedToClipboard);
                } catch (error) {
                  toast.error("Failed to copy to clipboard");
                  console.error(error);
                }
              }}
              tooltip={t.clipboard.copyToClipboard}
            />
            <ArtifactAction
              icon={DownloadIcon}
              label={t.common.download}
              tooltip={t.common.download}
              onClick={() => {
                const w = window.open(
                  urlOfReviewFile({ filepath, threadId, download: true }),
                  "_blank",
                  "noopener,noreferrer",
                );
                if (w) w.opener = null;
              }}
            />
            <ArtifactAction
              icon={XIcon}
              label={t.common.close}
              onClick={onClose ?? (() => undefined)}
              tooltip={t.common.close}
            />
          </ArtifactActions>
        </div>
      </ArtifactHeader>
      <ArtifactContent className="p-0">
        {isSupportPreview && viewMode === "preview" && (language === "markdown" || language === "html") && (
          language === "markdown" ? (
            <ArtifactFilePreview content={content} language={language ?? "text"} />
          ) : (
            <iframe
              className="size-full"
              key={previewUrl ?? filepath}
              src={previewUrl ?? undefined}
              sandbox="allow-same-origin allow-scripts allow-forms"
              title="Review preview"
            />
          )
        )}
        {isCodeFile && viewMode === "code" && (
          <CodeEditor className="size-full resize-none rounded-none border-none" value={content} readonly />
        )}
        {!isCodeFile && (
          <iframe className="size-full" src={urlOfReviewFile({ filepath, threadId })} />
        )}
      </ArtifactContent>
    </Artifact>
  );
}
