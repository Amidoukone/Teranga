import { ChevronLeft, ChevronRight, X } from "lucide-react";

import Modal from "../ui/Modal";
import { propertyPhotoUrls } from "./PropertyPhotoCollage";

export default function PropertyGalleryModal({
  open,
  onClose,
  photos,
  title,
  activeIndex,
  onActiveIndexChange,
  t,
}) {
  const urls = propertyPhotoUrls(photos);
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(urls.length - 1, 0));
  const showNavigation = urls.length > 1;

  const move = (direction) => {
    if (!urls.length) return;
    onActiveIndexChange((safeIndex + direction + urls.length) % urls.length);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="property-gallery-title"
      className="max-w-5xl bg-slate-950 p-2 text-white sm:p-3"
    >
      <div className="flex items-center justify-between gap-3 px-2 pb-2">
        <div className="min-w-0">
          <h2 id="property-gallery-title" className="truncate text-sm font-semibold text-white">
            {title}
          </h2>
          <p className="text-xs text-slate-300">
            {t("propertyListingDetailPage.galleryCounter", {
              current: safeIndex + 1,
              total: urls.length,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
          aria-label={t("propertyListingDetailPage.closeGallery")}
        >
          <X size={21} />
        </button>
      </div>

      <div className="relative flex min-h-[45vh] items-center justify-center overflow-hidden rounded-2xl bg-black sm:min-h-[65vh]">
        {urls[safeIndex] ? (
          <img
            src={urls[safeIndex]}
            alt={t("propertyListingDetailPage.photoLabel", {
              current: safeIndex + 1,
              total: urls.length,
              title,
            })}
            className="max-h-[72vh] w-full object-contain"
          />
        ) : null}
        {showNavigation ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute left-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 sm:left-4"
              aria-label={t("propertyListingDetailPage.previousPhoto")}
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 sm:right-4"
              aria-label={t("propertyListingDetailPage.nextPhoto")}
            >
              <ChevronRight size={24} />
            </button>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
