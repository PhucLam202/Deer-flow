export interface ReviewTreeNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  children: ReviewTreeNode[];
  size?: number | null;
  mime_type?: string | null;
}
