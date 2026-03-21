import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Eraser,
  ImagePlus,
  Minus,
  Move,
  Plus,
  Redo2,
  RotateCcw,
  SquareDashedMousePointer,
  Type,
  Undo2,
  Upload,
} from "lucide-react";
import { PatchCanvas } from "../components/PatchCanvas";
import type {
  PatchDocumentState,
  PatchEditorMode,
  PatchFontFamily,
  PatchObject,
  PatchPageMetrics,
  PatchSignatureObject,
  PatchTextObject,
} from "../types/patch";
import { hexToRgb } from "../utils/colorSampling";
import { exportPatchedPdf } from "../utils/pdfExport";
import { processSignatureImage } from "../utils/signatureProcessing";
import { usePageSeo } from "../../shared/usePageSeo";

const DEFAULT_STATE: PatchDocumentState = {
  patches: [],
  textObjects: [],
  signatureObjects: [],
  selectedObject: null,
};

const FONT_OPTIONS: PatchFontFamily[] = ["Arial", "Helvetica", "Times New Roman", "Georgia"];

function createId(prefix: "patch" | "text" | "signature") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneState(state: PatchDocumentState): PatchDocumentState {
  return {
    selectedObject: state.selectedObject ? { ...state.selectedObject } : null,
    patches: state.patches.map((patch) => ({
      ...patch,
      fill: {
        hex: patch.fill.hex,
        rgb: { ...patch.fill.rgb },
      },
    })),
    textObjects: state.textObjects.map((textObject) => ({ ...textObject })),
    signatureObjects: state.signatureObjects.map((signatureObject) => ({ ...signatureObject })),
  };
}

function getPageAspectRatio(metrics: PatchPageMetrics | null) {
  if (!metrics?.naturalWidth || !metrics?.naturalHeight) {
    return 1;
  }

  return metrics.naturalWidth / metrics.naturalHeight;
}

function getNormalizedSignatureHeight(width: number, aspectRatio: number, metrics: PatchPageMetrics | null) {
  const pageAspectRatio = getPageAspectRatio(metrics);
  return (width * pageAspectRatio) / Math.max(aspectRatio, 0.01);
}

export function PatchEditorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.15);
  const [pageMetrics, setPageMetrics] = useState<PatchPageMetrics | null>(null);
  const [mode, setMode] = useState<PatchEditorMode>("select");
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [present, setPresent] = useState<PatchDocumentState>(DEFAULT_STATE);
  const [undoStack, setUndoStack] = useState<PatchDocumentState[]>([]);
  const [redoStack, setRedoStack] = useState<PatchDocumentState[]>([]);
  const [fileResetToken, setFileResetToken] = useState(0);
  const [autoFitDone, setAutoFitDone] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hoveredObject, setHoveredObject] = useState<PatchDocumentState["selectedObject"]>(null);
  const interactionBaselineRef = useRef<PatchDocumentState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const replaceSignatureInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const selectedObject = present.selectedObject;
  const selectedPatch = selectedObject?.type === "patch"
    ? present.patches.find((patch) => patch.id === selectedObject.id) ?? null
    : null;
  const selectedTextObject = selectedObject?.type === "text"
    ? present.textObjects.find((textObject) => textObject.id === selectedObject.id) ?? null
    : null;
  const selectedSignatureObject = selectedObject?.type === "signature"
    ? present.signatureObjects.find((signatureObject) => signatureObject.id === selectedObject.id) ?? null
    : null;

  const currentPageObjects = [
    ...present.patches
      .filter((patch) => patch.pageNumber === currentPage)
      .map((patch) => ({ type: "patch" as const, id: patch.id, label: "Patch", detail: `${Math.round(patch.width * 100)}% x ${Math.round(patch.height * 100)}%` })),
    ...present.textObjects
      .filter((textObject) => textObject.pageNumber === currentPage)
      .map((textObject) => ({
        type: "text" as const,
        id: textObject.id,
        label: "Text",
        detail: textObject.text.trim() ? textObject.text.trim().slice(0, 30) : "Empty label",
      })),
    ...present.signatureObjects
      .filter((signatureObject) => signatureObject.pageNumber === currentPage)
      .map((signatureObject) => ({
        type: "signature" as const,
        id: signatureObject.id,
        label: "Signature",
        detail: signatureObject.fileName,
      })),
  ];

  const commitState = (nextState: PatchDocumentState) => {
    setUndoStack((history) => [...history, cloneState(present)]);
    setRedoStack([]);
    setPresent(nextState);
  };

  const resetWorkspaceForFile = (nextFile: File | null) => {
    setFile(nextFile);
    setCurrentPage(1);
    setNumPages(0);
    setZoom(1.15);
    setError(null);
    setPresent(DEFAULT_STATE);
    setUndoStack([]);
    setRedoStack([]);
    setMode("select");
    setPageMetrics(null);
    setAutoFitDone(false);
    interactionBaselineRef.current = null;
    setFileResetToken((value) => value + 1);
  };

  const loadPdfFile = (nextFile: File | null) => {
    if (!nextFile) {
      return;
    }

    if (nextFile.type !== "application/pdf") {
      setError("Patch Editor currently supports PDF files only.");
      return;
    }

    resetWorkspaceForFile(nextFile);
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    loadPdfFile(event.target.files?.[0] ?? null);
  };

  const handleCreatePatch = (patch: Omit<PatchObject, "id">) => {
    const nextPatch: PatchObject = { ...patch, id: createId("patch") };
    commitState({
      patches: [...present.patches, nextPatch],
      textObjects: present.textObjects,
      signatureObjects: present.signatureObjects,
      selectedObject: { type: "patch", id: nextPatch.id },
    });
    setMode("select");
  };

  const handleCreateText = (textObject: Omit<PatchTextObject, "id">) => {
    const nextTextObject: PatchTextObject = { ...textObject, id: createId("text") };
    commitState({
      patches: present.patches,
      textObjects: [...present.textObjects, nextTextObject],
      signatureObjects: present.signatureObjects,
      selectedObject: { type: "text", id: nextTextObject.id },
    });
    setMode("select");
  };

  const handleCreateSignature = (signatureObject: Omit<PatchSignatureObject, "id">) => {
    const nextSignatureObject: PatchSignatureObject = { ...signatureObject, id: createId("signature") };
    commitState({
      patches: present.patches,
      textObjects: present.textObjects,
      signatureObjects: [...present.signatureObjects, nextSignatureObject],
      selectedObject: { type: "signature", id: nextSignatureObject.id },
    });
    setMode("select");
  };

  const handlePatchChange = (patchId: string, updates: Partial<PatchObject>, commit = false) => {
    if (commit) {
      if (interactionBaselineRef.current) {
        const baseline = interactionBaselineRef.current;
        interactionBaselineRef.current = null;
        setUndoStack((history) => [...history, baseline]);
        setRedoStack([]);
        setPresent((current) => ({
          ...current,
          patches: current.patches.map((patch) => (patch.id === patchId ? { ...patch, ...updates } : patch)),
        }));
      } else {
        commitState({
          ...present,
          patches: present.patches.map((patch) => (patch.id === patchId ? { ...patch, ...updates } : patch)),
        });
      }
      return;
    }

    if (!interactionBaselineRef.current) {
      interactionBaselineRef.current = cloneState(present);
    }

    setPresent((current) => ({
      ...current,
      patches: current.patches.map((patch) => (patch.id === patchId ? { ...patch, ...updates } : patch)),
    }));
  };

  const handleTextChange = (textId: string, updates: Partial<PatchTextObject>, commit = false) => {
    if (commit) {
      if (interactionBaselineRef.current) {
        const baseline = interactionBaselineRef.current;
        interactionBaselineRef.current = null;
        setUndoStack((history) => [...history, baseline]);
        setRedoStack([]);
        setPresent((current) => ({
          ...current,
          textObjects: current.textObjects.map((textObject) => (textObject.id === textId ? { ...textObject, ...updates } : textObject)),
        }));
      } else {
        commitState({
          ...present,
          textObjects: present.textObjects.map((textObject) => (textObject.id === textId ? { ...textObject, ...updates } : textObject)),
        });
      }
      return;
    }

    if (!interactionBaselineRef.current) {
      interactionBaselineRef.current = cloneState(present);
    }

    setPresent((current) => ({
      ...current,
      textObjects: current.textObjects.map((textObject) => (textObject.id === textId ? { ...textObject, ...updates } : textObject)),
    }));
  };

  const handleSignatureChange = (signatureId: string, updates: Partial<PatchSignatureObject>, commit = false) => {
    if (commit) {
      if (interactionBaselineRef.current) {
        const baseline = interactionBaselineRef.current;
        interactionBaselineRef.current = null;
        setUndoStack((history) => [...history, baseline]);
        setRedoStack([]);
        setPresent((current) => ({
          ...current,
          signatureObjects: current.signatureObjects.map((signatureObject) => (signatureObject.id === signatureId ? { ...signatureObject, ...updates } : signatureObject)),
        }));
      } else {
        commitState({
          ...present,
          signatureObjects: present.signatureObjects.map((signatureObject) => (signatureObject.id === signatureId ? { ...signatureObject, ...updates } : signatureObject)),
        });
      }
      return;
    }

    if (!interactionBaselineRef.current) {
      interactionBaselineRef.current = cloneState(present);
    }

    setPresent((current) => ({
      ...current,
      signatureObjects: current.signatureObjects.map((signatureObject) => (signatureObject.id === signatureId ? { ...signatureObject, ...updates } : signatureObject)),
    }));
  };

  const deleteSelectedObject = () => {
    if (!selectedObject) {
      return;
    }

    commitState({
      patches: selectedObject.type === "patch" ? present.patches.filter((patch) => patch.id !== selectedObject.id) : present.patches,
      textObjects: selectedObject.type === "text" ? present.textObjects.filter((textObject) => textObject.id !== selectedObject.id) : present.textObjects,
      signatureObjects: selectedObject.type === "signature" ? present.signatureObjects.filter((signatureObject) => signatureObject.id !== selectedObject.id) : present.signatureObjects,
      selectedObject: null,
    });
  };

  const undo = () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) {
      return;
    }

    setRedoStack((history) => [...history, cloneState(present)]);
    setPresent(previous);
    setUndoStack((history) => history.slice(0, -1));
    interactionBaselineRef.current = null;
  };

  const redo = () => {
    const next = redoStack[redoStack.length - 1];
    if (!next) {
      return;
    }

    setUndoStack((history) => [...history, cloneState(present)]);
    setPresent(next);
    setRedoStack((history) => history.slice(0, -1));
    interactionBaselineRef.current = null;
  };

  const fitToWidth = () => {
    if (!pageMetrics?.naturalWidth || !viewportRef.current) {
      return;
    }

    const availableWidth = Math.max(240, viewportRef.current.clientWidth - 56);
    const nextZoom = availableWidth / pageMetrics.naturalWidth;
    setZoom(Math.max(0.5, Math.min(2.75, nextZoom)));
    setAutoFitDone(true);
  };

  useEffect(() => {
    if (file && pageMetrics?.naturalWidth && !autoFitDone) {
      fitToWidth();
    }
  }, [file, pageMetrics?.naturalWidth, autoFitDone]);

  useEffect(() => {
    const previousTitle = document.title;
    const nextTitle = file
      ? `Visual PDF Fixer – ${file.name} | Docusurgery`
      : "Visual PDF Fixer – Cover Text, Insert Signatures, Clean Scans | Docusurgery";
    document.title = nextTitle;

    const metaName = "description";
    const existing = document.head.querySelector(`meta[name="${metaName}"]`);
    const meta = existing ?? document.createElement("meta");
    const previousContent = existing?.getAttribute("content") ?? null;
    const nextDescription = "Edit PDFs visually in your browser. Cover printed text, insert signature images, remove white scan backgrounds, and export corrected documents locally. Visual signatures do not guarantee legal validity.";

    meta.setAttribute("name", metaName);
    meta.setAttribute("content", nextDescription);
    if (!existing) {
      document.head.appendChild(meta);
    }

    return () => {
      document.title = previousTitle;
      if (existing) {
        if (previousContent !== null) {
          existing.setAttribute("content", previousContent);
        }
      } else {
        meta.remove();
      }
    };
  }, [file]);

  usePageSeo({
    title: file ? `Visual PDF Fixer Workspace - ${file.name} | Docusurgery` : "Visual PDF Fixer Workspace | Docusurgery",
    description: "Edit PDFs visually in your browser. Cover printed text, add corrected text, insert signature images, remove white scan backgrounds, and export corrected documents locally.",
    path: "/patch/app",
  });

  const exportPdf = async () => {
    if (!file) {
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const bytes = await exportPatchedPdf(file, present.patches, present.textObjects, present.signatureObjects);
      const outputBytes = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
      const blob = new Blob([outputBytes.buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.pdf$/i, "") + "-patched.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      console.error(exportError);
      setError("Export failed. Please try again with a different PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const updateSelectedPatch = (updates: Partial<PatchObject>) => {
    if (selectedPatch) {
      handlePatchChange(selectedPatch.id, updates, true);
    }
  };

  const updateSelectedText = (updates: Partial<PatchTextObject>) => {
    if (selectedTextObject) {
      handleTextChange(selectedTextObject.id, updates, true);
    }
  };

  const updateSelectedSignature = (updates: Partial<PatchSignatureObject>) => {
    if (selectedSignatureObject) {
      handleSignatureChange(selectedSignatureObject.id, updates, true);
    }
  };

  const createSignatureFromFile = (imageFile: File) => {
    if (!file) {
      return;
    }

    if (imageFile.type !== "image/png") {
      setError("Signature import currently supports PNG files only.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!imageDataUrl) {
        setError("The signature image could not be read.");
        return;
      }

      const image = new Image();
      image.onload = () => {
        const aspectRatio = image.width > 0 && image.height > 0 ? image.width / image.height : 3;
        const width = 0.2;
        const height = getNormalizedSignatureHeight(width, aspectRatio, pageMetrics);
        handleCreateSignature({
          pageNumber: currentPage,
          x: 0.5 - width / 2,
          y: 0.2,
          width,
          height,
          opacity: 1,
          aspectRatio,
          fileName: imageFile.name,
          originalImageDataUrl: imageDataUrl,
          imageDataUrl,
          removeWhiteBackground: false,
          backgroundThreshold: 24,
        });
      };
      image.onerror = () => {
        setError("The signature image could not be decoded.");
      };
      image.src = imageDataUrl;
    };
    reader.onerror = () => {
      setError("The signature image could not be read.");
    };
    reader.readAsDataURL(imageFile);
  };

  const handleSignatureUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const imageFile = event.target.files?.[0];
    if (imageFile) {
      createSignatureFromFile(imageFile);
    } else {
      setMode("select");
    }
    event.target.value = "";
  };

  const handleSignatureReplace = (event: ChangeEvent<HTMLInputElement>) => {
    const imageFile = event.target.files?.[0];
    if (!imageFile || !selectedSignatureObject) {
      event.target.value = "";
      return;
    }

    if (imageFile.type !== "image/png") {
      setError("Signature replacement currently supports PNG files only.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!imageDataUrl) {
        setError("The replacement signature could not be read.");
        return;
      }

      const image = new Image();
      image.onload = () => {
        const aspectRatio = image.width > 0 && image.height > 0 ? image.width / image.height : selectedSignatureObject.aspectRatio;
        const nextHeight = getNormalizedSignatureHeight(selectedSignatureObject.width, aspectRatio, pageMetrics);
        const removeWhiteBackground = selectedSignatureObject.removeWhiteBackground;
        const backgroundThreshold = selectedSignatureObject.backgroundThreshold;

        void processSignatureImage(imageDataUrl, removeWhiteBackground, backgroundThreshold)
          .then((processedImageDataUrl) => {
            updateSelectedSignature({
              originalImageDataUrl: imageDataUrl,
              imageDataUrl: processedImageDataUrl,
              fileName: imageFile.name,
              aspectRatio,
              height: nextHeight,
            });
          })
          .catch((processingError) => {
            console.error(processingError);
            setError("The replacement signature could not be processed.");
          });
      };
      image.onerror = () => setError("The replacement signature could not be decoded.");
      image.src = imageDataUrl;
    };
    reader.onerror = () => setError("The replacement signature could not be read.");
    reader.readAsDataURL(imageFile);
    event.target.value = "";
  };

  const updateSignatureBackgroundCleanup = async (
    signatureObject: PatchSignatureObject,
    updates: Partial<Pick<PatchSignatureObject, "removeWhiteBackground" | "backgroundThreshold">>,
  ) => {
    const removeWhiteBackground = updates.removeWhiteBackground ?? signatureObject.removeWhiteBackground;
    const backgroundThreshold = updates.backgroundThreshold ?? signatureObject.backgroundThreshold;

    try {
      const processedImageDataUrl = await processSignatureImage(
        signatureObject.originalImageDataUrl,
        removeWhiteBackground,
        backgroundThreshold,
      );

      updateSelectedSignature({
        removeWhiteBackground,
        backgroundThreshold,
        imageDataUrl: processedImageDataUrl,
      });
    } catch (processingError) {
      console.error(processingError);
      setError("The signature background could not be processed.");
    }
  };

  const renderInlineEditor = (object: typeof currentPageObjects[number]) => {
    const isSelected = selectedObject?.type === object.type && selectedObject.id === object.id;
    if (!isSelected) {
      return null;
    }

    if (object.type === "patch" && selectedPatch) {
      return (
        <div className="patch-inline-editor">
          <div className="patch-object-badge">Patch</div>
          <label className="patch-field">
            <span>Patch fill color</span>
            <div className="patch-color-control">
              <input
                type="color"
                value={selectedPatch.fill.hex}
                onChange={(event) => updateSelectedPatch({
                  fill: {
                    hex: event.target.value,
                    rgb: hexToRgb(event.target.value),
                  },
                })}
              />
              <code>{selectedPatch.fill.hex}</code>
            </div>
          </label>
          <p className="patch-muted-note">
            New patches start from an automatically sampled background color, then you can override the fill manually if needed.
          </p>
          <div className="patch-color-row">
            <button type="button" className="patch-link-button" onClick={deleteSelectedObject}>
              <Eraser size={14} />
              Delete patch
            </button>
          </div>
        </div>
      );
    }

    if (object.type === "text" && selectedTextObject) {
      return (
        <div className="patch-inline-editor">
          <div className="patch-object-badge patch-object-badge-text">Text</div>
          <label className="patch-field">
            <span>Text content</span>
            <textarea value={selectedTextObject.text} rows={5} onChange={(event) => updateSelectedText({ text: event.target.value })} />
          </label>
          <div className="patch-field-grid">
            <label className="patch-field">
              <span>Font size</span>
              <input
                type="number"
                min={6}
                max={72}
                value={selectedTextObject.fontSize}
                onChange={(event) => updateSelectedText({ fontSize: Number(event.target.value) || 12 })}
              />
            </label>
            <label className="patch-field">
              <span>Font family</span>
              <select value={selectedTextObject.fontFamily} onChange={(event) => updateSelectedText({ fontFamily: event.target.value as PatchFontFamily })}>
                {FONT_OPTIONS.map((fontFamily) => (
                  <option key={fontFamily} value={fontFamily}>{fontFamily}</option>
                ))}
              </select>
            </label>
            <label className="patch-field">
              <span>Alignment</span>
              <select value={selectedTextObject.alignment} onChange={(event) => updateSelectedText({ alignment: event.target.value as PatchTextObject["alignment"] })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <label className="patch-field">
            <span>Text color</span>
            <div className="patch-color-control">
              <input type="color" value={selectedTextObject.textColor} onChange={(event) => updateSelectedText({ textColor: event.target.value })} />
              <code>{selectedTextObject.textColor}</code>
            </div>
          </label>
          <div className="patch-color-row">
            <button type="button" className="patch-link-button" onClick={deleteSelectedObject}>
              <Eraser size={14} />
              Delete text
            </button>
          </div>
        </div>
      );
    }

    if (object.type === "signature" && selectedSignatureObject) {
      return (
        <div className="patch-inline-editor">
          <div className="patch-object-badge patch-object-badge-signature">Signature</div>
          <label className="patch-field">
            <span>Image file</span>
            <input type="text" value={selectedSignatureObject.fileName} readOnly />
          </label>
          <div className="patch-field-grid">
            <label className="patch-field">
              <span>Width</span>
              <input type="text" value={`${Math.round(selectedSignatureObject.width * 100)}%`} readOnly />
            </label>
            <label className="patch-field">
              <span>Height</span>
              <input type="text" value={`${Math.round(selectedSignatureObject.height * 100)}%`} readOnly />
            </label>
          </div>
          <label className="patch-field">
            <span>Opacity</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={selectedSignatureObject.opacity}
              onChange={(event) => updateSelectedSignature({ opacity: Number(event.target.value) })}
            />
          </label>
          <label className="patch-toggle-row">
            <span>Remove white background</span>
            <input
              type="checkbox"
              checked={selectedSignatureObject.removeWhiteBackground}
              onChange={(event) => {
                void updateSignatureBackgroundCleanup(selectedSignatureObject, {
                  removeWhiteBackground: event.target.checked,
                });
              }}
            />
          </label>
          <label className="patch-field">
            <span>Background threshold</span>
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={selectedSignatureObject.backgroundThreshold}
              disabled={!selectedSignatureObject.removeWhiteBackground}
              onChange={(event) => {
                void updateSignatureBackgroundCleanup(selectedSignatureObject, {
                  backgroundThreshold: Number(event.target.value),
                });
              }}
            />
            <div className="patch-slider-note">
              <span>Only pure white</span>
              <strong>{selectedSignatureObject.backgroundThreshold}</strong>
              <span>Also remove dark gray</span>
            </div>
          </label>
          <div className="patch-color-row">
            <button type="button" className="patch-link-button" onClick={() => replaceSignatureInputRef.current?.click()}>
              <Upload size={14} />
              Replace image
            </button>
            <button type="button" className="patch-link-button" onClick={deleteSelectedObject}>
              <Eraser size={14} />
              Delete signature
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="patch-workspace-page suite-app-shell">
      <nav className="suite-top-nav">
        <div className="suite-top-nav-inner">
          <Link to="/" className="logo">
            Docusurgery
          </Link>
          <div className="nav-links">
            <Link to="/patch">Overview</Link>
            <Link to="/patch/app">Tool</Link>
          </div>
        </div>
      </nav>

      <main className="suite-tool-page patch-tool-page">
        <div className="suite-tool-header">
          <div>
            <div className="suite-tool-kicker">Patch Workspace</div>
            <h1 className="suite-tool-title">Visual PDF Fixer</h1>
            <p className="suite-tool-copy">
              Cover printed text, fix form errors, insert signature images, and clean white scan backgrounds directly in your browser.
            </p>
          </div>

          <div className="suite-tool-actions patch-tool-header-actions">
            <Link to="/patch" className="suite-chip-button">
              Back to overview
            </Link>
            <button type="button" className="suite-chip-button" onClick={undo} disabled={undoStack.length === 0}>
              <Undo2 size={14} />
              Undo
            </button>
            <button type="button" className="suite-chip-button" onClick={redo} disabled={redoStack.length === 0}>
              <Redo2 size={14} />
              Redo
            </button>
            <button type="button" className="suite-chip-button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} />
              {file ? "Replace PDF" : "Upload PDF"}
            </button>
            <button type="button" className="patch-primary-button" onClick={exportPdf} disabled={!file || isExporting}>
              <Download size={16} />
              {isExporting ? "Exporting..." : "Export PDF"}
            </button>
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="patch-hidden-input" onChange={handleUpload} />
            <input ref={signatureInputRef} type="file" accept=".png,image/png" className="patch-hidden-input" onChange={handleSignatureUpload} />
            <input ref={replaceSignatureInputRef} type="file" accept=".png,image/png" className="patch-hidden-input" onChange={handleSignatureReplace} />
          </div>
        </div>

        <div className="patch-tool-description">
          Patches behave like visual whiteout for scanned forms and flat PDFs. Text behaves like a separate draggable correction layer. Signatures are visual PNG overlays with optional white-background cleanup for handwriting and stamps. Everything stays local in the browser, and signature insertion is not a certified digital signature workflow.
        </div>

        <div className="patch-workspace-grid">
          <section className="patch-panel patch-panel-viewer">
            <div className="patch-panel-toolbar">
              <div className="patch-toolbar-group">
                <button type="button" className="patch-toolbar-button" disabled={!file} onClick={fitToWidth}>
                  <RotateCcw size={14} />
                  Fit width
                </button>
              </div>

              <div className="patch-toolbar-group">
                <button type="button" className="patch-toolbar-button" disabled={!file} onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}>
                  <Minus size={14} />
                  Zoom out
                </button>
                <div className="patch-zoom-readout">{Math.round(zoom * 100)}%</div>
                <button type="button" className="patch-toolbar-button" disabled={!file} onClick={() => setZoom((value) => Math.min(3, value + 0.1))}>
                  <Plus size={14} />
                  Zoom in
                </button>
              </div>
            </div>

            <div
              ref={viewportRef}
              className={`patch-viewer-surface ${isDragOver ? "patch-viewer-surface-dragover" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  return;
                }
                setIsDragOver(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragOver(false);
                loadPdfFile(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <PatchCanvas
                file={file}
                pageNumber={currentPage}
                zoom={zoom}
                patches={present.patches}
                textObjects={present.textObjects}
                signatureObjects={present.signatureObjects}
                selectedObject={present.selectedObject}
                hoveredObject={hoveredObject}
                mode={mode}
                onSelectObject={(nextSelectedObject) => setPresent((current) => ({ ...current, selectedObject: nextSelectedObject }))}
                onCreatePatch={handleCreatePatch}
                onCreateText={handleCreateText}
                onPatchChange={handlePatchChange}
                onTextChange={handleTextChange}
                onSignatureChange={handleSignatureChange}
                onDocumentLoaded={setNumPages}
                onPageMetrics={setPageMetrics}
                onRequestPageChange={setCurrentPage}
                fileResetToken={fileResetToken}
              />
            </div>
          </section>

          <aside className="patch-panel patch-panel-sidebar">
            <div className="patch-sidebar-sticky">
              <div className="patch-sidebar-section">
                <div className="patch-sidebar-heading">Document</div>
                <div className="patch-document-card">
                  <div>
                    <strong>{file?.name ?? "No file selected"}</strong>
                    <p>{file ? `${numPages || "?"} pages loaded` : "Upload a PDF to start editing."}</p>
                  </div>
                  {file ? (
                    <button type="button" className="patch-link-button" onClick={() => resetWorkspaceForFile(file)}>
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="patch-sidebar-section">
                <div className="patch-sidebar-heading">Editing mode</div>
                <div className="patch-mode-grid">
                  <button
                    type="button"
                    className={`patch-toolbar-button ${mode === "patch" ? "patch-toolbar-button-active" : ""}`}
                    disabled={!file}
                    onClick={() => setMode("patch")}
                  >
                    <SquareDashedMousePointer size={14} />
                    Draw patch
                  </button>
                  <button
                    type="button"
                    className={`patch-toolbar-button ${mode === "text" ? "patch-toolbar-button-active" : ""}`}
                    disabled={!file}
                    onClick={() => setMode("text")}
                  >
                    <Type size={14} />
                    Add text
                  </button>
                  <button
                    type="button"
                    className={`patch-toolbar-button ${mode === "signature" ? "patch-toolbar-button-active" : ""}`}
                    disabled={!file}
                    onClick={() => {
                      setMode("signature");
                      signatureInputRef.current?.click();
                    }}
                  >
                    <ImagePlus size={14} />
                    Add signature
                  </button>
                  <button
                    type="button"
                    className={`patch-toolbar-button ${mode === "select" ? "patch-toolbar-button-active" : ""}`}
                    disabled={!file}
                    onClick={() => setMode("select")}
                  >
                    <Move size={14} />
                    Select / move
                  </button>
                </div>
                <p className="patch-muted-note">
                  View controls stay above the preview. Editing tools stay here so they remain reachable while you scroll through the page.
                </p>
              </div>

              <div className="patch-sidebar-section patch-sidebar-section-list">
                <div className="patch-sidebar-heading">Objects on this page</div>
                <div className="patch-object-list-shell">
                  {currentPageObjects.length === 0 ? (
                    <p className="patch-muted-note">No objects on page {currentPage}. Draw a patch, add text, or place a signature to start building the correction layer.</p>
                  ) : (
                    <div className="patch-list patch-list-scroll">
                      {currentPageObjects.map((object, index) => (
                        <div
                          key={`${object.type}:${object.id}`}
                          className="patch-list-entry"
                          onMouseEnter={() => setHoveredObject({ type: object.type, id: object.id })}
                          onMouseLeave={() => setHoveredObject((current) => (
                            current?.type === object.type && current.id === object.id ? null : current
                          ))}
                        >
                          <button
                            type="button"
                            className={`patch-list-item patch-list-item-${object.type} ${selectedObject?.type === object.type && selectedObject.id === object.id ? "patch-list-item-selected" : ""}`}
                            onClick={() => setPresent((current) => ({ ...current, selectedObject: { type: object.type, id: object.id } }))}
                          >
                            <span className="patch-list-item-main">
                              <span className={`patch-list-indicator patch-list-indicator-${object.type}`} aria-hidden="true">
                                {object.type === "patch" ? "P" : object.type === "signature" ? "S" : "T"}
                              </span>
                              <span>{object.label} {index + 1}</span>
                            </span>
                            <span>{object.detail}</span>
                          </button>
                          {renderInlineEditor(object)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {error ? <div className="patch-error-banner">{error}</div> : null}
      </main>
    </div>
  );
}
