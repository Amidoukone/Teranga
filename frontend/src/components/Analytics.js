import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function Analytics({ trackingId }) {
  const location = useLocation();

  useEffect(() => {
    if (!trackingId || !window.gtag) return;

    window.gtag("event", "page_view", {
      page_title: document.title,
      page_path: location.pathname + location.search,
      page_location: window.location.href,
    });
  }, [location, trackingId]);

  return null;
}
