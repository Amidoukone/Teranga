// frontend/src/components/SetSeo.jsx
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const SITE_NAME = "Teranga";

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
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const defaultTitle = t("seo.defaultTitle");
    const defaultDescription = t("seo.defaultDescription");
    const finalTitle = title ? `${title} – ${SITE_NAME}` : defaultTitle;
    const finalDescription = description || defaultDescription;

    document.title = finalTitle;

    setOrCreateMeta('meta[name="description"]', "content", finalDescription);
    setOrCreateMeta('meta[property="og:title"]', "content", finalTitle);
    setOrCreateMeta('meta[property="og:description"]', "content", finalDescription);
    setOrCreateMeta('meta[name="twitter:title"]', "content", finalTitle);
    setOrCreateMeta('meta[name="twitter:description"]', "content", finalDescription);
  }, [title, description, t, i18n.language]);

  return null;
}
