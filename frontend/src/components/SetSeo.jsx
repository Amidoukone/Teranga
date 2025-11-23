// frontend/src/components/SetSeo.jsx
import { useEffect } from "react";

const DEFAULT_TITLE = "Teranga – Diaspora & Services";
const DEFAULT_DESCRIPTION =
  "Teranga — La plateforme qui rapproche la diaspora de son pays. Gérez vos biens et services même quand vous êtes loin.";

function setOrCreateMeta(selector, attr, value) {
  if (!value) return;
  let tag = document.querySelector(selector);

  if (!tag) {
    const match = selector.match(/meta\[(name|property)="([^"]+)"\]/);
    if (match) {
      const [, key, val] = match;
      tag = document.createElement("meta");
      tag.setAttribute(key, val);
      document.head.appendChild(tag);
    }
  }

  if (tag) tag.setAttribute(attr, value);
}

export default function SetSeo({ title, description }) {
  useEffect(() => {
    const finalTitle = title ? `${title} – Teranga` : DEFAULT_TITLE;
    const finalDescription = description || DEFAULT_DESCRIPTION;

    document.title = finalTitle;

    setOrCreateMeta('meta[name="description"]', "content", finalDescription);
    setOrCreateMeta('meta[property="og:title"]', "content", finalTitle);
    setOrCreateMeta('meta[property="og:description"]', "content", finalDescription);
    setOrCreateMeta('meta[name="twitter:title"]', "content", finalTitle);
    setOrCreateMeta('meta[name="twitter:description"]', "content", finalDescription);
  }, [title, description]);

  return null;
}
