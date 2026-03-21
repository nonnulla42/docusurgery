import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, GripVertical, Loader2, RotateCcw, RotateCw, Trash2, Upload } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";
import type { ImagePdfFitMode, ImagePdfItem, ImagePdfMargin, ImagePdfPageSize } from "../types/toolkit";
import { exportImagesToPdf, isSupportedImageFile, loadImageDimensions, stepImageRotation } from "../utils/pdfImages";

function createImageItemId() {
  return `image-pdf-${Math.random().toString(36).slice(2, 10)}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function insertItemAtIndex(items: ImagePdfItem[], draggedId: string, targetIndex: number) {
  const fromIndex = items.findIndex((item) => item.id === draggedId);

  if (fromIndex === -1) {
    return items;
  }

  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  const normalizedIndex = Math.max(0, Math.min(targetIndex, nextItems.length));
  nextItems.splice(normalizedIndex, 0, moved);
  return nextItems;
}

function moveItemByOffset(items: ImagePdfItem[], itemId: string, offset: number) {
  const fromIndex = items.findIndex((item) => item.id === itemId);

  if (fromIndex === -1) {
    return items;
  }

  const targetIndex = fromIndex + offset;

  if (targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [moved] = nextItems.splice(fromIndex, 1);
  nextItems.splice(targetIndex, 0, moved);
  return nextItems;
}

function getOutputFileName(items: ImagePdfItem[]) {
  const firstItem = items[0];

  if (!firstItem) {
    return "images-to-pdf.pdf";
  }

  const baseName = firstItem.file.name.replace(/\.[^.]+$/, "");
  return `${baseName || "images-to-pdf"}.pdf`;
}

function getPageSizeLabel(pageSize: ImagePdfPageSize) {
  if (pageSize === "a4-portrait") {
    return "A4 Portrait";
  }

  if (pageSize === "a4-landscape") {
    return "A4 Landscape";
  }

  return "Auto";
}

function getFitModeLabel(fitMode: ImagePdfFitMode) {
  return fitMode === "cover" ? "Cover" : "Contain";
}

function getMarginLabel(margin: ImagePdfMargin) {
  return margin === "small" ? "Small" : "None";
}

export function ImagesPdfWorkspace() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<ImagePdfItem[]>([]);
  const [items, setItems] = useState<ImagePdfItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dropPlacement, setDropPlacement] = useState<"before" | "after">("before");
  const [isExporting, setIsExporting] = useState(false);
  const [pageSize, setPageSize] = useState<ImagePdfPageSize>("auto");
  const [fitMode, setFitMode] = useState<ImagePdfFitMode>("contain");
  const [margin, setMargin] = useState<ImagePdfMargin>("none");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalImages = useMemo(() => items.length, [items]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const addFiles = async (incomingFiles: FileList | File[]) => {
    const fileArray = Array.from(incomingFiles);
    const imageFiles = fileArray.filter((file) => isSupportedImageFile(file));

    if (imageFiles.length === 0) {
      setError("Only JPG, PNG, and WEBP images are supported in Images to PDF.");
      return;
    }

    if (imageFiles.length !== fileArray.length) {
      setError("Some files were skipped because they are not supported image types.");
    } else {
      setError(null);
    }

    const nextItems: ImagePdfItem[] = [];

    for (const file of imageFiles) {
      try {
        const dimensions = await loadImageDimensions(file);
        nextItems.push({
          id: createImageItemId(),
          file,
          previewUrl: URL.createObjectURL(file),
          width: dimensions.width,
          height: dimensions.height,
          rotation: 0,
        });
      } catch {
        setError(`"${file.name}" could not be read as a valid image.`);
      }
    }

    if (nextItems.length > 0) {
      setItems((current) => [...current, ...nextItems]);
      setFeedback(`${nextItems.length} image${nextItems.length === 1 ? "" : "s"} added to the PDF queue.`);
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

  const removeItem = (itemId: string) => {
    setItems((current) => {
      const itemToRemove = current.find((item) => item.id === itemId);

      if (itemToRemove) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }

      return current.filter((item) => item.id !== itemId);
    });
    setFeedback(null);
    setError(null);
  };

  const clearAll = () => {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setItems([]);
    setFeedback(null);
    setError(null);
  };

  const reverseOrder = () => {
    setItems((current) => [...current].reverse());
    setFeedback("Image order reversed.");
    setError(null);
  };

  const rotateItem = (itemId: string, delta: number) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              rotation: stepImageRotation(item.rotation, delta),
            }
          : item,
      ),
    );
    setFeedback(null);
    setError(null);
  };

  const moveItem = (itemId: string, offset: number) => {
    setItems((current) => moveItemByOffset(current, itemId, offset));
    setFeedback(null);
    setError(null);
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, itemId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
    setDraggedId(itemId);
    setDropIndex(null);
    setDropPlacement("before");
  };

  const handleDropZoneDragOver = (event: DragEvent<HTMLElement>, index: number, placement: "before" | "after" = "before") => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (draggedId) {
      setDropIndex(index);
      setDropPlacement(placement);
    }
  };

  const handleDropIntoGrid = (event: DragEvent<HTMLElement>, index: number, placement: "before" | "after" = "before") => {
    event.preventDefault();

    const activeDraggedId = draggedId || event.dataTransfer.getData("text/plain");

    if (!activeDraggedId) {
      return;
    }

    const targetIndex = placement === "after" ? index + 1 : index;
    setItems((current) => insertItemAtIndex(current, activeDraggedId, targetIndex));
    setDraggedId(null);
    setDropIndex(null);
    setDropPlacement("before");
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDropIndex(null);
    setDropPlacement("before");
  };

  const handleCardDragOver = (event: DragEvent<HTMLElement>, index: number) => {
    const card = event.currentTarget.getBoundingClientRect();
    const midpoint = card.top + card.height / 2;
    const placement = event.clientY > midpoint ? "after" : "before";
    handleDropZoneDragOver(event, index, placement);
  };

  const exportPdf = async () => {
    if (items.length === 0 || isExporting) {
      return;
    }

    setIsExporting(true);
    setError(null);
    setFeedback(null);

    try {
      const bytes = await exportImagesToPdf(items, {
        pageSize,
        fitMode,
        margin,
      });
      const output = bytes.slice();
      const blob = new Blob([output.buffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const outputFileName = getOutputFileName(items);
      link.download = outputFileName;
      link.click();
      URL.revokeObjectURL(url);
      setFeedback(`Exported ${outputFileName} with ${items.length} image${items.length === 1 ? "" : "s"}.`);
    } catch (exportError: any) {
      setError(exportError?.message ?? "The PDF export failed. One of the selected images may be invalid.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="toolkit-images-layout">
      <div className="toolkit-images-shell">
        <div className="toolkit-merge-toolbar">
          <div>
            <div className="toolkit-detail-kicker">Images workflow</div>
            <h4 className="toolkit-merge-title">Turn multiple images into one clean PDF locally</h4>
            <p className="toolkit-merge-copy">Add JPG, PNG, or WEBP files, reorder them visually, rotate if needed, and export one PDF with one image per page.</p>
          </div>

          <div className="toolkit-merge-actions">
            <button type="button" className="toolkit-secondary-button" onClick={() => inputRef.current?.click()} disabled={isExporting}>
              <Upload size={16} />
              {items.length > 0 ? "Add images" : "Upload images"}
            </button>
            <button type="button" className="toolkit-primary-button" onClick={exportPdf} disabled={items.length === 0 || isExporting}>
              {isExporting ? <Loader2 size={16} className="toolkit-spin" /> : <Download size={16} />}
              {isExporting ? "Exporting..." : "Export PDF"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
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
          <strong>Drop images here or click to add them</strong>
          <span>JPG, PNG, and WEBP only. Everything is converted locally in your browser.</span>
        </div>

        <div className="toolkit-images-controls">
          <div className="toolkit-images-quick-actions">
            <button type="button" className="toolkit-secondary-button" onClick={() => inputRef.current?.click()} disabled={isExporting}>
              <Upload size={16} />
              Add images
            </button>
            <button type="button" className="toolkit-secondary-button" onClick={reverseOrder} disabled={items.length < 2 || isExporting}>
              Reverse order
            </button>
            <button type="button" className="toolkit-secondary-button" onClick={clearAll} disabled={items.length === 0 || isExporting}>
              Clear all
            </button>
          </div>

          <div className="toolkit-images-settings-grid">
            <label className="toolkit-images-setting">
              <span>Page size</span>
              <select value={pageSize} onChange={(event) => setPageSize(event.target.value as ImagePdfPageSize)} disabled={isExporting}>
                <option value="auto">Auto</option>
                <option value="a4-portrait">A4 Portrait</option>
                <option value="a4-landscape">A4 Landscape</option>
              </select>
            </label>

            <label className="toolkit-images-setting">
              <span>Fit mode</span>
              <select value={fitMode} onChange={(event) => setFitMode(event.target.value as ImagePdfFitMode)} disabled={isExporting}>
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
              </select>
            </label>

            <label className="toolkit-images-setting">
              <span>Margin</span>
              <select value={margin} onChange={(event) => setMargin(event.target.value as ImagePdfMargin)} disabled={isExporting}>
                <option value="none">None</option>
                <option value="small">Small</option>
              </select>
            </label>
          </div>
        </div>

        {feedback ? <div className="toolkit-feedback-banner toolkit-feedback-success">{feedback}</div> : null}
        {error ? <div className="toolkit-feedback-banner toolkit-feedback-error">{error}</div> : null}

        {items.length === 0 ? (
          <div className="toolkit-empty-state">
            <h5>No images loaded yet</h5>
            <p>Add one or more images to build a PDF. You can reorder, rotate, remove, and export them without sending anything to a server.</p>
          </div>
        ) : (
          <div className="toolkit-images-grid-shell">
            <div className="toolkit-merge-list-header">
              <div>
                <h5>Page order</h5>
                <p>Use the up and down arrows for quick ordering, or drag by the handle for larger rearrangements. Each image becomes one PDF page in the final export.</p>
              </div>
              <span className="toolkit-merge-list-note">{items.length} images</span>
            </div>

            <div className="toolkit-images-grid">
              {items.map((item, index) => (
                <div key={item.id} className="toolkit-images-grid-cell">
                  <div
                    className={`toolkit-drop-indicator toolkit-images-drop-indicator${
                      dropIndex === index && dropPlacement === "before" ? " toolkit-drop-indicator-active" : ""
                    }`}
                    onDragOver={(event) => handleDropZoneDragOver(event, index, "before")}
                    onDrop={(event) => handleDropIntoGrid(event, index, "before")}
                  />

                  <article
                    className={`toolkit-images-card${draggedId === item.id ? " toolkit-images-card-dragging" : ""}`}
                    draggable={!isExporting}
                    onDragStart={(event) => handleDragStart(event, item.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => handleCardDragOver(event, index)}
                    onDrop={(event) => handleDropIntoGrid(event, index, dropPlacement)}
                  >
                    <div className="toolkit-images-card-top">
                      <div className="toolkit-images-card-top-actions">
                        <span className="toolkit-merge-item-index">{index + 1}</span>
                        <div className="toolkit-images-order-buttons">
                          <button
                            type="button"
                            className="toolkit-icon-button"
                            onClick={() => moveItem(item.id, -1)}
                            disabled={index === 0 || isExporting}
                            aria-label={`Move ${item.file.name} earlier`}
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            type="button"
                            className="toolkit-icon-button"
                            onClick={() => moveItem(item.id, 1)}
                            disabled={index === items.length - 1 || isExporting}
                            aria-label={`Move ${item.file.name} later`}
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                        <span className="toolkit-drag-handle" aria-label={`Drag to reorder ${item.file.name}`}>
                          <GripVertical size={18} />
                        </span>
                      </div>

                      <button
                        type="button"
                        className="toolkit-icon-button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="toolkit-images-preview">
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        style={{
                          transform: `rotate(${item.rotation}deg)`,
                        }}
                      />
                    </div>

                    <div className="toolkit-images-card-body">
                      <strong>{item.file.name}</strong>
                      <span>
                        {item.width}×{item.height}px · {formatFileSize(item.file.size)}
                      </span>
                    </div>

                    <div className="toolkit-images-card-actions">
                      <button type="button" className="toolkit-secondary-button" onClick={() => rotateItem(item.id, -90)} disabled={isExporting}>
                        <RotateCcw size={16} />
                        Left
                      </button>
                      <button type="button" className="toolkit-secondary-button" onClick={() => rotateItem(item.id, 90)} disabled={isExporting}>
                        <RotateCw size={16} />
                        Right
                      </button>
                    </div>
                  </article>
                </div>
              ))}

              <div className="toolkit-images-grid-cell">
                <div
                  className={`toolkit-drop-indicator toolkit-images-drop-indicator${
                    dropIndex === items.length ? " toolkit-drop-indicator-active" : ""
                  }`}
                  onDragOver={(event) => handleDropZoneDragOver(event, items.length, "before")}
                  onDrop={(event) => handleDropIntoGrid(event, items.length, "before")}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="toolkit-images-sidebar">
        <div className="toolkit-merge-status-row toolkit-merge-status-column">
          <div className="toolkit-merge-stat-card">
            <span>Total images</span>
            <strong>{totalImages}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>Page size</span>
            <strong>{getPageSizeLabel(pageSize)}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>Fit mode</span>
            <strong>{getFitModeLabel(fitMode)}</strong>
          </div>
          <div className="toolkit-merge-stat-card">
            <span>Margin</span>
            <strong>{getMarginLabel(margin)}</strong>
          </div>
        </div>

        <details className="toolkit-help-card" open>
          <summary>How image conversion works</summary>
          <div className="toolkit-help-content">
            <p>Each image becomes its own PDF page. Reorder cards visually, rotate anything that was captured sideways, then export one combined PDF locally.</p>
            <ul>
              <li>Drag and drop to set page order.</li>
              <li>Use page size, fit, and margin controls before export.</li>
              <li>No images are uploaded to a server.</li>
            </ul>
          </div>
        </details>
      </aside>
    </div>
  );
}
