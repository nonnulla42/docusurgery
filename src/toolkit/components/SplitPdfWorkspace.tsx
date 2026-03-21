import { useMemo, useRef, useState } from "react";
import { CheckSquare, Download, Loader2, Scissors, Square, Upload } from "lucide-react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import type { SplitPageItem } from "../types/toolkit";
import { pdfjsLib } from "../../timeline/utils/pdfWorker";
import { RotatePageThumbnail } from "./RotatePageThumbnail";
import { exportSelectedPagesPdf, loadPdfSplitModel, parsePageRange } from "../utils/pdfSplit";

function getSelectedCount(pages: SplitPageItem[]) {
  return pages.filter((page) => page.selected).length;
}

function getOutputFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".pdf") ? fileName.replace(/\.pdf$/i, "") + "-selected-pages.pdf" : "selected-pages.pdf";
}

export function SplitPdfWorkspace() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<SplitPageItem[]>([]);
  const [pdfPreview, setPdfPreview] = useState<any>(null);
  const [rangeInput, setRangeInput] = useState("");
  const [selectionMode, setSelectionMode] = useState("All pages selected");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = useMemo(() => getSelectedCount(pages), [pages]);

  const loadFile = async (nextFile: File) => {
    if (!(nextFile.type === "application/pdf" || nextFile.name.toLowerCase().endsWith(".pdf"))) {
      setError("Only PDF files are supported in Split PDF.");
      return;
    }

    setIsLoadingFile(true);
    setError(null);
    setFeedback(null);

    try {
      const fileBytes = await nextFile.arrayBuffer();
      const splitModel = await loadPdfSplitModel(nextFile);
      let previewPdf: any = null;

      try {
        previewPdf = await pdfjsLib.getDocument({ data: fileBytes.slice(0) }).promise;
      } catch {
        previewPdf = null;
      }

      setFile(nextFile);
      setPages(splitModel.pages);
      setPdfPreview(previewPdf);
      setRangeInput("");
      setSelectionMode("All pages selected");
      setFeedback(
        previewPdf
          ? `Loaded ${splitModel.pageCount} page${splitModel.pageCount === 1 ? "" : "s"} from ${nextFile.name}.`
          : `Loaded ${splitModel.pageCount} page${splitModel.pageCount === 1 ? "" : "s"} from ${nextFile.name}. Page previews are unavailable for this PDF, but selection and export still work.`,
      );
    } catch {
      setFile(null);
      setPages([]);
      setPdfPreview(null);
      setRangeInput("");
      setSelectionMode("Waiting for PDF");
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
      setError("Split PDF accepts one PDF at a time. Drop a single file to replace the current document.");
      return;
    }

    await loadFile(files[0]);
  };

  const setSelection = (matcher: (page: SplitPageItem, index: number) => boolean, nextMode: string) => {
    setPages((current) => current.map((page, index) => ({ ...page, selected: matcher(page, index) })));
    setSelectionMode(nextMode);
    setFeedback(null);
    setError(null);
  };

  const togglePage = (pageId: string) => {
    setPages((current) =>
      current.map((page) =>
        page.id === pageId
          ? {
              ...page,
              selected: !page.selected,
            }
          : page,
      ),
    );
    setSelectionMode("Manual selection");
    setFeedback(null);
    setError(null);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>, pageId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      togglePage(pageId);
    }
  };

  const applyRange = () => {
    if (pages.length === 0) {
      return;
    }

    try {
      const selectedPages = parsePageRange(rangeInput, pages.length);

      setPages((current) =>
        current.map((page) => ({
          ...page,
          selected: selectedPages.has(page.pageNumber),
        })),
      );
      setSelectionMode("Range selection");
      setFeedback(`Selected ${selectedPages.size} page${selectedPages.size === 1 ? "" : "s"} from the range input.`);
      setError(null);
    } catch (rangeError: any) {
      setError(rangeError?.message ?? "The page range could not be applied.");
      setFeedback(null);
    }
  };

  const exportPdf = async () => {
    if (!file || pages.length === 0) {
      return;
    }

    setIsExporting(true);
    setError(null);
    setFeedback(null);

    try {
      const bytes = await exportSelectedPagesPdf(file, pages);
      const output = bytes.slice();
      const blob = new Blob([output.buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = getOutputFileName(file.name);
      link.click();
      URL.revokeObjectURL(url);
      setFeedback(`Exported ${getOutputFileName(file.name)} with ${selectedCount} selected page${selectedCount === 1 ? "" : "s"}.`);
    } catch (exportError: any) {
      setError(exportError?.message ?? "The selected pages could not be exported. The file may be corrupted or protected.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="toolkit-split-layout">
      <div className="toolkit-split-shell">
        <div className="toolkit-rotate-toolbar">
          <div>
            <div className="toolkit-detail-kicker">Split workflow</div>
            <h4 className="toolkit-merge-title">Select the pages you want to keep and export a clean subset</h4>
            <p className="toolkit-merge-copy">Everything stays local in your browser. Upload one PDF, choose pages visually, then export a new PDF in the same order.</p>
          </div>

          <div className="toolkit-merge-actions">
            <button type="button" className="toolkit-secondary-button" onClick={() => inputRef.current?.click()} disabled={isLoadingFile || isExporting}>
              <Upload size={16} />
              {file ? "Replace PDF" : "Upload PDF"}
            </button>
            <button
              type="button"
              className="toolkit-primary-button"
              onClick={exportPdf}
              disabled={!file || pages.length === 0 || selectedCount === 0 || isLoadingFile || isExporting}
            >
              {isExporting ? <Loader2 size={16} className="toolkit-spin" /> : <Download size={16} />}
              {isExporting ? "Exporting..." : "Export Selected Pages"}
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
          <span>{file ? "One file only. Replacing will refresh the page selection workspace." : "One PDF only. Split and export stay local in the browser."}</span>
        </div>

        <div className="toolkit-split-controls">
          <div className="toolkit-split-quick-actions">
            <button type="button" className="toolkit-secondary-button" onClick={() => setSelection(() => true, "All pages selected")} disabled={!file || isLoadingFile || isExporting}>
              <CheckSquare size={16} />
              Select all
            </button>
            <button type="button" className="toolkit-secondary-button" onClick={() => setSelection(() => false, "Selection cleared")} disabled={!file || isLoadingFile || isExporting}>
              <Square size={16} />
              Clear selection
            </button>
            <button
              type="button"
              className="toolkit-secondary-button"
              onClick={() => setSelection((_, index) => (index + 1) % 2 === 1, "Odd pages")}
              disabled={!file || isLoadingFile || isExporting}
            >
              Odd pages
            </button>
            <button
              type="button"
              className="toolkit-secondary-button"
              onClick={() => setSelection((_, index) => (index + 1) % 2 === 0, "Even pages")}
              disabled={!file || isLoadingFile || isExporting}
            >
              Even pages
            </button>
          </div>

          <div className="toolkit-split-range-bar">
            <label className="toolkit-split-range-field">
              <span>Page range</span>
              <input
                type="text"
                value={rangeInput}
                onChange={(event) => setRangeInput(event.target.value)}
                placeholder="1-3,5,8-10"
                disabled={!file || isLoadingFile || isExporting}
              />
            </label>
            <button type="button" className="toolkit-secondary-button" onClick={applyRange} disabled={!file || isLoadingFile || isExporting}>
              <Scissors size={16} />
              Apply range
            </button>
          </div>
        </div>

        {feedback ? <div className="toolkit-feedback-banner toolkit-feedback-success">{feedback}</div> : null}
        {error ? <div className="toolkit-feedback-banner toolkit-feedback-error">{error}</div> : null}

        {isLoadingFile ? (
          <div className="toolkit-empty-state">
            <Loader2 size={20} className="toolkit-spin" />
            <p>Reading pages and preparing previews...</p>
          </div>
        ) : null}

        {!isLoadingFile && !file ? (
          <div className="toolkit-empty-state">
            <h5>No PDF loaded yet</h5>
            <p>Upload a single PDF to preview every page, click cards to keep or exclude them, and export a selected-pages copy.</p>
          </div>
        ) : null}

        {!isLoadingFile && file ? (
          <div className="toolkit-split-page-grid">
            {pages.map((page) => (
              <article
                key={page.id}
                className={`toolkit-split-page-card${page.selected ? " toolkit-split-page-card-selected" : " toolkit-split-page-card-excluded"}`}
                role="checkbox"
                aria-checked={page.selected}
                tabIndex={0}
                onClick={() => togglePage(page.id)}
                onKeyDown={(event) => handleCardKeyDown(event, page.id)}
              >
                <div className="toolkit-rotate-page-card-top">
                  <div>
                    <div className="toolkit-detail-kicker">Page {page.pageNumber}</div>
                    <h5>{page.selected ? "Included" : "Excluded"}</h5>
                  </div>
                  <span className={`toolkit-rotate-page-badge${page.selected ? " toolkit-split-page-badge-selected" : ""}`}>
                    {page.selected ? "Selected" : "Excluded"}
                  </span>
                </div>

                {pdfPreview ? (
                  <RotatePageThumbnail
                    pdf={pdfPreview}
                    pageNumber={page.pageNumber}
                    originalRotation={page.originalRotation}
                    rotation={page.originalRotation}
                  />
                ) : (
                  <div className="toolkit-rotate-page-preview" aria-hidden="true">
                    <div className="toolkit-rotate-preview-state">
                      <strong>Preview unavailable</strong>
                      <span>This page could not be rendered.</span>
                    </div>
                  </div>
                )}

                <div className="toolkit-split-page-meta">
                  <span>{page.selected ? "Included in export" : "Skipped from export"}</span>
                  <span>Click the card to toggle this page.</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <aside className="toolkit-split-sidebar">
        <div className="toolkit-merge-status-row toolkit-merge-status-column">
          <div className="toolkit-merge-stat-card">
            <span>Total pages</span>
            <strong>{pages.length}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>Selected pages</span>
            <strong>{selectedCount}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>Selection mode</span>
            <strong>{file ? selectionMode : "Waiting for PDF"}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>File status</span>
            <strong>{isLoadingFile ? "Loading..." : file ? file.name : "Waiting for PDF"}</strong>
          </div>
        </div>

        <details className="toolkit-help-card" open>
          <summary>How split works</summary>
          <div className="toolkit-help-content">
            <p>Pick the pages you want to keep, then export one new PDF in the original order. Nothing is uploaded anywhere.</p>
            <ul>
              <li>Click any page card to include or exclude it.</li>
              <li>Use odd, even, or range selection for faster batching.</li>
              <li>Export creates one selected-pages PDF locally in your browser.</li>
            </ul>
          </div>
        </details>
      </aside>
    </div>
  );
}
