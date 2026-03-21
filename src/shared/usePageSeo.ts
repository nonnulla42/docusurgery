import { useEffect } from "react";

const SITE_NAME = "Docusurgery";
const SITE_URL = "https://docusurgery.com";

type SeoOptions = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
};

function upsertMeta(selector: string, attributeName: string, attributeValue: string, content: string) {
  const existing = document.head.querySelector(selector) as HTMLMetaElement | null;
  const meta = existing ?? document.createElement("meta");
  const previous = existing?.getAttribute("content") ?? null;

  meta.setAttribute(attributeName, attributeValue);
  meta.setAttribute("content", content);

  if (!existing) {
    document.head.appendChild(meta);
  }

  return () => {
    if (existing) {
      if (previous !== null) {
        existing.setAttribute("content", previous);
      }
    } else {
      meta.remove();
    }
  };
}

function upsertCanonical(href: string) {
  const existing = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  const link = existing ?? document.createElement("link");
  const previousHref = existing?.getAttribute("href") ?? null;

  link.setAttribute("rel", "canonical");
  link.setAttribute("href", href);

  if (!existing) {
    document.head.appendChild(link);
  }

  return () => {
    if (existing) {
      if (previousHref !== null) {
        existing.setAttribute("href", previousHref);
      }
    } else {
      link.remove();
    }
  };
}

export function usePageSeo({ title, description, path, type = "website" }: SeoOptions) {
  useEffect(() => {
    const previousTitle = document.title;
    const canonicalUrl = new URL(path, SITE_URL).toString();
    const cleanupMeta = [
      upsertMeta('meta[name="description"]', "name", "description", description),
      upsertMeta('meta[property="og:title"]', "property", "og:title", title),
      upsertMeta('meta[property="og:description"]', "property", "og:description", description),
      upsertMeta('meta[property="og:type"]', "property", "og:type", type),
      upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl),
      upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", SITE_NAME),
      upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary"),
    ];
    const cleanupCanonical = upsertCanonical(canonicalUrl);

    document.title = title;

    return () => {
      document.title = previousTitle;
      cleanupMeta.forEach((cleanup) => cleanup());
      cleanupCanonical();
    };
  }, [description, path, title, type]);
}
