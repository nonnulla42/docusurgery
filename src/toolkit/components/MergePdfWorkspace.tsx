import { useMemo, useRef, useState } from "react";
import { Download, FileText, GripVertical, Loader2, Trash2, Upload } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import type { MergePdfItem } from "../types/toolkit";
import { getPdfPageCount, mergePdfFiles } from "../utils/pdfMerge";

function createMergeItemId() {
  return `merge-${Math.random().toString(36).slice(2, 10)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function insertItemAtIndex(items: MergePdfItem[], draggedId: string, targetIndex: number) {
  const fromIndex = items.findIndex((item) => item.id === draggedId);

  if (fromIndex === -1) {
    return items;
  }

  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  const normalizedIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
  nextItems.splice(normalizedIndex, 0, moved);
  return nextItems;
}

export function MergePdfWorkspace() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<MergePdfItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => items.reduce((sum, item) => sum + (item.pageCount ?? 0), 0),
    [items],
  );
  const canMerge = items.length >= 2 && !isMerging;

  const addFiles = async (incomingFiles: FileList | File[]) => {
    const fileArray = Array.from(incomingFiles);
    const pdfFiles = fileArray.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));

    if (pdfFiles.length === 0) {
      setError("Only PDF files are supported in Merge PDFs.");
      return;
    }

    if (pdfFiles.length !== fileArray.length) {
      setError("Some files were skipped because they are not PDFs.");
    } else {
      setError(null);
    }

    const nextItems: MergePdfItem[] = [];

    for (const file of pdfFiles) {
      try {
        const pageCount = await getPdfPageCount(file);
        nextItems.push({
          id: createMergeItemId(),
          file,
          pageCount,
        });
      } catch {
        setError(`"${file.name}" could not be opened as a valid PDF.`);
      }
    }

    if (nextItems.length > 0) {
      setItems((current) => [...current, ...nextItems]);
      setFeedback(`${nextItems.length} PDF${nextItems.length > 1 ? "s" : ""} added to the merge list.`);
    }
  };

  const handleFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    await addFiles(files);
    event.target.value = "";
  };

  const handleUploadDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    if (event.dataTransfer.files.length === 0) {
      return;
    }

    await addFiles(event.dataTransfer.files);
  };

  const handleMerge = async () => {
    if (!canMerge) {
      return;
    }

    setIsMerging(true);
    setError(null);
    setFeedback(null);

    try {
      const bytes = await mergePdfFiles(items.map((item) => item.file));
      const output = bytes.slice();
      const blob = new Blob([output.buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "merged.pdf";
      link.click();
      URL.revokeObjectURL(url);
      setFeedback(`Merged ${items.length} PDFs into merged.pdf.`);
    } catch {
      setError("The merge failed. One of the selected PDFs may be corrupted or locked.");
    } finally {
      setIsMerging(false);
    }
  };

  const removeItem = (itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setFeedback(null);
    setError(null);
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, itemId: string) => {
    event.dataTransfer.effectAllowed = "move";
    setDraggedId(itemId);
    setDropIndex(null);
  };

  const handleDropZoneDragOver = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();

    if (draggedId) {
      setDropIndex(index);
    }
  };

  const handleDropIntoList = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();

    if (!draggedId) {
      return;
    }

    setItems((current) => insertItemAtIndex(current, draggedId, index));
    setDraggedId(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDropIndex(null);
  };

  return (
    <div className="toolkit-merge-layout">
      <div className="toolkit-merge-shell">
        <div className="toolkit-merge-toolbar">
          <div>
            <div className="toolkit-detail-kicker">Merge workflow</div>
            <h4 className="toolkit-merge-title">Combine PDFs in the exact order shown below</h4>
            <p className="toolkit-merge-copy">Keep the first version focused: upload, reorder files cleanly, and export one merged PDF locally.</p>
          </div>

          <div className="toolkit-merge-actions">
            <button type="button" className="toolkit-secondary-button" onClick={() => inputRef.current?.click()}>
              <Upload size={16} />
              Add PDFs
            </button>
            <button type="button" className="toolkit-primary-button" onClick={handleMerge} disabled={!canMerge}>
              {isMerging ? <Loader2 size={16} className="toolkit-spin" /> : <Download size={16} />}
              {isMerging ? "Merging..." : "Merge PDFs"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="toolkit-hidden-input"
              onChange={handleFileInput}
            />
          </div>
        </div>

        <div
          className={`toolkit-upload-zone${isDragOver ? " toolkit-upload-zone-active" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleUploadDrop}
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
          <Upload size={22} />
          <strong>Drop PDF files here or click to add them</strong>
          <span>PDF only. Everything is processed locally in your browser.</span>
        </div>

        {feedback ? <div className="toolkit-feedback-banner toolkit-feedback-success">{feedback}</div> : null}
        {error ? <div className="toolkit-feedback-banner toolkit-feedback-error">{error}</div> : null}

        {items.length === 0 ? (
          <div className="toolkit-empty-state">
            <h5>No PDFs loaded yet</h5>
            <p>Add at least two PDF files to enable merging. The current order will become the final page order in the exported file.</p>
          </div>
        ) : (
          <div className="toolkit-merge-list-shell">
            <div className="toolkit-merge-list-header">
              <div>
                <h5>Merge order</h5>
                <p>Drag cards by the handle and use the drop guide to place each file where you want it.</p>
              </div>
              <span className="toolkit-merge-list-note">{items.length} files</span>
            </div>

            <ol className="toolkit-merge-list">
              {items.map((item, index) => (
                <li key={item.id} className="toolkit-merge-list-row">
                  <div
                    className={`toolkit-drop-indicator${dropIndex === index ? " toolkit-drop-indicator-active" : ""}`}
                    onDragOver={(event) => handleDropZoneDragOver(event, index)}
                    onDrop={(event) => handleDropIntoList(event, index)}
                  />

                  <div
                    className={`toolkit-merge-item${draggedId === item.id ? " toolkit-merge-item-dragging" : ""}`}
                    draggable
                    onDragStart={(event) => handleDragStart(event, item.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="toolkit-merge-item-order">
                      <span className="toolkit-merge-item-index">{index + 1}</span>
                      <span className="toolkit-drag-handle" aria-hidden="true">
                        <GripVertical size={18} />
                      </span>
                    </div>

                    <div className="toolkit-merge-item-icon" aria-hidden="true">
                      <FileText size={20} />
                    </div>

                    <div className="toolkit-merge-item-body">
                      <strong>{item.file.name}</strong>
                      <span>
                        {item.pageCount !== null ? `${item.pageCount} page${item.pageCount === 1 ? "" : "s"}` : "Page count unavailable"} ·{" "}
                        {formatFileSize(item.file.size)}
                      </span>
                    </div>

                    <div className="toolkit-merge-item-actions">
                      <span className="toolkit-merge-item-tag">Manage pages next</span>
                      <button
                        type="button"
                        className="toolkit-icon-button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              <li>
                <div
                  className={`toolkit-drop-indicator${dropIndex === items.length ? " toolkit-drop-indicator-active" : ""}`}
                  onDragOver={(event) => handleDropZoneDragOver(event, items.length)}
                  onDrop={(event) => handleDropIntoList(event, items.length)}
                />
              </li>
            </ol>
          </div>
        )}
      </div>

      <aside className="toolkit-merge-sidebar">
        <div className="toolkit-merge-status-row toolkit-merge-status-column">
          <div className="toolkit-merge-stat-card">
            <span>Files loaded</span>
            <strong>{items.length}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>Total pages</span>
            <strong>{totalPages}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>Merge status</span>
            <strong>{isMerging ? "Working..." : canMerge ? "Ready" : "Need 2 PDFs"}</strong>
          </div>
        </div>

        <details className="toolkit-help-card">
          <summary>How merge works</summary>
          <div className="toolkit-help-content">
            <p>The file list order becomes the final document order. Page reordering inside a single PDF is intentionally not in this MVP yet.</p>
            <ul>
              <li>Add two or more PDFs.</li>
              <li>Drag file cards into the order you want.</li>
              <li>Export one merged PDF without sending files anywhere.</li>
            </ul>
          </div>
        </details>

        <div className="toolkit-help-card toolkit-roadmap-card">
          <h5>Next sensible upgrade</h5>
          <p>Add a per-file <strong>Manage pages</strong> action for page reordering and include/exclude control, without replacing this merge shell.</p>
        </div>
      </aside>
    </div>
  );
}
