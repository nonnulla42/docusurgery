import type { LucideIcon } from "lucide-react";

export type ToolkitMode = "merge" | "split" | "rotate" | "images";

export interface ToolkitModeDefinition {
  id: ToolkitMode;
  title: string;
  shortLabel: string;
  description: string;
  badge: string;
  status: string;
  icon: LucideIcon;
  bullets: string[];
}

export interface MergePdfItem {
  id: string;
  file: File;
  pageCount: number | null;
}

export interface RotatePageItem {
  id: string;
  pageNumber: number;
  originalRotation: number;
  rotation: number;
}

export interface SplitPageItem {
  id: string;
  pageNumber: number;
  originalRotation: number;
  selected: boolean;
}

export type ImagePdfPageSize = "auto" | "a4-portrait" | "a4-landscape";
export type ImagePdfFitMode = "contain" | "cover";
export type ImagePdfMargin = "none" | "small";

export interface ImagePdfItem {
  id: string;
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  rotation: number;
}
