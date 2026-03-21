import ProductPage from "../product/ProductPage";
import "../ocr/styles.css";
import "./styles.css";
import { PdfToolkit } from "./pages/PdfToolkit";

const features: Array<[string, string]> = [
  ["Shared PDF utility hub", "Keep merge, split, rotate, and image conversion flows grouped inside one coherent toolkit module."],
  ["Fast internal mode switching", "Move between utility modes instantly from one page without breaking the surrounding workflow."],
  ["Local-first document handling", "Prepare intake PDFs and small file fixes without sending sensitive material to a server."],
  ["Consistent suite styling", "Matches the same dark-shell language already used across Patch, Timeline, and OCR."],
  ["Practical browser-based actions", "Handle common PDF tasks without leaving the Docusurgery suite or reaching for a separate utility site."],
  ["Built for document prep", "Ideal for cleanup tasks that happen before deeper OCR, patching, or review work."],
];

const steps: Array<[string, string, string]> = [
  ["1", "Choose a mode", "Open the toolkit and jump into merge, split, rotate, or image conversion from one page."],
  ["2", "Work locally", "Upload files, review pages or images visually, and make the document changes you need directly in the browser."],
  ["3", "Export cleanly", "Download the updated PDF and move into OCR review, timeline extraction, or the rest of your document workflow."],
];

export function ToolkitLandingPage() {
  return (
    <ProductPage
      title="PDF Toolkit for merge, split, rotate, and image conversion"
      description="Use Docusurgery PDF Toolkit to merge PDFs, split pages, rotate scanned files, and convert images to PDF locally in the browser."
      seoTitle="PDF Toolkit for Merge, Split, Rotate, and Convert PDFs | Docusurgery"
      seoDescription="Merge PDFs, split selected pages, rotate scans, and convert images to PDF locally in your browser with Docusurgery PDF Toolkit."
      canonicalPath="/toolkit"
      ctaLabel="Open the PDF Toolkit"
      ctaHref="/toolkit/app"
      ctaKind="route"
      trustBody={
        <>
          <strong>Docusurgery PDF Toolkit</strong> gives the suite a clean place for the smaller but essential document prep actions
          that happen around core review work.
        </>
      }
      trustNote="Built for practical browser-based PDF tasks such as merge, split, rotate, and image-to-PDF conversion."
      features={features}
      steps={steps}
      infoSectionTitle="Useful for"
      infoSections={[
        ["Document prep before OCR or review", "Merge related files, split out selected pages, rotate sideways scans, and convert phone captures into PDFs before deeper analysis."],
        ["Local-first PDF utility work", "Handle practical PDF tasks in the browser without sending sensitive documents to an external service."],
      ]}
    />
  );
}

export { PdfToolkit };
