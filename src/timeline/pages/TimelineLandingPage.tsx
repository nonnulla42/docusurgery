import ProductPage from '../../product/ProductPage';

const features: Array<[string, string]> = [
  ['Date and event extraction', 'Pull timeline-ready dates, snippets, and event context from PDFs and scanned images in one pass.'],
  ['Private local processing', 'Keep document handling in the browser so sensitive case material stays on your machine.'],
  ['PDF and image upload', 'Start from native PDFs, scanned pages, or images without changing your existing intake flow.'],
  ['Page-aware review', 'Jump from extracted events back to the original page preview to verify timeline context quickly.'],
  ['Search, sort, and filter', 'Refine results by year, page range, or text query before exporting your working timeline.'],
  ['Export-ready output', 'Download CSV or TXT summaries for downstream review, case prep, or reporting workflows.'],
];

const steps: Array<[string, string, string]> = [
  ['1', 'Upload', 'Add a PDF or image and choose whether to process the full document or a page range.'],
  ['2', 'Extract', 'Run local date and event analysis to identify timeline candidates and group them chronologically.'],
  ['3', 'Review', 'Inspect events alongside the source document, filter results, and export the timeline when ready.'],
];

export function TimelineLandingPage() {
  return (
    <ProductPage
      title="Build document timelines with local, page-linked extraction"
      description="Upload a PDF or image, extract dates and events privately in the browser, and review each finding alongside the original source."
      seoTitle="Timeline Extractor for PDFs and Scanned Documents | Docusurgery"
      seoDescription="Extract dates and timeline events from PDFs and scanned documents, review each finding against the source page, and keep processing local in the browser."
      canonicalPath="/timeline"
      ctaLabel="Open the Timeline Tool"
      ctaHref="/timeline/app"
      ctaKind="route"
      trustBody={
        <>
          <strong>Docusurgery Timeline Extractor</strong> turns unstructured documents into a reviewable chronology without sending files to a server.
        </>
      }
      trustNote="Designed for private local processing, fast upload workflows, and source-linked event review."
      features={features}
      steps={steps}
      infoSectionTitle="Useful for"
      infoSections={[
        ["Chronologies from scanned records", "Turn scans, PDFs, reports, and case files into a reviewable timeline when dates are scattered across multiple pages."],
        ["Private browser-based review", "Keep documents local while extracting timeline candidates, checking page references, and exporting working chronology notes."],
      ]}
    />
  );
}

export default TimelineLandingPage;
