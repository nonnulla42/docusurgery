import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { pdfjsLib } from "../../timeline/utils/pdfWorker";
import type { PatchEditorMode, PatchObject, PatchPageMetrics, PatchSignatureObject, PatchTextObject, SelectedPatchObject } from "../types/patch";
import { samplePatchFillColor } from "../utils/colorSampling";
import { splitTextLines } from "../utils/textLayout";

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type PreviewStatus = "idle" | "loading_document" | "loading_page" | "rendering" | "ready" | "error";

interface DraftRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type InteractionState =
  | { type: "move-patch"; patchId: string; startPoint: { x: number; y: number }; startRect: DraftRect }
  | { type: "resize-patch"; patchId: string; handle: ResizeHandle; startPoint: { x: number; y: number }; startRect: DraftRect }
  | { type: "move-text"; textId: string; startPoint: { x: number; y: number }; startPosition: { x: number; y: number } }
  | { type: "move-signature"; signatureId: string; startPoint: { x: number; y: number }; startRect: DraftRect }
  | { type: "resize-signature"; signatureId: string; handle: ResizeHandle; startPoint: { x: number; y: number }; startRect: DraftRect; aspectRatio: number };

interface PatchCanvasProps {
  file: File | null;
  pageNumber: number;
  zoom: number;
  patches: PatchObject[];
  textObjects: PatchTextObject[];
  signatureObjects: PatchSignatureObject[];
  selectedObject: SelectedPatchObject | null;
  hoveredObject: SelectedPatchObject | null;
  mode: PatchEditorMode;
  onSelectObject: (selectedObject: SelectedPatchObject | null) => void;
  onCreatePatch: (patch: Omit<PatchObject, "id">) => void;
  onCreateText: (textObject: Omit<PatchTextObject, "id">) => void;
  onPatchChange: (patchId: string, updates: Partial<PatchObject>, commit?: boolean) => void;
  onTextChange: (textId: string, updates: Partial<PatchTextObject>, commit?: boolean) => void;
  onSignatureChange: (signatureId: string, updates: Partial<PatchSignatureObject>, commit?: boolean) => void;
  onDocumentLoaded: (numPages: number) => void;
  onPageMetrics: (metrics: PatchPageMetrics) => void;
  onRequestPageChange: (pageNumber: number) => void;
  fileResetToken: number;
}

const MIN_PATCH_SIZE = 0.02;
const MIN_SIGNATURE_SIZE = 0.04;
const MAX_PREVIEW_PIXELS = 6_000_000;
const RENDER_TIMEOUT_MS = 15000;
const PREVIEW_SCALE_FLOOR = 0.35;
const PREVIEW_SCALE_CEILING = 2.25;

function createStageLogger(context: Record<string, unknown>) {
  return (message: string, details?: Record<string, unknown>) => {
    console.info(`Patch Editor: ${message}`, { ...context, ...details });
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRect(rect: DraftRect): DraftRect {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const x = Math.min(rect.x, right);
  const y = Math.min(rect.y, bottom);
  const maxX = Math.max(rect.x, right);
  const maxY = Math.max(rect.y, bottom);

  return {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    width: clamp(maxX, 0, 1) - clamp(x, 0, 1),
    height: clamp(maxY, 0, 1) - clamp(y, 0, 1),
  };
}

function resizeRect(rect: DraftRect, handle: ResizeHandle, dx: number, dy: number) {
  const next = { ...rect };
  if (handle.includes("e")) next.width = rect.width + dx;
  if (handle.includes("s")) next.height = rect.height + dy;
  if (handle.includes("w")) {
    next.x = rect.x + dx;
    next.width = rect.width - dx;
  }
  if (handle.includes("n")) {
    next.y = rect.y + dy;
    next.height = rect.height - dy;
  }
  return normalizeRect(next);
}

function enforceSignatureAspectRatio(rect: DraftRect, aspectRatio: number, pageAspectRatio: number, handle: ResizeHandle) {
  const widthBasedHeight = (rect.width * pageAspectRatio) / aspectRatio;
  const heightBasedWidth = (rect.height * aspectRatio) / pageAspectRatio;
  let width = rect.width;
  let height = rect.height;

  if (Math.abs(widthBasedHeight - rect.height) <= Math.abs(heightBasedWidth - rect.width)) {
    height = widthBasedHeight;
  } else {
    width = heightBasedWidth;
  }

  let x = rect.x;
  let y = rect.y;

  if (handle.includes("w")) x = rect.x + (rect.width - width);
  if (handle.includes("n")) y = rect.y + (rect.height - height);

  return normalizeRect({ x, y, width, height });
}

function handleCursor(handle: ResizeHandle) {
  if (handle === "n" || handle === "s") return "ns-resize";
  if (handle === "e" || handle === "w") return "ew-resize";
  if (handle === "ne" || handle === "sw") return "nesw-resize";
  return "nwse-resize";
}

function getTextTransform(alignment: PatchTextObject["alignment"]) {
  if (alignment === "center") return "translateX(-50%)";
  if (alignment === "right") return "translateX(-100%)";
  return "translateX(0)";
}

export function PatchCanvas({
  file,
  pageNumber,
  zoom,
  patches,
  textObjects,
  signatureObjects,
  selectedObject,
  hoveredObject,
  mode,
  onSelectObject,
  onCreatePatch,
  onCreateText,
  onPatchChange,
  onTextChange,
  onSignatureChange,
  onDocumentLoaded,
  onPageMetrics,
  onRequestPageChange,
  fileResetToken,
}: PatchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const renderRequestIdRef = useRef(0);
  const renderTimeoutRef = useRef<number | null>(null);
  const objectElementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const interactionRef = useRef<InteractionState | null>(null);

  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [draftRect, setDraftRect] = useState<DraftRect | null>(null);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [flashObjectKey, setFlashObjectKey] = useState<string | null>(null);
  const pageAspectRatio = renderedSize.width > 0 && renderedSize.height > 0 ? renderedSize.width / renderedSize.height : 1;

  const reportDocumentLoaded = useEffectEvent((pages: number) => onDocumentLoaded(pages));
  const reportPageMetrics = useEffectEvent((metrics: PatchPageMetrics) => onPageMetrics(metrics));

  const clearRenderTimeout = () => {
    if (renderTimeoutRef.current !== null) {
      window.clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }
  };

  const cancelActiveRender = (reason: string) => {
    clearRenderTimeout();
    if (renderTaskRef.current) {
      console.info("Patch Editor: cancelling active page render", { reason });
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
  };

  useEffect(() => {
    return () => cancelActiveRender("component_unmount");
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;
    const log = createStageLogger({ fileName: file?.name, fileSize: file?.size, fileType: file?.type });

    const loadPdf = async () => {
      if (!file) {
        setPdf(null);
        setNumPages(0);
        setPreviewStatus("idle");
        setRenderedSize({ width: 0, height: 0 });
        setNaturalSize({ width: 0, height: 0 });
        return;
      }

      setPreviewStatus("loading_document");
      setError(null);
      try {
        log("PDF load start");
        loadingTask = pdfjsLib.getDocument({ data: await file.arrayBuffer() });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        log("PDF load success", { numPages: doc.numPages });
        setPdf(doc);
        setNumPages(doc.numPages);
        reportDocumentLoaded(doc.numPages);
      } catch (loadError) {
        console.error("Patch Editor: failed to load PDF document", { fileName: file?.name, error: loadError });
        if (!cancelled) {
          setPreviewStatus("error");
          setError("Failed to open the PDF. Please try another file.");
        }
      }
    };

    void loadPdf();
    return () => {
      cancelled = true;
      cancelActiveRender("pdf_reload");
      if (loadingTask?.destroy) {
        void loadingTask.destroy();
      }
    };
  }, [file, fileResetToken]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++renderRequestIdRef.current;
    const log = createStageLogger({ fileName: file?.name, pageNumber, zoom, requestId });

    const renderPage = async () => {
      if (!pdf || !canvasRef.current) return;

      cancelActiveRender("new_render_request");
      setError(null);
      setPreviewStatus("loading_page");

      try {
        log("page fetch start");
        const page = await pdf.getPage(pageNumber);
        if (cancelled || renderRequestIdRef.current !== requestId) return;
        log("page fetch success", { rotate: page.rotate });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context unavailable");

        const dpr = window.devicePixelRatio || 1;
        const rotation = page.rotate ?? 0;
        const naturalViewport = page.getViewport({ scale: 1, rotation });
        const desiredScale = Math.max(PREVIEW_SCALE_FLOOR, zoom) * dpr;
        const maxScaleForPixels = Math.sqrt(MAX_PREVIEW_PIXELS / Math.max(1, naturalViewport.width * naturalViewport.height));
        const effectiveScale = clamp(Math.min(desiredScale, maxScaleForPixels), PREVIEW_SCALE_FLOOR, PREVIEW_SCALE_CEILING * dpr);
        const viewport = page.getViewport({ scale: effectiveScale, rotation });
        const cssWidth = viewport.width / dpr;
        const cssHeight = viewport.height / dpr;

        log("viewport creation", {
          desiredScale,
          effectiveScale,
          naturalWidth: naturalViewport.width,
          naturalHeight: naturalViewport.height,
          renderedWidth: cssWidth,
          renderedHeight: cssHeight,
        });

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        log("canvas allocation", { canvasWidth: canvas.width, canvasHeight: canvas.height });

        setPreviewStatus("rendering");
        log("pdf.js render start");
        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        renderTimeoutRef.current = window.setTimeout(() => {
          if (renderTaskRef.current === renderTask) {
            console.error("Patch Editor: page render timed out", { fileName: file?.name, pageNumber, requestId });
            renderTask.cancel();
          }
        }, RENDER_TIMEOUT_MS);

        await renderTask.promise;
        clearRenderTimeout();
        renderTaskRef.current = null;
        if (cancelled || renderRequestIdRef.current !== requestId) return;
        log("pdf.js render resolved");
        log("canvas to image/data URL start", { mode: "skipped_direct_canvas" });
        log("canvas to image/data URL success", { mode: "skipped_direct_canvas" });

        setRenderedSize({ width: cssWidth, height: cssHeight });
        setNaturalSize({ width: naturalViewport.width, height: naturalViewport.height });
        reportPageMetrics({
          pageNumber,
          naturalWidth: naturalViewport.width,
          naturalHeight: naturalViewport.height,
          renderedWidth: cssWidth,
          renderedHeight: cssHeight,
        });
        setPreviewStatus("ready");
        log("preview state set to ready");
      } catch (renderError: any) {
        clearRenderTimeout();
        renderTaskRef.current = null;
        if (renderError?.name !== "RenderingCancelledException") {
          console.error("Patch Editor: failed to render PDF page", { fileName: file?.name, pageNumber, error: renderError });
          setPreviewStatus("error");
          setError("This page could not be rendered.");
        } else if (!cancelled && renderRequestIdRef.current === requestId) {
          setPreviewStatus("error");
          setError("Page rendering took too long and was cancelled. Try a lower zoom level.");
        }
      }
    };

    void renderPage();
    return () => {
      cancelled = true;
      cancelActiveRender("effect_cleanup");
    };
  }, [file, pdf, pageNumber, zoom]);

  useEffect(() => {
    if (!selectedObject) return;

    const key = `${selectedObject.type}:${selectedObject.id}`;
    const element = objectElementRefs.current[key];
    const selectedPatch = patches.find((patch) => patch.id === selectedObject.id);
    const selectedText = textObjects.find((textObject) => textObject.id === selectedObject.id);
    const selectedSignature = signatureObjects.find((signature) => signature.id === selectedObject.id);
    const objectPage = selectedObject.type === "patch"
      ? selectedPatch?.pageNumber
      : selectedObject.type === "text"
        ? selectedText?.pageNumber
        : selectedSignature?.pageNumber;
    const scrollContainer = frameRef.current?.closest(".patch-viewer-surface") as HTMLElement | null;
    if (!element || !scrollContainer || objectPage !== pageNumber) return;

    const objectRect = element.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const margin = 64;
    const isVisible =
      objectRect.top >= containerRect.top + margin &&
      objectRect.bottom <= containerRect.bottom - margin &&
      objectRect.left >= containerRect.left + margin &&
      objectRect.right <= containerRect.right - margin;

    if (!isVisible) {
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }

    setFlashObjectKey(key);
    const timer = window.setTimeout(() => {
      setFlashObjectKey((current) => (current === key ? null : current));
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [selectedObject, patches, textObjects, signatureObjects, pageNumber]);

  useEffect(() => {
    const getPoint = (clientX: number, clientY: number) => {
      const frame = frameRef.current;
      if (!frame) return { x: 0, y: 0 };
      const bounds = frame.getBoundingClientRect();
      return {
        x: clamp((clientX - bounds.left) / bounds.width, 0, 1),
        y: clamp((clientY - bounds.top) / bounds.height, 0, 1),
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const point = getPoint(event.clientX, event.clientY);

      if (draftRect) {
        setDraftRect((current) => current ? normalizeRect({
          x: current.x,
          y: current.y,
          width: point.x - current.x,
          height: point.y - current.y,
        }) : null);
        return;
      }

      const interaction = interactionRef.current;
      if (!interaction) return;

      const dx = point.x - interaction.startPoint.x;
      const dy = point.y - interaction.startPoint.y;

      if (interaction.type === "move-patch") {
        onPatchChange(interaction.patchId, {
          x: clamp(interaction.startRect.x + dx, 0, 1 - interaction.startRect.width),
          y: clamp(interaction.startRect.y + dy, 0, 1 - interaction.startRect.height),
        });
        return;
      }

      if (interaction.type === "resize-patch") {
        const nextRect = resizeRect(interaction.startRect, interaction.handle, dx, dy);
        onPatchChange(interaction.patchId, {
          x: nextRect.x,
          y: nextRect.y,
          width: Math.max(MIN_PATCH_SIZE, nextRect.width),
          height: Math.max(MIN_PATCH_SIZE, nextRect.height),
        });
        return;
      }

      if (interaction.type === "move-text") {
        onTextChange(interaction.textId, {
          x: clamp(interaction.startPosition.x + dx, 0, 1),
          y: clamp(interaction.startPosition.y + dy, 0, 1),
        });
        return;
      }

      if (interaction.type === "move-signature") {
        onSignatureChange(interaction.signatureId, {
          x: clamp(interaction.startRect.x + dx, 0, 1 - interaction.startRect.width),
          y: clamp(interaction.startRect.y + dy, 0, 1 - interaction.startRect.height),
        });
        return;
      }

      const nextRect = enforceSignatureAspectRatio(
        resizeRect(interaction.startRect, interaction.handle, dx, dy),
        interaction.aspectRatio,
        pageAspectRatio,
        interaction.handle,
      );
      onSignatureChange(interaction.signatureId, {
        x: nextRect.x,
        y: nextRect.y,
        width: Math.max(MIN_SIGNATURE_SIZE, nextRect.width),
        height: Math.max((MIN_SIGNATURE_SIZE * pageAspectRatio) / Math.max(interaction.aspectRatio, 0.01), nextRect.height),
      });
    };

    const onPointerUp = () => {
      if (draftRect) {
        if (draftRect.width >= MIN_PATCH_SIZE && draftRect.height >= MIN_PATCH_SIZE && canvasRef.current) {
          const fill = samplePatchFillColor(canvasRef.current, {
            x: draftRect.x * canvasRef.current.width,
            y: draftRect.y * canvasRef.current.height,
            width: draftRect.width * canvasRef.current.width,
            height: draftRect.height * canvasRef.current.height,
          });

          onCreatePatch({
            pageNumber,
            x: draftRect.x,
            y: draftRect.y,
            width: draftRect.width,
            height: draftRect.height,
            fill,
          });
        }
        setDraftRect(null);
      }

      const interaction = interactionRef.current;
      if (interaction?.type === "move-patch" || interaction?.type === "resize-patch") {
        const patch = patches.find((item) => item.id === interaction.patchId);
        if (patch && canvasRef.current) {
          const fill = samplePatchFillColor(canvasRef.current, {
            x: patch.x * canvasRef.current.width,
            y: patch.y * canvasRef.current.height,
            width: patch.width * canvasRef.current.width,
            height: patch.height * canvasRef.current.height,
          });
          onPatchChange(interaction.patchId, { fill }, true);
        }
      } else if (interaction?.type === "move-text") {
        const textObject = textObjects.find((item) => item.id === interaction.textId);
        if (textObject) {
          onTextChange(interaction.textId, textObject, true);
        }
      } else if (interaction?.type === "move-signature" || interaction?.type === "resize-signature") {
        const signature = signatureObjects.find((item) => item.id === interaction.signatureId);
        if (signature) {
          onSignatureChange(interaction.signatureId, signature, true);
        }
      }

      interactionRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draftRect, onCreatePatch, onPatchChange, onTextChange, onSignatureChange, pageNumber, patches, textObjects, signatureObjects, pageAspectRatio]);

  const getPointFromReactEvent = (event: { clientX: number; clientY: number }) => {
    const frame = frameRef.current;
    if (!frame) return { x: 0, y: 0 };
    const bounds = frame.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  };

  const startPatchMove = (event: ReactPointerEvent<HTMLDivElement>, patch: PatchObject) => {
    if (mode !== "select") return;
    event.stopPropagation();
    onSelectObject({ type: "patch", id: patch.id });
    interactionRef.current = {
      type: "move-patch",
      patchId: patch.id,
      startPoint: getPointFromReactEvent(event),
      startRect: { x: patch.x, y: patch.y, width: patch.width, height: patch.height },
    };
  };

  const startPatchResize = (event: ReactPointerEvent<HTMLButtonElement>, patch: PatchObject, handle: ResizeHandle) => {
    event.stopPropagation();
    onSelectObject({ type: "patch", id: patch.id });
    interactionRef.current = {
      type: "resize-patch",
      patchId: patch.id,
      handle,
      startPoint: getPointFromReactEvent(event),
      startRect: { x: patch.x, y: patch.y, width: patch.width, height: patch.height },
    };
  };

  const startTextMove = (event: ReactPointerEvent<HTMLDivElement>, textObject: PatchTextObject) => {
    if (mode !== "select") return;
    event.stopPropagation();
    onSelectObject({ type: "text", id: textObject.id });
    interactionRef.current = {
      type: "move-text",
      textId: textObject.id,
      startPoint: getPointFromReactEvent(event),
      startPosition: { x: textObject.x, y: textObject.y },
    };
  };

  const startSignatureMove = (event: ReactPointerEvent<HTMLDivElement>, signature: PatchSignatureObject) => {
    if (mode !== "select") return;
    event.stopPropagation();
    onSelectObject({ type: "signature", id: signature.id });
    interactionRef.current = {
      type: "move-signature",
      signatureId: signature.id,
      startPoint: getPointFromReactEvent(event),
      startRect: { x: signature.x, y: signature.y, width: signature.width, height: signature.height },
    };
  };

  const startSignatureResize = (event: ReactPointerEvent<HTMLButtonElement>, signature: PatchSignatureObject, handle: ResizeHandle) => {
    event.stopPropagation();
    onSelectObject({ type: "signature", id: signature.id });
    interactionRef.current = {
      type: "resize-signature",
      signatureId: signature.id,
      handle,
      startPoint: getPointFromReactEvent(event),
      startRect: { x: signature.x, y: signature.y, width: signature.width, height: signature.height },
      aspectRatio: signature.aspectRatio,
    };
  };

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!frameRef.current) return;
    const point = getPointFromReactEvent(event);

    if (mode === "patch") {
      onSelectObject(null);
      setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 });
      return;
    }

    if (mode === "text") {
      onCreateText({
        pageNumber,
        x: point.x,
        y: point.y,
        text: "New text",
        fontSize: 12,
        fontFamily: "Helvetica",
        textColor: "#101828",
        alignment: "left",
      });
      return;
    }

    onSelectObject(null);
  };

  const currentPagePatches = patches.filter((patch) => patch.pageNumber === pageNumber);
  const currentPageTexts = textObjects.filter((textObject) => textObject.pageNumber === pageNumber);
  const currentPageSignatures = signatureObjects.filter((signature) => signature.pageNumber === pageNumber);

  return (
    <div className="patch-canvas-shell">
      <div className="patch-canvas-toolbar">
        <button type="button" className="patch-page-nav-button" disabled={pageNumber <= 1} onClick={() => onRequestPageChange(pageNumber - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="patch-page-nav-label">Page {pageNumber} of {numPages || "?"}</span>
        <button type="button" className="patch-page-nav-button" disabled={pageNumber >= numPages} onClick={() => onRequestPageChange(pageNumber + 1)}>
          <ChevronRight size={16} />
        </button>
        <span className="patch-canvas-meta">{Math.round(renderedSize.width)} x {Math.round(renderedSize.height)} px</span>
      </div>

      <div className="patch-canvas-stage">
        {!file ? (
          <div className="patch-empty-state">
            <AlertCircle size={28} />
            <p>Upload a PDF to begin placing cover-up patches, free text labels, and signature images on the page preview.</p>
          </div>
        ) : error ? (
          <div className="patch-empty-state patch-empty-state-error">
            <AlertCircle size={28} />
            <p>{error}</p>
          </div>
        ) : (
          <div ref={frameRef} className={`patch-canvas-frame ${mode === "patch" ? "patch-canvas-frame-draw" : ""}`} onPointerDown={handleStagePointerDown}>
            {previewStatus !== "ready" ? (
              <div className="patch-canvas-loading">
                <Loader2 size={24} className="patch-spin" />
                <span>
                  {previewStatus === "loading_document" && "Loading PDF..."}
                  {previewStatus === "loading_page" && "Loading page..."}
                  {previewStatus === "rendering" && "Rendering page..."}
                  {previewStatus === "idle" && "Preparing preview..."}
                </span>
              </div>
            ) : null}

            <canvas ref={canvasRef} className="patch-page-canvas" />
            <div className="patch-overlay" style={{ width: renderedSize.width, height: renderedSize.height }}>
              {currentPagePatches.map((patch) => {
                const objectKey = `patch:${patch.id}`;
                const isSelected = selectedObject?.type === "patch" && selectedObject.id === patch.id;
                const isHovered = hoveredObject?.type === "patch" && hoveredObject.id === patch.id;

                return (
                  <div
                    key={patch.id}
                    ref={(element) => {
                      objectElementRefs.current[objectKey] = element;
                    }}
                    className={`patch-annotation ${isSelected ? "patch-annotation-selected patch-annotation-selected-patch" : ""} ${isHovered ? "patch-annotation-hover patch-annotation-hover-patch" : ""} ${flashObjectKey === objectKey ? "patch-annotation-flash patch-annotation-flash-patch" : ""}`}
                    style={{
                      left: `${patch.x * 100}%`,
                      top: `${patch.y * 100}%`,
                      width: `${patch.width * 100}%`,
                      height: `${patch.height * 100}%`,
                      backgroundColor: patch.fill.hex,
                    }}
                    onPointerDown={(event) => startPatchMove(event, patch)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectObject({ type: "patch", id: patch.id });
                    }}
                  >
                    {isSelected ? (
                      <>
                        {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeHandle[]).map((handle) => (
                          <button key={handle} type="button" className={`patch-handle patch-handle-${handle}`} style={{ cursor: handleCursor(handle) }} onPointerDown={(event) => startPatchResize(event, patch, handle)} />
                        ))}
                      </>
                    ) : null}
                  </div>
                );
              })}

              {currentPageSignatures.map((signature) => {
                const objectKey = `signature:${signature.id}`;
                const isSelected = selectedObject?.type === "signature" && selectedObject.id === signature.id;
                const isHovered = hoveredObject?.type === "signature" && hoveredObject.id === signature.id;

                return (
                  <div
                    key={signature.id}
                    ref={(element) => {
                      objectElementRefs.current[objectKey] = element;
                    }}
                    className={`patch-signature-object ${isSelected ? "patch-signature-object-selected patch-signature-object-selected-signature" : ""} ${isHovered ? "patch-signature-object-hover patch-signature-object-hover-signature" : ""} ${flashObjectKey === objectKey ? "patch-annotation-flash patch-annotation-flash-signature" : ""}`}
                    style={{
                      left: `${signature.x * 100}%`,
                      top: `${signature.y * 100}%`,
                      width: `${signature.width * 100}%`,
                      height: `${signature.height * 100}%`,
                    }}
                    onPointerDown={(event) => startSignatureMove(event, signature)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectObject({ type: "signature", id: signature.id });
                    }}
                  >
                    <img src={signature.imageDataUrl} alt="" draggable={false} style={{ opacity: signature.opacity }} />
                    {isSelected ? (
                      <>
                        {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as ResizeHandle[]).map((handle) => (
                          <button key={handle} type="button" className={`patch-handle patch-handle-${handle}`} style={{ cursor: handleCursor(handle) }} onPointerDown={(event) => startSignatureResize(event, signature, handle)} />
                        ))}
                      </>
                    ) : null}
                  </div>
                );
              })}

              {currentPageTexts.map((textObject) => {
                const objectKey = `text:${textObject.id}`;
                const isSelected = selectedObject?.type === "text" && selectedObject.id === textObject.id;
                const isHovered = hoveredObject?.type === "text" && hoveredObject.id === textObject.id;
                const lines = splitTextLines(textObject.text || " ");

                return (
                  <div
                    key={textObject.id}
                    ref={(element) => {
                      objectElementRefs.current[objectKey] = element;
                    }}
                    className={`patch-text-object ${isSelected ? "patch-text-object-selected patch-text-object-selected-text" : ""} ${isHovered ? "patch-text-object-hover patch-text-object-hover-text" : ""} ${flashObjectKey === objectKey ? "patch-annotation-flash patch-annotation-flash-text" : ""}`}
                    style={{
                      left: `${textObject.x * 100}%`,
                      top: `${textObject.y * 100}%`,
                      transform: getTextTransform(textObject.alignment),
                      color: textObject.textColor,
                      fontFamily: textObject.fontFamily,
                      fontSize: `${Math.max(8, textObject.fontSize * zoom)}px`,
                      textAlign: textObject.alignment,
                    }}
                    onPointerDown={(event) => startTextMove(event, textObject)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectObject({ type: "text", id: textObject.id });
                    }}
                  >
                    {lines.map((line, index) => (
                      <div key={`${textObject.id}-${index}`}>{line || "\u00A0"}</div>
                    ))}
                  </div>
                );
              })}

              {draftRect ? (
                <div
                  className="patch-draft"
                  style={{
                    left: `${draftRect.x * 100}%`,
                    top: `${draftRect.y * 100}%`,
                    width: `${draftRect.width * 100}%`,
                    height: `${draftRect.height * 100}%`,
                  }}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>

      {naturalSize.width > 0 ? (
        <div className="patch-canvas-footer">
          Natural page size {Math.round(naturalSize.width)} x {Math.round(naturalSize.height)} px at 100%
        </div>
      ) : null}
    </div>
  );
}
