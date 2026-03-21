import { memo, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface RotatePageThumbnailProps {
  pdf: any;
  pageNumber: number;
  originalRotation: number;
  rotation: number;
}

const THUMBNAIL_TARGET_WIDTH = 160;
const THUMBNAIL_MAX_HEIGHT = 220;
const THUMBNAIL_FRAME_WIDTH = 160;
const THUMBNAIL_FRAME_HEIGHT = 220;
const THUMBNAIL_MAX_DPR = 2;

function normalizeRotation(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export const RotatePageThumbnail = memo(function RotatePageThumbnail({
  pdf,
  pageNumber,
  originalRotation,
  rotation,
}: RotatePageThumbnailProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [renderState, setRenderState] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const preview = previewRef.current;

    if (!preview || isVisible) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "180px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(preview);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  useEffect(() => {
    let isMounted = true;

    const renderThumbnail = async () => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      if (!isVisible) {
        return;
      }

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      if (!pdf) {
        setRenderState("error");
        return;
      }

      setRenderState("rendering");

      try {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const widthScale = THUMBNAIL_TARGET_WIDTH / Math.max(baseViewport.width, 1);
        const heightScale = THUMBNAIL_MAX_HEIGHT / Math.max(baseViewport.height, 1);
        const viewport = page.getViewport({ scale: Math.min(widthScale, heightScale) });
        const context = canvas.getContext("2d");

        if (!context) {
          setRenderState("error");
          return;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, THUMBNAIL_MAX_DPR);
        canvas.width = Math.round(viewport.width * dpr);
        canvas.height = Math.round(viewport.height * dpr);
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, viewport.width, viewport.height);

        const renderTask = page.render({
          canvasContext: context,
          canvas,
          viewport,
        });

        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
        page.cleanup();

        if (isMounted) {
          setCanvasSize({
            width: Math.round(viewport.width),
            height: Math.round(viewport.height),
          });
          setRenderState("ready");
        }
      } catch (renderError: any) {
        if (!isMounted || renderError?.name === "RenderingCancelledException") {
          return;
        }

        setRenderState("error");
      }
    };

    renderThumbnail();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [isVisible, pdf, pageNumber]);

  const displayRotation = normalizeRotation(rotation - originalRotation);
  const isQuarterTurn = displayRotation === 90 || displayRotation === 270;
  const rotatedWidth = canvasSize ? (isQuarterTurn ? canvasSize.height : canvasSize.width) : THUMBNAIL_TARGET_WIDTH;
  const rotatedHeight = canvasSize ? (isQuarterTurn ? canvasSize.width : canvasSize.height) : THUMBNAIL_MAX_HEIGHT;
  const rotationScale = canvasSize
    ? Math.min(THUMBNAIL_FRAME_WIDTH / Math.max(rotatedWidth, 1), THUMBNAIL_FRAME_HEIGHT / Math.max(rotatedHeight, 1), 1)
    : 1;

  return (
    <div ref={previewRef} className="toolkit-rotate-page-preview" aria-hidden="true">
      {renderState === "idle" || renderState === "rendering" ? (
        <div className="toolkit-rotate-preview-state">
          <Loader2 size={18} className="toolkit-spin" />
        </div>
      ) : null}
      {renderState === "error" ? (
        <div className="toolkit-rotate-preview-state toolkit-rotate-preview-error">
          <strong>Preview unavailable</strong>
          <span>This page could not be rendered.</span>
        </div>
      ) : null}
      <div
        className={`toolkit-rotate-page-frame${renderState !== "ready" ? " toolkit-rotate-page-frame-hidden" : ""}`}
        style={{
          width: `${THUMBNAIL_FRAME_WIDTH}px`,
          height: `${THUMBNAIL_FRAME_HEIGHT}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="toolkit-rotate-page-canvas"
          style={{
            transform: `translate(-50%, -50%) rotate(${displayRotation}deg) scale(${rotationScale})`,
          }}
        />
      </div>
    </div>
  );
});
