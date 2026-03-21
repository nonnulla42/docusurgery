import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { ImagesPdfWorkspace } from "../components/ImagesPdfWorkspace";
import { MergePdfWorkspace } from "../components/MergePdfWorkspace";
import { RotatePdfWorkspace } from "../components/RotatePdfWorkspace";
import { SplitPdfWorkspace } from "../components/SplitPdfWorkspace";
import { ToolkitModeCard } from "../components/ToolkitModeCard";
import type { ToolkitMode } from "../types/toolkit";
import { toolkitModes } from "../utils/toolkitModes";
import { usePageSeo } from "../../shared/usePageSeo";
import "../styles.css";

export function PdfToolkit() {
  const [activeMode, setActiveMode] = useState<ToolkitMode>("merge");
  const currentMode = toolkitModes.find((mode) => mode.id === activeMode) ?? toolkitModes[0];

  usePageSeo({
    title: "PDF Toolkit Workspace | Docusurgery",
    description: "Merge PDFs, split selected pages, rotate scanned files, and convert images to PDF locally in your browser.",
    path: "/toolkit/app",
  });

  return (
    <div className="toolkit-workspace-page suite-app-shell">
      <nav className="suite-top-nav">
        <div className="nav-content suite-top-nav-inner">
          <Link to="/" className="logo">
            Docusurgery
          </Link>
          <div className="nav-links">
            <Link to="/toolkit">Overview</Link>
            <Link to="/toolkit/app">Tool</Link>
          </div>
        </div>
      </nav>

      <main className="suite-tool-page toolkit-tool-page">
        <div className="suite-tool-header">
          <div>
            <div className="suite-tool-kicker">PDF Toolkit</div>
            <h1 className="suite-tool-title">PDF utility workspace</h1>
            <p className="suite-tool-copy">
              Merge, split, rotate, and convert PDFs locally in one browser-based workspace built for practical document prep.
            </p>
          </div>
          <div className="suite-tool-actions">
            <Link to="/toolkit" className="suite-chip-button">
              Back to overview
            </Link>
          </div>
        </div>

        <section className="toolkit-hero-panel">
          <div className="toolkit-hero-copy">
            <span className="toolkit-hero-chip">
              <Sparkles size={16} />
              Local-first PDF utilities
            </span>
            <h2>One place for practical PDF cleanup and prep</h2>
            <p>
              Merge related files, split selected pages, rotate scans, and convert images into PDFs without leaving the browser or the rest of the Docusurgery suite.
            </p>
          </div>

          <div className="toolkit-hero-preview" aria-hidden="true">
            <div className="toolkit-preview-stack">
              <span />
              <span />
              <span />
            </div>
            <div className="toolkit-preview-accent">
              <ArrowRight size={18} />
            </div>
          </div>
        </section>

        <section className="suite-seo-panel">
          <div className="suite-seo-grid">
            <article className="suite-seo-card">
              <h2>What this tool does</h2>
              <p>PDF Toolkit handles practical document tasks such as merging files, splitting selected pages, rotating scans, and turning images into clean PDFs.</p>
            </article>
            <article className="suite-seo-card">
              <h2>Best for</h2>
              <p>Use it for scanned packets, intake files, attachments, and quick browser-based PDF cleanup before OCR review, timeline extraction, or manual correction.</p>
            </article>
          </div>
        </section>

        <section className="toolkit-mode-grid" aria-label="PDF toolkit modes">
          {toolkitModes.map((mode) => (
            <ToolkitModeCard key={mode.id} mode={mode} activeMode={activeMode} onSelect={setActiveMode} />
          ))}
        </section>

        <section className="toolkit-detail-panel">
          <div className="toolkit-detail-header">
            <div>
              <div className="toolkit-detail-kicker">Current mode</div>
              <h3>{currentMode.title}</h3>
              <p>{currentMode.description}</p>
            </div>
            <div className="toolkit-detail-badge">{currentMode.shortLabel}</div>
          </div>

          <div
            className={`toolkit-detail-content${
              activeMode === "merge" || activeMode === "rotate" || activeMode === "split" || activeMode === "images"
                ? " toolkit-detail-content-merge"
                : ""
            }`}
          >
            {activeMode === "merge" ? (
              <MergePdfWorkspace />
            ) : activeMode === "split" ? (
              <SplitPdfWorkspace />
            ) : activeMode === "rotate" ? (
              <RotatePdfWorkspace />
            ) : (
              <ImagesPdfWorkspace />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default PdfToolkit;
