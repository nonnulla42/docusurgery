export type PatchAlignment = "left" | "center" | "right";
export type PatchFontFamily = "Arial" | "Helvetica" | "Times New Roman" | "Georgia";
export type PatchObjectType = "patch" | "text" | "signature";
export type PatchEditorMode = "patch" | "text" | "signature" | "select";

export interface PatchFillColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
}

export interface PatchObject {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: PatchFillColor;
}

export interface PatchTextObject {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: PatchFontFamily;
  textColor: string;
  alignment: PatchAlignment;
}

export interface PatchSignatureObject {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  aspectRatio: number;
  fileName: string;
  originalImageDataUrl: string;
  imageDataUrl: string;
  removeWhiteBackground: boolean;
  backgroundThreshold: number;
}

export interface SelectedPatchObject {
  type: PatchObjectType;
  id: string;
}

export interface PatchDocumentState {
  patches: PatchObject[];
  textObjects: PatchTextObject[];
  signatureObjects: PatchSignatureObject[];
  selectedObject: SelectedPatchObject | null;
}

export interface PatchPageMetrics {
  pageNumber: number;
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
}
