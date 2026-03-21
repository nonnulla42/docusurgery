import React, { useEffect, useRef, useState } from 'react';
import { pdfjsLib } from '../utils/pdfWorker';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { TimelineEntry } from '../types/timeline';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PdfCanvasProps {
  file: File;
  pageNumber: number;
  onPageChange: (page: number) => void;
  selectedEntry?: TimelineEntry | null;
  onDeselect?: () => void;
  zoom?: number;
}

export const PdfCanvas: React.FC<PdfCanvasProps> = ({ 
  file, 
  pageNumber, 
  onPageChange, 
  selectedEntry, 
  onDeselect,
  zoom = 1.5
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const renderTaskRef = useRef<any>(null);
  
  // Panning state
  const [isDragging, setIsDragging] = useState(false);
  const [isPannable, setIsPannable] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF document. The file might be corrupted or unsupported.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [file]);

  useEffect(() => {
    const renderPage = async () => {
      if (!pdf || !canvasRef.current) return;

      // Cancel previous render task if it exists
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        const page = await pdf.getPage(pageNumber);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Use devicePixelRatio for crisp rendering on high-DPI screens
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: zoom * dpr });

        // Set canvas dimensions to match the high-DPI viewport
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Set CSS dimensions to the actual zoom level (not including DPR)
        // This ensures the canvas grows/shrinks on screen as the user zooms
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (err: any) {
        if (err.name === 'RenderingCancelledException') {
          return;
        }
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdf, pageNumber, zoom]);

  // Check if content is pannable whenever zoom or pdf changes
  useEffect(() => {
    const checkPannable = () => {
      const container = canvasRef.current?.closest('.overflow-auto');
      if (container) {
        scrollContainerRef.current = container as HTMLElement;
        const hasOverflow = container.scrollWidth > container.clientWidth + 10 || 
                          container.scrollHeight > container.clientHeight + 10;
        setIsPannable(hasOverflow);
      }
    };

    // Small delay to ensure layout has updated
    const timer = setTimeout(checkPannable, 100);
    window.addEventListener('resize', checkPannable);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkPannable);
    };
  }, [zoom, pdf, pageNumber]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isPannable || !scrollContainerRef.current) return;
    
    setIsDragging(true);
    dragStartRef.current = {
      x: e.pageX,
      y: e.pageY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    
    e.preventDefault();
    const dx = e.pageX - dragStartRef.current.x;
    const dy = e.pageY - dragStartRef.current.y;
    
    scrollContainerRef.current.scrollLeft = dragStartRef.current.scrollLeft - dx;
    scrollContainerRef.current.scrollTop = dragStartRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-12 text-red-300">
        <AlertCircle size={48} className="mb-4" />
        <p className="font-semibold text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Selected Event Info Bar */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex w-full items-start gap-3 rounded-lg border border-white/10 bg-white/6 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
          >
            <div className="mt-0.5 shrink-0 rounded-md bg-[#6b7cff]/15 p-1.5 text-[#9aa6ff]">
              <AlertCircle size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#9aa6ff]">Selected Event</span>
                <span className="text-[10px] font-bold uppercase text-white/45">Page {selectedEntry.pageNumber}</span>
              </div>
              <p className="text-xs font-medium leading-relaxed text-white/82">
                {selectedEntry.snippet}
              </p>
            </div>
            {onDeselect && (
              <button 
                onClick={onDeselect}
                className="rounded-full p-1 text-white/45 transition-colors hover:bg-white/8 hover:text-white/88"
                title="Clear Selection"
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky top-0 z-20 mb-6 flex w-full items-center justify-between rounded-t-lg border-b border-white/8 bg-[#0c1120]/88 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            disabled={pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)}
            className="rounded-full border border-white/8 bg-white/5 p-2 text-white/72 transition-colors hover:bg-white/8 disabled:opacity-30"
            title="Previous Page"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="min-w-[100px] text-center text-sm font-bold text-white/82">
            Page {pageNumber} of {numPages || '?'}
          </span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => onPageChange(pageNumber + 1)}
            className="rounded-full border border-white/8 bg-white/5 p-2 text-white/72 transition-colors hover:bg-white/8 disabled:opacity-30"
            title="Next Page"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/45">
          Canvas Renderer
        </div>
      </div>

      <div 
        ref={pageContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={cn(
          "relative mb-8 select-none rounded-lg border border-white/8 bg-white/4 shadow-xl transition-shadow",
          isPannable ? (isDragging ? "cursor-grabbing shadow-2xl" : "cursor-grab hover:shadow-2xl") : "cursor-default"
        )}
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#060a12]/78">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-[#8fa0ff]" size={40} />
              <span className="text-sm font-medium text-white/55">Loading PDF...</span>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="block rounded-b-lg shadow-sm" />
      </div>
    </div>
  );
};
