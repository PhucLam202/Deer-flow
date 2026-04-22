"use client";

import { ChevronRightIcon, FolderIcon, FileIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ReviewTreeNode } from "@/core/review/types";

function sortNodes(nodes: ReviewTreeNode[]) {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function ReviewTree({
  node,
  selectedPath,
  onSelect,
}: {
  node: ReviewTreeNode | null;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  if (!node) return null;
  return (
    <div className="space-y-1">
      {sortNodes(node.children).map((child) => (
        <ReviewTreeItem
          key={child.path || child.name}
          node={child}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ReviewTreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: ReviewTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isSelected = node.path === selectedPath;
  const paddingLeft = useMemo(() => `${depth * 14 + 8}px`, [depth]);
  const children = useMemo(() => sortNodes(node.children ?? []), [node.children]);

  return (
    <div>
      <Button
        variant="ghost"
        className={cn(
          "h-9 w-full justify-start gap-2 rounded-md px-2 text-left",
          isSelected && "bg-accent text-accent-foreground",
        )}
        style={{ paddingLeft }}
        onClick={() => {
          if (node.kind === "directory") {
            setOpen((value) => !value);
          } else {
            onSelect(node.path);
          }
        }}
      >
        {node.kind === "directory" ? (
          <ChevronRightIcon className={cn("size-4 shrink-0 transition-transform", open && "rotate-90")} />
        ) : (
          <span className="size-4 shrink-0" />
        )}
        {node.kind === "directory" ? (
          <FolderIcon className="size-4 shrink-0 text-amber-500" />
        ) : (
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 truncate">{node.name}</span>
      </Button>
      {node.kind === "directory" && open && children.length > 0 && (
        <div className="ml-2 border-l pl-2">
          {children.map((child) => (
            <ReviewTreeItem
              key={child.path || child.name}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
