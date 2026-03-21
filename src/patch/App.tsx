import ProductPage from "../product/ProductPage";
import "../ocr/styles.css";
import "./styles.css";
import { PatchEditorPage } from "./pages/PatchEditorPage";

const features: Array<[string, string]> = [
  ["Visual PDF corrections", "Cover printed text, fix form errors, and place replacement text anywhere on the page with independent patch and text layers."],
  ["Signature image insertion", "Import transparent PNG signatures or scanned signature images, place them visually on the page, and adjust opacity before export."],
  ["White background removal", "Clean white or light gray scan backgrounds from signatures, stamps, and handwriting overlays so they blend more naturally with the document."],
  ["Background-aware fill", "Each patch samples nearby page color so edits blend into scanned forms and flat document backgrounds more naturally."],
  ["Local PDF workflow", "Open, edit, clean, and export corrected PDFs in the browser without sending sensitive files to a server."],
  ["Visual signing only", "Signature images are graphical overlays for drafting and document correction workflows. They are not certified digital signatures and do not guarantee legal validity."],
];

const steps: Array<[string, string, string]> = [
  ["1", "Upload", "Open a PDF, choose the page you want to fix, and work directly in the browser on scanned forms or flat document pages."],
  ["2", "Fix visually", "Cover printed text, type replacement content, insert signature images, and optionally remove white scan backgrounds from signatures or stamps."],
  ["3", "Export locally", "Download a corrected PDF with visual patches, text overlays, and signature images flattened into the final page output."],
];

export function PatchLandingPage() {
  return (
    <ProductPage
      title="Visual PDF Fixer for covering text, fixing forms, inserting signatures, and cleaning scanned documents"
      description="Docusurgery Visual PDF Fixer is a practical browser-based PDF correction tool for covering printed text, fixing form errors, inserting signature images, and cleaning scanned documents locally."
      seoTitle="Visual PDF Fixer for Scanned Documents | Docusurgery"
      seoDescription="Cover printed text, add corrected text, insert signature images, and clean scanned PDF pages locally in your browser. Visual signatures are not certified digital signatures."
      canonicalPath="/patch"
      ctaLabel="Open Visual PDF Fixer"
      ctaHref="/patch/app"
      ctaKind="route"
      trustBody={
        <>
          <strong>Docusurgery Visual PDF Fixer</strong> is built for practical document correction workflows such as form cleanup, typo fixes, scanned signature placement, stamp cleanup, and page-level replacement text.
        </>
      }
      trustNote="Visual signature insertion is a graphical overlay workflow only. It is not a certified digital signature and does not guarantee legal validity."
      features={features}
      steps={steps}
      infoSectionTitle="Useful for"
      infoSections={[
        ["Form fixes and scanned document cleanup", "Cover printed text, replace incorrect values, and prepare cleaner page-level corrections on flat PDFs and scans."],
        ["Visual edits that stay local", "Patch PDFs, place signature images, and export corrected pages in the browser without sending documents to a cloud service."],
      ]}
    />
  );
}

export { PatchEditorPage };
