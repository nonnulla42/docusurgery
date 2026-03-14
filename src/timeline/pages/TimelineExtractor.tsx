import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  Copy, 
  Search, 
  ArrowUpDown, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  FileDown,
  Clock,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { extractTimelineLocally } from '../services/extraction';
import type { TimelineEntry } from '../types/timeline';
import { groupEntriesByDate } from '../utils/dateParser';
import { PdfCanvas } from '../components/PdfCanvas';
import type { DocLanguage } from '../utils/dateContextClassifier';
import { pdfjsLib } from '../utils/pdfWorker';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function TimelineExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [baseBlobUrl, setBaseBlobUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const selectedEntry = entries.find(e => e.id === selectedEntryId);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Timeline Filters (Range-based)
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const [pageFrom, setPageFrom] = useState<string>('');
  const [pageTo, setPageTo] = useState<string>('');

  // Extraction Scope
  const [extractionMode, setExtractionMode] = useState<'entire' | 'range'>('entire');
  const [extractionStartPage, setExtractionStartPage] = useState<string>('1');
  const [extractionEndPage, setExtractionEndPage] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(0);
  const [pdfNaturalWidth, setPdfNaturalWidth] = useState<number>(0);
  const [docLanguage, setDocLanguage] = useState<DocLanguage>('auto');
  const [zoom, setZoom] = useState(1.25);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Image Panning state
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [isImagePannable, setIsImagePannable] = useState(false);
  const imageDragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewScrollContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (baseBlobUrl) URL.revokeObjectURL(baseBlobUrl);
    };
  }, [baseBlobUrl]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf' || selectedFile.type.startsWith('image/')) {
        if (baseBlobUrl) URL.revokeObjectURL(baseBlobUrl);
        
        const url = URL.createObjectURL(selectedFile);
        setFile(selectedFile);
        setBaseBlobUrl(url);
        setPreviewUrl(url);
        setEntries([]);
        setError(null);
        setSelectedEntryId(null);
        setCurrentPage(1);
        setYearFrom('');
        setYearTo('');
        setPageFrom('');
        setPageTo('');
        setExtractionMode('entire');
        setExtractionStartPage('1');
        setExtractionEndPage('');
        setIsInitialLoad(true);
        
        // Get total pages and natural width for validation and zoom
        try {
          if (selectedFile.type === 'application/pdf') {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            setNumPages(pdf.numPages);
            setExtractionEndPage(pdf.numPages.toString());
            
            const firstPage = await pdf.getPage(1);
            const viewport = firstPage.getViewport({ scale: 1.0 });
            setPdfNaturalWidth(viewport.width);
          } else {
            // Image
            const img = new Image();
            img.src = url;
            await new Promise((resolve) => {
              img.onload = () => {
                setPdfNaturalWidth(img.naturalWidth);
                setNumPages(1);
                resolve(null);
              };
            });
          }
        } catch (err) {
          console.error('Error loading file for metadata:', err);
          setNumPages(0);
          setPdfNaturalWidth(0);
        }
      } else {
        setError('Please upload a PDF or an image file.');
      }
    }
  };

  const processDocument = async () => {
    if (!file) return;
    
    // Validation for page range
    if (extractionMode === 'range') {
      const start = parseInt(extractionStartPage);
      const end = parseInt(extractionEndPage);
      if (isNaN(start) || isNaN(end) || start < 1 || end < start || end > numPages) {
        setError(`Invalid page range. Please select between 1 and ${numPages}.`);
        return;
      }
    }

    setIsProcessing(true);
    setError(null);

    try {
      const start = extractionMode === 'range' ? parseInt(extractionStartPage) : undefined;
      const end = extractionMode === 'range' ? parseInt(extractionEndPage) : undefined;
      const result = await extractTimelineLocally(file, start, end, docLanguage);
      setEntries(result.entries);
    } catch (err) {
      setError('Failed to process document locally. Please check the file format.');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredEntries = (entries || [])
    .filter(entry => {
      const matchesSearch = 
        entry.normalizedDate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.originalDate.toLowerCase().includes(searchQuery.toLowerCase());
      
      const year = parseInt(entry.normalizedDate.split('-')[0]);
      const fromY = yearFrom ? parseInt(yearFrom) : -Infinity;
      const toY = yearTo ? parseInt(yearTo) : Infinity;
      const matchesYear = year >= fromY && year <= toY;

      const fromP = pageFrom ? parseInt(pageFrom) : -Infinity;
      const toP = pageTo ? parseInt(pageTo) : Infinity;
      const matchesPage = entry.pageNumber >= fromP && entry.pageNumber <= toP;
      
      return matchesSearch && matchesYear && matchesPage;
    });

  const groupedEntries = groupEntriesByDate(filteredEntries).sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const handleEntryClick = (entry: TimelineEntry) => {
    if (selectedEntryId === entry.id) {
      setSelectedEntryId(null);
    } else {
      setSelectedEntryId(entry.id);
      setCurrentPage(entry.pageNumber);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Category', 'Original Text', 'Snippet', 'Page', 'Occurrences'];
    const rows = filteredEntries.map(e => [
      e.normalizedDate, 
      e.category,
      e.originalDate, 
      `"${e.snippet.replace(/"/g, '""')}"`, 
      e.pageNumber,
      e.occurrences || 1
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-${file?.name || 'export'}.csv`;
    link.click();
  };

  const exportToTXT = () => {
    const content = groupedEntries.map(group => {
      const groupHeader = `=== ${group.date} ===\n`;
      const groupEntries = group.entries.map(e => 
        `[Page ${e.pageNumber}] (Found as: ${e.originalDate})${e.occurrences && e.occurrences > 1 ? ` [Appears ${e.occurrences}x]` : ''}\nContext: ${e.snippet}\n`
      ).join('\n');
      return groupHeader + groupEntries;
    }).join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timeline-${file?.name || 'export'}.txt`;
    link.click();
  };

  const copyToClipboard = () => {
    const content = (filteredEntries || []).map(e => 
      `${e.normalizedDate}: ${e.snippet} (Page ${e.pageNumber})`
    ).join('\n');
    navigator.clipboard.writeText(content);
  };

  const handleFitWidth = () => {
    if (pdfNaturalWidth && previewScrollContainerRef.current) {
      const containerWidth = previewScrollContainerRef.current.clientWidth;
      // Account for padding (p-4 = 16px each side, p-8 = 32px each side)
      const padding = window.innerWidth >= 1024 ? 80 : 40;
      const availableWidth = containerWidth - padding;
      const fitZoom = availableWidth / pdfNaturalWidth;
      // Clamp zoom between 0.5 and 3
      const finalZoom = Math.min(3, Math.max(0.5, fitZoom));
      setZoom(finalZoom);
      return finalZoom;
    }
    return zoom;
  };

  // Auto-fit on initial load once natural width is known
  useEffect(() => {
    if (file && pdfNaturalWidth > 0 && isInitialLoad) {
      handleFitWidth();
      setIsInitialLoad(false);
    }
  }, [file, pdfNaturalWidth, isInitialLoad]);

  // Check if image is pannable
  useEffect(() => {
    const checkImagePannable = () => {
      const container = imageContainerRef.current?.closest('.overflow-auto');
      if (container) {
        const hasOverflow = container.scrollWidth > container.clientWidth + 10 || 
                          container.scrollHeight > container.clientHeight + 10;
        setIsImagePannable(hasOverflow);
      }
    };
    const timer = setTimeout(checkImagePannable, 100);
    window.addEventListener('resize', checkImagePannable);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkImagePannable);
    };
  }, [zoom, file, pdfNaturalWidth]);

  const handleImageMouseDown = (e: React.MouseEvent) => {
    const container = imageContainerRef.current?.closest('.overflow-auto') as HTMLElement;
    if (!isImagePannable || !container) return;
    
    setIsImageDragging(true);
    imageDragStartRef.current = {
      x: e.pageX,
      y: e.pageY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop
    };
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!isImageDragging) return;
    const container = imageContainerRef.current?.closest('.overflow-auto') as HTMLElement;
    if (!container) return;
    
    e.preventDefault();
    const dx = e.pageX - imageDragStartRef.current.x;
    const dy = e.pageY - imageDragStartRef.current.y;
    
    container.scrollLeft = imageDragStartRef.current.scrollLeft - dx;
    container.scrollTop = imageDragStartRef.current.scrollTop - dy;
  };

  const handleImageMouseUp = () => {
    setIsImageDragging(false);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
      {/* Header / Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Clock className="text-indigo-600" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Timeline Extractor</h1>
            <div className="flex items-center gap-1 text-gray-400">
              <ShieldCheck size={10} />
              <p className="text-[10px] font-medium uppercase tracking-wider">Private local processing</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {file && (
            <button 
              onClick={() => { 
                if (baseBlobUrl) URL.revokeObjectURL(baseBlobUrl);
                setFile(null); 
                setBaseBlobUrl(null);
                setEntries([]); 
                setPreviewUrl(null); 
                setSelectedEntryId(null); 
              }}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Reset
            </button>
          )}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm"
          >
            <Upload size={16} />
            {file ? 'Change File' : 'Upload Document'}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".pdf,image/*"
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Preview (Secondary Context) */}
        <div 
          ref={previewScrollContainerRef}
          className="w-full lg:w-[38%] bg-gray-200 overflow-auto flex flex-col items-center p-4 lg:p-8 relative border-r border-gray-300"
        >
          {!file ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md">
              <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6 text-gray-300">
                <FileText size={40} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No document selected</h2>
              <p className="text-gray-500 mb-8">Upload a PDF or image to start extracting dates and building your timeline locally.</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-all shadow-sm"
              >
                Select File
              </button>
            </div>
          ) : (
            <div className="w-full max-w-4xl bg-white shadow-2xl rounded-lg min-h-full flex flex-col">
              <div className="bg-gray-100 px-4 py-2 border-b border-gray-200 flex items-center justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider rounded-t-lg shrink-0">
                <div className="flex items-center gap-2 truncate max-w-[150px]">
                  <FileText size={12} />
                  <span className="truncate">{file.name}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-1.5 py-0.5">
                    <button 
                      onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                      className="hover:text-indigo-600 transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut size={12} />
                    </button>
                    <span className="min-w-[35px] text-center">{Math.round(zoom * 100)}%</span>
                    <button 
                      onClick={() => setZoom(prev => Math.min(4, prev + 0.25))}
                      className="hover:text-indigo-600 transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn size={12} />
                    </button>
                    <div className="w-px h-3 bg-gray-200 mx-1" />
                    <button 
                      onClick={handleFitWidth}
                      className="hover:text-indigo-600 transition-colors"
                      title="Fit to Width"
                    >
                      <Maximize size={12} />
                    </button>
                  </div>
                  {file.type === 'application/pdf' && <span>Page {currentPage} / {numPages}</span>}
                </div>
              </div>
              <div className="flex-1 w-full flex flex-col items-center overflow-auto bg-gray-100 p-4">
                {file.type === 'application/pdf' ? (
                  <PdfCanvas 
                    file={file} 
                    pageNumber={currentPage} 
                    onPageChange={setCurrentPage} 
                    selectedEntry={selectedEntry}
                    onDeselect={() => setSelectedEntryId(null)}
                    zoom={zoom}
                  />
                ) : (
                  <div 
                    ref={imageContainerRef}
                    onMouseDown={handleImageMouseDown}
                    onMouseMove={handleImageMouseMove}
                    onMouseUp={handleImageMouseUp}
                    onMouseLeave={handleImageMouseUp}
                    className={cn(
                      "flex flex-col items-center w-full py-4 select-none transition-shadow",
                      isImagePannable ? (isImageDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
                    )}
                  >
                    <img 
                      src={previewUrl || ''} 
                      alt="Preview" 
                      style={{ 
                        width: pdfNaturalWidth ? `${pdfNaturalWidth * zoom}px` : 'auto',
                        maxWidth: 'none'
                      }}
                      className={cn(
                        "h-auto rounded-lg shadow-xl",
                        isImagePannable && "shadow-2xl"
                      )}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Timeline Panel (Primary Workspace) */}
        <div className="flex-1 bg-white flex flex-col shadow-xl z-10 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-white sticky top-0 z-20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                Timeline Results
                {entries.length > 0 && (
                  <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                    {entries.length}
                  </span>
                )}
              </h2>
              
              <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-100">
                <button 
                  disabled={entries.length === 0}
                  onClick={copyToClipboard}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-500 hover:text-indigo-600 transition-all"
                  title="Copy List"
                >
                  <Copy size={14} />
                </button>
                <button 
                  disabled={entries.length === 0}
                  onClick={exportToCSV}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-500 hover:text-indigo-600 transition-all"
                  title="Export CSV"
                >
                  <FileDown size={14} />
                </button>
                <button 
                  disabled={entries.length === 0}
                  onClick={exportToTXT}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-500 hover:text-indigo-600 transition-all"
                  title="Export TXT"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                />
              </div>
              
              <button 
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100 transition-all font-bold text-[10px] shrink-0"
              >
                <ArrowUpDown size={12} />
                {sortOrder === 'asc' ? 'Oldest' : 'Newest'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Years</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number"
                      placeholder="From"
                      value={yearFrom}
                      onChange={(e) => setYearFrom(e.target.value)}
                      className="w-14 bg-gray-50 border border-gray-200 rounded-md px-1 py-0.5 text-[10px] text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="text-gray-300">-</span>
                    <input 
                      type="number"
                      placeholder="To"
                      value={yearTo}
                      onChange={(e) => setYearTo(e.target.value)}
                      className="w-14 bg-gray-50 border border-gray-200 rounded-md px-1 py-0.5 text-[10px] text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Pages</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number"
                      placeholder="From"
                      value={pageFrom}
                      onChange={(e) => setPageFrom(e.target.value)}
                      className="w-12 bg-gray-50 border border-gray-200 rounded-md px-1 py-0.5 text-[10px] text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="text-gray-300">-</span>
                    <input 
                      type="number"
                      placeholder="To"
                      value={pageTo}
                      onChange={(e) => setPageTo(e.target.value)}
                      className="w-12 bg-gray-50 border border-gray-200 rounded-md px-1 py-0.5 text-[10px] text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              </div>

              {entries.length > 0 && (
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tight">Personal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tight">Legal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tight">Generic</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gray-50/30 p-6">
            <div className="max-w-4xl mx-auto space-y-3">
            <AnimatePresence mode="popLayout">
              {isProcessing ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Loader2 className="animate-spin text-indigo-600 mb-4" size={32} />
                  <h3 className="font-bold text-gray-900 mb-1">Processing Locally</h3>
                  <p className="text-sm text-gray-500">Scanning document text and performing OCR if needed. This may take a moment...</p>
                </div>
              ) : groupedEntries.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                  {file ? (
                    <div className="w-full space-y-6">
                      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <AlertCircle size={32} className="mb-4 mx-auto opacity-20" />
                        <h3 className="text-gray-900 font-bold mb-2">Extraction Scope</h3>
                        <p className="text-xs text-gray-500 mb-6">Choose which pages to analyze for date extraction.</p>
                        
                        <div className="space-y-4 mb-8">
                          <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                            <input 
                              type="radio" 
                              name="scope" 
                              checked={extractionMode === 'entire'} 
                              onChange={() => setExtractionMode('entire')}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="text-left">
                              <p className="text-sm font-bold text-gray-900">Entire document</p>
                              <p className="text-[10px] text-gray-500">Process all {numPages} pages</p>
                            </div>
                          </label>

                          <div className={cn(
                            "p-3 rounded-xl border transition-all",
                            extractionMode === 'range' ? "border-indigo-200 bg-indigo-50/30" : "border-gray-100"
                          )}>
                            <label className="flex items-center gap-3 cursor-pointer mb-3">
                              <input 
                                type="radio" 
                                name="scope" 
                                checked={extractionMode === 'range'} 
                                onChange={() => setExtractionMode('range')}
                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                              />
                              <p className="text-sm font-bold text-gray-900">Page range</p>
                            </label>
                            
                            {extractionMode === 'range' && (
                              <div className="flex items-center gap-2 ml-7 animate-in fade-in slide-in-from-top-1">
                                <div className="flex-1">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase block mb-1">From</span>
                                  <input 
                                    type="number" 
                                    min="1"
                                    max={numPages}
                                    value={extractionStartPage}
                                    onChange={(e) => setExtractionStartPage(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                  />
                                </div>
                                <div className="flex-1">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase block mb-1">To</span>
                                  <input 
                                    type="number" 
                                    min="1"
                                    max={numPages}
                                    value={extractionEndPage}
                                    onChange={(e) => setExtractionEndPage(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-8 text-left">
                          <span className="text-[10px] font-bold text-gray-400 uppercase block mb-2 ml-1">Document Language</span>
                          <select 
                            value={docLanguage}
                            onChange={(e) => setDocLanguage(e.target.value as DocLanguage)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          >
                            <option value="auto">Auto (All Dictionaries)</option>
                            <option value="en">English</option>
                            <option value="it">Italian</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="es">Spanish</option>
                          </select>
                          <p className="text-[10px] text-gray-400 mt-1.5 ml-1 italic">
                            Used to improve date classification accuracy.
                          </p>
                        </div>

                        <button 
                          onClick={processDocument}
                          className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                        >
                          Extract Timeline
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm italic">Upload a file to see the timeline</p>
                  )}
                </div>
              ) : (
                groupedEntries.map((group, groupIdx) => (
                  <div key={group.date} className="space-y-2">
                    <div className="flex items-center gap-4 px-1">
                      <div className="h-px flex-1 bg-gray-200" />
                      <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">
                        {group.date}
                      </span>
                      <div className="h-px flex-1 bg-gray-200" />
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {group.entries.map((entry, idx) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: (groupIdx * 0.05) + (idx * 0.02) }}
                          onClick={() => handleEntryClick(entry)}
                          className={cn(
                            "bg-white p-4 rounded-xl border transition-all group cursor-pointer relative overflow-hidden",
                            selectedEntryId === entry.id 
                              ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/10" 
                              : "border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow-md"
                          )}
                        >
                          {/* Category Indicator */}
                          <div className={cn(
                            "absolute top-0 left-0 w-1.5 h-full",
                            entry.category === 'birth' ? "bg-blue-500" : 
                            entry.category === 'legal_reference' ? "bg-orange-400" : 
                            "bg-gray-200"
                          )} />

                          <div className="flex items-start justify-between mb-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "text-base font-black tracking-tight",
                                  selectedEntryId === entry.id ? "text-indigo-600" : "text-gray-900"
                                )}>
                                  {entry.originalDate}
                                </span>
                                {entry.category === 'birth' && (
                                  <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Personal
                                  </span>
                                )}
                                {entry.category === 'legal_reference' && (
                                  <span className="text-[9px] font-black bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    Legal
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {entry.occurrences && entry.occurrences > 1 && (
                                <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider" title="This event appears multiple times in the document">
                                  {entry.occurrences}x
                                </span>
                              )}
                              <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                P. {entry.pageNumber}
                              </span>
                              <div className="p-1 bg-gray-50 rounded group-hover:bg-indigo-50 transition-colors">
                                <ExternalLink size={12} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed font-medium line-clamp-3">
                            {entry.snippet}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>

      {error && (
        <div className="fixed bottom-6 right-6 bg-red-50 border border-red-200 p-4 rounded-xl shadow-lg flex items-center gap-3 max-w-md animate-in slide-in-from-bottom-4">
          <AlertCircle className="text-red-500 shrink-0" size={20} />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-auto">
            <ChevronRight size={16} className="rotate-90" />
          </button>
        </div>
      )}
    </div>
  );
}
