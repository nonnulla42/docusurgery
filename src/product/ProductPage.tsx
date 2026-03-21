import { Link } from 'react-router-dom';
import '../ocr/styles.css';
import { usePageSeo } from "../shared/usePageSeo";

type ProductFeature = [title: string, description: string];
type ProductStep = [number: string, title: string, description: string];
type ProductInfoSection = [title: string, description: string];

interface ProductPageProps {
  title: string;
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  canonicalPath: string;
  ctaLabel: string;
  ctaHref: string;
  ctaKind?: 'anchor' | 'route';
  trustBody: React.ReactNode;
  trustNote: string;
  features: ProductFeature[];
  steps: ProductStep[];
  infoSections?: ProductInfoSection[];
  infoSectionTitle?: string;
  toolSectionTitle?: string;
  children?: React.ReactNode;
}

export function ProductPage({
  title,
  description,
  seoTitle,
  seoDescription,
  canonicalPath,
  ctaLabel,
  ctaHref,
  ctaKind = 'anchor',
  trustBody,
  trustNote,
  features,
  steps,
  infoSections,
  infoSectionTitle = "Best for",
  toolSectionTitle,
  children,
}: ProductPageProps) {
  usePageSeo({
    title: seoTitle ?? `${title} | Docusurgery`,
    description: seoDescription ?? description,
    path: canonicalPath,
  });

  const cta =
    ctaKind === 'route' ? (
      <Link to={ctaHref} className="btn btn-primary hero-cta">
        {ctaLabel}
      </Link>
    ) : (
      <a href={ctaHref} className="btn btn-primary hero-cta">
        {ctaLabel}
      </a>
    );

  return (
    <>
      <nav>
        <div className="nav-content">
          <Link to="/" className="logo">
            Docusurgery
          </Link>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            {children ? <a href="#tool">Tool</a> : null}
          </div>
        </div>
      </nav>

      <header className="hero">
        <h1>{title}</h1>
        <p>{description}</p>
        {cta}
      </header>

      <section className="section trust-section">
        <div className="trust-content">
          <p>{trustBody}</p>
          <p className="trust-note">{trustNote}</p>
        </div>
      </section>

      {infoSections?.length ? (
        <section className="section">
          <h2 className="section-title">{infoSectionTitle}</h2>
          <div className="features-grid">
            {infoSections.map(([infoTitle, infoDescription]) => (
              <article key={infoTitle} className="feature-card">
                <h3>{infoTitle}</h3>
                <p>{infoDescription}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section" id="features">
        <h2 className="section-title">Features</h2>
        <div className="features-grid">
          {features.map(([featureTitle, featureDescription]) => (
            <article key={featureTitle} className="feature-card">
              <h3>{featureTitle}</h3>
              <p>{featureDescription}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="how-it-works">
        <h2 className="section-title">How it works</h2>
        <div className="how-it-works">
          {steps.map(([number, stepTitle, stepDescription]) => (
            <article key={number} className="step">
              <div className="step-num">{number}</div>
              <h4 className="step-title">{stepTitle}</h4>
              <p className="step-copy">{stepDescription}</p>
            </article>
          ))}
        </div>
      </section>

      {children ? (
        <section className="tool-section" id="tool">
          {toolSectionTitle ? <div className="section-title">{toolSectionTitle}</div> : null}
          {children}
        </section>
      ) : null}

      <footer>
        <div className="footer-content">
          <span className="footer-logo">Docusurgery</span>
          <p className="footer-text">Local-first PDF and document tools for OCR review, timelines, visual fixes, and practical PDF workflows.</p>
          <p className="footer-text footer-muted">Built for scanned documents and browser-based processing.</p>
        </div>
      </footer>
    </>
  );
}

export default ProductPage;
