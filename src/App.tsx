import { Routes, Route, Link } from "react-router-dom"
import { TimelineExtractor } from "./timeline/pages/TimelineExtractor"

function Home() {
  return (
    <div style={wrap}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 48 }}>Docusurgery</h1>
        <p style={{ opacity: 0.7, marginBottom: 40 }}>
          Precision tools for document analysis
        </p>

        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          <Link to="/timeline" style={btn}>
            Timeline Extractor
          </Link>

          <Link to="/ocr" style={btn}>
            OCR Confidence Viewer
          </Link>
        </div>
      </div>
    </div>
  )
}

function TimelinePage() {
  return (
    <div style={wrap}>
      <h2>Timeline tool loading…</h2>
    </div>
  )
}

function OcrPage() {
  return (
    <div style={wrap}>
      <h2>OCR tool loading…</h2>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/timeline" element={<TimelineExtractor />} />
      <Route path="/ocr" element={<OcrPage />} />
    </Routes>
  )
}

const wrap = {
  minHeight: "100vh",
  background: "#0b0f19",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial"
}

const btn = {
  padding: "14px 22px",
  background: "#6c5ce7",
  borderRadius: 8,
  textDecoration: "none",
  color: "white",
  fontWeight: 600
}

export default App