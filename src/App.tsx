import "./App.css"
import { Routes, Route, Link } from "react-router-dom"
import { OcrLandingPage, OcrWorkspacePage } from "./ocr/App"
import { PatchEditorPage, PatchLandingPage } from "./patch/App"
import { PdfToolkit, ToolkitLandingPage } from "./toolkit/App"
import { TimelineLandingPage } from "./timeline/pages/TimelineLandingPage"
import { TimelineExtractor } from "./timeline/pages/TimelineExtractor"
import { usePageSeo } from "./shared/usePageSeo"

const tools = [
  {
    name: "Visual PDF Fixer",
    description: "Cover text, insert signature images, and clean scanned PDFs locally",
    to: "/patch",
  },
  {
    name: "Timeline Extractor",
    description: "Find dates across complex documents",
    to: "/timeline",
  },
  {
    name: "OCR Confidence Viewer",
    description: "Inspect OCR recognition with precision",
    to: "/ocr",
  },
  {
    name: "PDF Toolkit",
    description: "Merge, split, rotate, and convert files from one shared utility hub",
    to: "/toolkit",
  },
]

function Home() {
  usePageSeo({
    title: "Free Online PDF Tools for Scanned Documents | Docusurgery",
    description: "Docusurgery is a local-first suite of PDF tools for scanned documents, OCR review, timeline extraction, visual PDF fixes, and practical browser-based PDF utilities.",
    path: "/",
  });

  return (
    <main className="home-shell">
      <div className="home-grid" aria-hidden="true" />
      <div className="home-glow" aria-hidden="true" />

      <section className="home-hero">
        <div className="home-eyebrow">Docusurgery Suite</div>
        <h1 className="home-title">Docusurgery</h1>
        <p className="home-subtitle">
          Local-first PDF tools for scanned documents, OCR review, timeline extraction, visual fixes, and practical browser-based PDF utilities.
          <br className="home-subtitle-break" />
          Review, correct, merge, split, rotate, and convert without cloud upload.
        </p>

        <Link to="/patch" className="home-primary-cta">
          Open the document toolkit
        </Link>

        <div className="home-tool-list">
          {tools.map((tool) => (
            <Link key={tool.name} to={tool.to} className="home-tool-card">
              <span className="home-tool-card-top">
                <span className="home-tool-name">{tool.name}</span>
                <span className="home-tool-arrow" aria-hidden="true">
                  ↗
                </span>
              </span>
              <span className="home-tool-description">{tool.description}</span>
              <span className="home-tool-action">Open product page</span>
            </Link>
          ))}
        </div>

        <p className="home-trust">
          No cloud upload <span aria-hidden="true">·</span> Local-first processing{" "}
          <span aria-hidden="true">·</span> Built for scanned document work
        </p>

        <div className="home-preview" aria-hidden="true">
          <div className="home-preview-frame">
            <div className="home-preview-header">
              <span />
              <span />
              <span />
            </div>
            <div className="home-preview-body">
              <div className="home-preview-column">
                <div className="home-line home-line-strong" />
                <div className="home-line" />
                <div className="home-line home-line-short" />
                <div className="home-line" />
              </div>
              <div className="home-preview-column">
                <div className="home-node" />
                <div className="home-node home-node-dim" />
                <div className="home-node" />
              </div>
              <div className="home-preview-column">
                <div className="home-line" />
                <div className="home-line home-line-short" />
                <div className="home-line" />
                <div className="home-line home-line-faint" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-info-section" aria-labelledby="home-overview-title">
        <div className="home-info-grid">
          <article className="home-info-card">
            <h2 id="home-overview-title">PDF tools built for scanned document workflows</h2>
            <p>Docusurgery groups together practical browser-based tools for OCR confidence review, timeline extraction, visual PDF correction, and day-to-day PDF tasks like merge, split, rotate, and image conversion.</p>
          </article>
          <article className="home-info-card">
            <h2>Local-first processing without cloud upload</h2>
            <p>The suite is designed for sensitive document work where files should stay on your machine whenever possible, including scanned records, forms, reports, intake packets, and mixed PDF/image evidence bundles.</p>
          </article>
        </div>
      </section>

      <footer className="home-footer">
        Private local processing tools for serious PDF and scanned document work
      </footer>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/patch" element={<PatchLandingPage />} />
      <Route path="/patch/app" element={<PatchEditorPage />} />
      <Route path="/timeline" element={<TimelineLandingPage />} />
      <Route path="/timeline/app" element={<TimelineExtractor />} />
      <Route path="/ocr" element={<OcrLandingPage />} />
      <Route path="/ocr/app" element={<OcrWorkspacePage />} />
      <Route path="/toolkit" element={<ToolkitLandingPage />} />
      <Route path="/toolkit/app" element={<PdfToolkit />} />
    </Routes>
  )
}

export default App
