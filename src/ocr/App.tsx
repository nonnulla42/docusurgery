// @ts-nocheck
import { Link } from 'react-router-dom';
import ProductPage from '../product/ProductPage';
import { usePageSeo } from "../shared/usePageSeo";
import OcrConfidenceViewer from './components/OcrConfidenceViewer';
import './styles.css';

const features = [
  ['Confidence-based OCR review', 'See exactly where recognition may be uncertain with intuitive color-coded highlights.'],
  ['Artifact detection and cleaning', 'Remove decorative lines, ink noise and false words with a heuristic cleanup pass.'],
  ['Searchable PDF generation', 'Create invisible text layers aligned over scans for reliable search and selection.'],
  ['Clean text export', 'Download refined digital text in TXT or PDF format for downstream editing and archiving.'],
  ['Image to searchable PDF', 'Upload JPG, PNG, or scanned PDF files and turn them into structured searchable documents.'],
  ['Document analytics', 'Track word counts, low-confidence density, and page-by-page quality hotspots.'],
];

const steps = [
  ['1', 'Upload', 'Upload a scanned PDF or image from your computer.'],
  ['2', 'Review and clean', 'Inspect OCR confidence, lock real words, and remove scan artifacts.'],
  ['3', 'Export', 'Generate a searchable PDF, an annotated PDF, or clean extracted text.'],
];

export function OcrLandingPage() {
  return (
    <ProductPage
      title="Perform precision surgery on your scanned PDFs"
      description="Analyze OCR confidence, remove scan artifacts, and create reliable searchable documents."
      seoTitle="OCR Confidence Viewer for Scanned PDFs | Docusurgery"
      seoDescription="Inspect OCR quality in scanned PDFs and images, review low-confidence text, remove scan artifacts, and export cleaner searchable documents locally."
      canonicalPath="/ocr"
      ctaLabel="Start using the tool"
      ctaHref="/ocr/app"
      ctaKind="route"
      trustBody={
        <>
          Traditional OCR extracts text. <strong>Docusurgery</strong> helps you understand and refine it before exporting.
        </>
      }
      trustNote="Review recognition confidence word by word and clean unwanted scan noise."
      features={features}
      steps={steps}
      infoSectionTitle="Useful for"
      infoSections={[
        ["Scanned PDFs and intake packets", "Review OCR quality in scans, court records, forms, and document packets before relying on extracted text."],
        ["Local quality control before export", "Keep sensitive files in the browser while checking weak OCR zones, artifact noise, and searchable text output."],
      ]}
    />
  );
}

export function OcrWorkspacePage() {
  usePageSeo({
    title: "OCR Confidence Viewer Workspace | Docusurgery",
    description: "Upload scanned PDFs or images, inspect OCR confidence, and export searchable results locally in the browser.",
    path: "/ocr/app",
  });

  return (
    <div className="ocr-workspace-page suite-app-shell">
      <nav className="suite-top-nav">
        <div className="nav-content suite-top-nav-inner">
          <Link to="/" className="logo">
            Docusurgery
          </Link>
          <div className="nav-links">
            <Link to="/ocr">Overview</Link>
            <Link to="/ocr/app">Tool</Link>
          </div>
        </div>
      </nav>

      <main className="tool-section ocr-workspace-shell suite-tool-page">
        <div className="tool-shell-header suite-tool-header">
          <div>
            <div className="tool-shell-kicker suite-tool-kicker">OCR Workspace</div>
            <h1 className="tool-shell-title suite-tool-title">OCR Precision Tool</h1>
            <p className="tool-shell-copy suite-tool-copy">Upload a scanned PDF or image, inspect OCR confidence, and export cleaner searchable results locally.</p>
          </div>
          <Link to="/ocr" className="btn btn-secondary suite-chip-button">
            Back to overview
          </Link>
        </div>
        <section className="suite-seo-panel">
          <div className="suite-seo-grid">
            <article className="suite-seo-card">
              <h2>What this tool does</h2>
              <p>OCR Confidence Viewer highlights uncertain text in scanned PDFs and images so you can review recognition quality before exporting searchable files or extracted text.</p>
            </article>
            <article className="suite-seo-card">
              <h2>Best for</h2>
              <p>Use it for scans, intake packets, reports, forms, and other documents where local browser-based OCR review matters before downstream editing or archiving.</p>
            </article>
          </div>
        </section>
        <OcrConfidenceViewer />
      </main>
    </div>
  );
}

export default OcrLandingPage;
