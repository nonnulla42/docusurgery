import React, { useEffect, useRef, useState, useMemo } from 'react';
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
      <div className="flex flex-col items-center justify-center p-12 text-red-500 bg-red-50 rounded-xl border border-red-100">
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
            className="w-full mb-4 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start gap-3 shadow-sm"
          >
            <div className="p-1.5 bg-indigo-100 rounded-md text-indigo-600 shrink-0 mt-0.5">
              <AlertCircle size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Selected Event</span>
                <span className="text-[10px] font-bold text-indigo-400 uppercase">Page {selectedEntry.pageNumber}</span>
              </div>
              <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                {selectedEntry.snippet}
              </p>
            </div>
            {onDeselect && (
              <button 
                onClick={onDeselect}
                className="p-1 hover:bg-indigo-200 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors"
                title="Clear Selection"
              >
                <X size={14} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200 w-full px-4 py-3 flex items-center justify-between mb-6 rounded-t-lg">
        <div className="flex items-center gap-4">
          <button
            disabled={pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 transition-colors"
            title="Previous Page"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-gray-700 min-w-[100px] text-center">
            Page {pageNumber} of {numPages || '?'}
          </span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => onPageChange(pageNumber + 1)}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30 transition-colors"
            title="Next Page"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
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
          "relative bg-white shadow-xl rounded-lg border border-gray-200 mb-8 select-none transition-shadow",
          isPannable ? (isDragging ? "cursor-grabbing shadow-2xl" : "cursor-grab hover:shadow-2xl") : "cursor-default"
        )}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
              <span className="text-sm font-medium text-gray-500">Loading PDF...</span>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="block rounded-b-lg shadow-sm" />
      </div>
    </div>
  );
};
