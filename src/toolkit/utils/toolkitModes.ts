import { Combine, ImageUp, RotateCw, Scissors } from "lucide-react";
import type { ToolkitModeDefinition } from "../types/toolkit";

export const toolkitModes: ToolkitModeDefinition[] = [
  {
    id: "merge",
    title: "Merge PDFs",
    shortLabel: "Merge",
    description: "Combine multiple PDFs into a single ordered output without leaving the local browser workflow.",
    badge: "Most requested",
    status: "Ready to use",
    icon: Combine,
    bullets: ["Drop multiple files", "Reorder before export", "Keep everything local"],
  },
  {
    id: "split",
    title: "Split PDF",
    shortLabel: "Split",
    description: "Preview each page, choose what to keep, and export a smaller PDF subset without leaving the browser.",
    badge: "Preview-first",
    status: "Ready to use",
    icon: Scissors,
    bullets: ["Visual page picking", "Range + odd/even selection", "Local selected-pages export"],
  },
  {
    id: "rotate",
    title: "Rotate Pages",
    shortLabel: "Rotate",
    description: "Correct sideways scans and upside-down pages before sending the file into the rest of the suite.",
    badge: "Useful for scans",
    status: "Ready to use",
    icon: RotateCw,
    bullets: ["Whole-document rotation", "Per-page correction", "Preview-first flow"],
  },
  {
    id: "images",
    title: "Images to PDF",
    shortLabel: "Images",
    description: "Upload images, reorder them visually, rotate anything sideways, and export one clean PDF locally.",
    badge: "Popular utility",
    status: "Ready to use",
    icon: ImageUp,
    bullets: ["Batch image import", "Visual reordering", "One image per PDF page"],
  },
];
