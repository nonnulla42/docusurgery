import { useMemo, useRef, useState } from "react";
import { Download, Loader2, RotateCcw, RotateCw, Upload } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import type { RotatePageItem } from "../types/toolkit";
import { pdfjsLib } from "../../timeline/utils/pdfWorker";
import { RotatePageThumbnail } from "./RotatePageThumbnail";
import { exportRotatedPdf, loadPdfRotationModel, stepRotation } from "../utils/pdfRotate";

function getModifiedCount(pages: RotatePageItem[]) {
  return pages.filter((page) => page.rotation !== page.originalRotation).length;
}

function getOutputFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName.replace(/\.pdf$/i, "") + "-rotated.pdf" : "rotated.pdf";
}

export function RotatePdfWorkspace() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<RotatePageItem[]>([]);
  const [pdfPreview, setPdfPreview] = useState<any>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modifiedCount = useMemo(() => getModifiedCount(pages), [pages]);

  const loadFile = async (nextFile: File) => {
    if (!(nextFile.type === "application/pdf" || nextFile.name.toLowerCase().endsWith(".pdf"))) {
      setError("Only PDF files are supported in Rotate Pages.");
      return;
    }

    setIsLoadingFile(true);
    setError(null);
    setFeedback(null);

    try {
      const fileBytes = await nextFile.arrayBuffer();
      const rotationModel = await loadPdfRotationModel(nextFile);
      let previewPdf: any = null;

      try {
        previewPdf = await pdfjsLib.getDocument({ data: fileBytes.slice(0) }).promise;
      } catch {
        previewPdf = null;
      }

      setFile(nextFile);
      setPages(rotationModel.pages);
      setPdfPreview(previewPdf);
      setFeedback(
        previewPdf
          ? `Loaded ${rotationModel.pageCount} page${rotationModel.pageCount === 1 ? "" : "s"} from ${nextFile.name}.`
          : `Loaded ${rotationModel.pageCount} page${rotationModel.pageCount === 1 ? "" : "s"} from ${nextFile.name}. Page previews are unavailable for this PDF, but rotation and export still work.`,
      );
    } catch {
      setFile(null);
      setPages([]);
      setPdfPreview(null);
      setError(`"${nextFile.name}" could not be opened as a valid PDF.`);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];

    if (!nextFile) {
      return;
    }

    await loadFile(nextFile);
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files);

    if (files.length === 0) {
      return;
    }

    if (files.length > 1) {
      setError("Rotate Pages accepts one PDF at a time. Drop a single file to replace the current document.");
      return;
    }

    await loadFile(files[0]);
  };

  const rotatePage = (pageId: string, delta: number) => {
    setPages((current) =>
      current.map((page) =>
        page.id === pageId
          ? {
              ...page,
              rotation: stepRotation(page.rotation, delta),
            }
          : page,
      ),
    );
    setFeedback(null);
    setError(null);
  };

  const rotateAll = (delta: number) => {
    setPages((current) =>
      current.map((page) => ({
        ...page,
        rotation: stepRotation(page.rotation, delta),
      })),
    );
    setFeedback(null);
    setError(null);
  };

  const resetAll = () => {
    setPages((current) =>
      current.map((page) => ({
        ...page,
        rotation: page.originalRotation,
      })),
    );
    setFeedback(null);
    setError(null);
  };

  const exportPdf = async () => {
    if (!file || pages.length === 0) {
      return;
    }

    setIsExporting(true);
    setError(null);
    setFeedback(null);

    try {
      const bytes = await exportRotatedPdf(file, pages);
      const output = bytes.slice();
      const blob = new Blob([output.buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getOutputFileName(file.name);
      link.click();
      URL.revokeObjectURL(url);
      setFeedback(`Exported ${getOutputFileName(file.name)} with ${modifiedCount} modified page${modifiedCount === 1 ? "" : "s"}.`);
    } catch {
      setError("The rotated PDF could not be exported. The file may be corrupted or protected.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="toolkit-rotate-layout">
      <div className="toolkit-rotate-shell">
        <div className="toolkit-rotate-toolbar">
          <div>
            <div className="toolkit-detail-kicker">Rotate workflow</div>
            <h4 className="toolkit-merge-title">Correct sideways and upside-down PDF pages</h4>
            <p className="toolkit-merge-copy">Rotation is applied locally in your browser. Upload one PDF, adjust pages, then export a corrected copy.</p>
          </div>

          <div className="toolkit-merge-actions">
            <button type="button" className="toolkit-secondary-button" onClick={() => inputRef.current?.click()} disabled={isLoadingFile || isExporting}>
              <Upload size={16} />
              {file ? "Replace PDF" : "Upload PDF"}
            </button>
            <button type="button" className="toolkit-primary-button" onClick={exportPdf} disabled={!file || pages.length === 0 || isLoadingFile || isExporting}>
              {isExporting ? <Loader2 size={16} className="toolkit-spin" /> : <Download size={16} />}
              {isExporting ? "Exporting..." : "Export Rotated PDF"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="toolkit-hidden-input"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div
          className={`toolkit-upload-zone toolkit-rotate-upload-zone${isDragOver ? " toolkit-upload-zone-active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <Upload size={20} />
          <strong>{file ? "Drop a new PDF here to replace the current one" : "Drop one PDF here or click to upload"}</strong>
          <span>{file ? "One file only. Replacing will refresh the page rotation workspace." : "One PDF only. Everything stays local in the browser."}</span>
        </div>

        <div className="toolkit-rotate-bulk-actions">
          <button type="button" className="toolkit-secondary-button" onClick={() => rotateAll(-90)} disabled={!file || isLoadingFile || isExporting}>
            <RotateCcw size={16} />
            Rotate all left
          </button>
          <button type="button" className="toolkit-secondary-button" onClick={() => rotateAll(90)} disabled={!file || isLoadingFile || isExporting}>
            <RotateCw size={16} />
            Rotate all right
          </button>
          <button type="button" className="toolkit-secondary-button" onClick={resetAll} disabled={!file || isLoadingFile || isExporting}>
            Reset all rotations
          </button>
        </div>

        {feedback ? <div className="toolkit-feedback-banner toolkit-feedback-success">{feedback}</div> : null}
        {error ? <div className="toolkit-feedback-banner toolkit-feedback-error">{error}</div> : null}

        {isLoadingFile ? (
          <div className="toolkit-empty-state">
            <Loader2 size={20} className="toolkit-spin" />
            <p>Reading page data and preparing rotation controls...</p>
          </div>
        ) : null}

        {!isLoadingFile && !file ? (
          <div className="toolkit-empty-state">
            <h5>No PDF loaded yet</h5>
            <p>Upload a single PDF to inspect all pages and correct rotations page by page or across the whole document.</p>
          </div>
        ) : null}

        {!isLoadingFile && file ? (
          <div className="toolkit-rotate-page-grid">
            {pages.map((page) => {
              const isModified = page.rotation !== page.originalRotation;

              return (
                <article key={page.id} className={`toolkit-rotate-page-card${isModified ? " toolkit-rotate-page-card-modified" : ""}`}>
                  <div className="toolkit-rotate-page-card-top">
                    <div>
                      <div className="toolkit-detail-kicker">Page {page.pageNumber}</div>
                      <h5>Rotation {page.rotation}°</h5>
                    </div>
                    <span className={`toolkit-rotate-page-badge${isModified ? " toolkit-rotate-page-badge-modified" : ""}`}>
                      {isModified ? "Modified" : "Original"}
                    </span>
                  </div>

                  {pdfPreview ? (
                    <RotatePageThumbnail
                      pdf={pdfPreview}
                      pageNumber={page.pageNumber}
                      originalRotation={page.originalRotation}
                      rotation={page.rotation}
                    />
                  ) : null}

                  <div className="toolkit-rotate-page-meta">
                    <span>Current rotation: {page.rotation}°</span>
                    <span>Original: {page.originalRotation}°</span>
                  </div>

                  <div className="toolkit-rotate-page-actions">
                    <button type="button" className="toolkit-secondary-button" onClick={() => rotatePage(page.id, -90)} disabled={isExporting}>
                      <RotateCcw size={16} />
                      Left
                    </button>
                    <button type="button" className="toolkit-secondary-button" onClick={() => rotatePage(page.id, 90)} disabled={isExporting}>
                      <RotateCw size={16} />
                      Right
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      <aside className="toolkit-rotate-sidebar">
        <div className="toolkit-merge-status-row toolkit-merge-status-column">
          <div className="toolkit-merge-stat-card">
            <span>Total pages</span>
            <strong>{pages.length}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>Modified pages</span>
            <strong>{modifiedCount}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>File status</span>
            <strong>{isLoadingFile ? "Loading..." : file ? file.name : "Waiting for PDF"}</strong>
          </div>
        </div>

        <details className="toolkit-help-card" open>
          <summary>How rotation works</summary>
          <div className="toolkit-help-content">
            <p>Each page stores its own rotation value. Export writes those angles back into a new PDF while keeping everything local in the browser.</p>
            <ul>
              <li>Use per-page arrows for targeted fixes.</li>
              <li>Use global controls for entire documents.</li>
              <li>Modified pages are highlighted so you can review quickly.</li>
            </ul>
          </div>
        </details>
      </aside>
    </div>
  );
}
