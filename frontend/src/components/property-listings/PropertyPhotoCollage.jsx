import { Home } from "lucide-react";

import { getFileUrl } from "../../services/api";

export function propertyPhotoUrls(photos = []) {
  if (!Array.isArray(photos)) return [];
  return photos
    .map((entry) => (typeof entry === "string" ? entry : entry?.url))
    .filter(Boolean)
    .map((path) => getFileUrl(path));
}

function cardTileClass(index, count) {
  if (count === 1) return "col-span-2 row-span-2";
  if (count === 2) return "row-span-2";
  if (count === 3 && index === 0) return "row-span-2";
  return "";
}

function detailTileClass(index) {
  if (index === 0) return "col-span-4 md:col-span-2 md:row-span-2";
  if (index === 1 || index === 2) return "col-span-2 md:col-span-1";
  return "hidden md:block";
}

export default function PropertyPhotoCollage({
  photos,
  title,
  variant = "card",
  onPhotoClick,
  photoCountLabel,
  photoLabel,
  className = "",
}) {
  const urls = propertyPhotoUrls(photos);
  const isDetail = variant === "detail";
  const visible = urls.slice(0, isDetail ? 5 : 4);

  if (!visible.length) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-main text-text-muted ${
          isDetail ? "aspect-[4/3] md:aspect-[2/1]" : "aspect-[4/3]"
        } ${className}`}
        aria-label={title}
      >
        <Home size={isDetail ? 44 : 30} />
      </div>
    );
  }

  const containerClass = isDetail
    ? "grid aspect-[4/3] grid-cols-4 grid-rows-2 gap-1 overflow-hidden bg-surface-main md:aspect-[2/1]"
    : "grid aspect-[4/3] grid-cols-2 grid-rows-2 gap-1 overflow-hidden bg-surface-main";

  const tile = (src, index) => {
    const tileClass = isDetail
      ? detailTileClass(index)
      : cardTileClass(index, visible.length);
    const image = (
      <>
        <img
          src={src}
          alt={onPhotoClick ? "" : index === 0 ? title : ""}
          className="h-full w-full object-cover transition duration-300 group-hover/photo:scale-[1.03]"
          loading={index === 0 ? "eager" : "lazy"}
        />
        {!isDetail && index === visible.length - 1 && photoCountLabel ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2.5 py-1 text-[0.7rem] font-semibold text-white backdrop-blur-sm">
            {photoCountLabel}
          </span>
        ) : null}
        {isDetail && index === 2 && photoCountLabel ? (
          <span className="absolute inset-x-2 bottom-2 rounded-full bg-slate-950/75 px-2.5 py-1 text-center text-[0.7rem] font-semibold text-white backdrop-blur-sm md:hidden">
            {photoCountLabel}
          </span>
        ) : null}
        {isDetail && index === visible.length - 1 && photoCountLabel ? (
          <span className="absolute inset-x-2 bottom-2 hidden rounded-full bg-slate-950/75 px-2.5 py-1 text-center text-[0.7rem] font-semibold text-white backdrop-blur-sm md:block">
            {photoCountLabel}
          </span>
        ) : null}
      </>
    );

    if (onPhotoClick) {
      return (
        <button
          key={`${src}-${index}`}
          type="button"
          onClick={() => onPhotoClick(index)}
          className={`group/photo relative min-h-0 min-w-0 overflow-hidden focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500 ${tileClass}`}
          aria-label={photoLabel ? photoLabel(index + 1, urls.length) : undefined}
        >
          {image}
        </button>
      );
    }

    return (
      <div key={`${src}-${index}`} className={`group/photo relative min-h-0 min-w-0 overflow-hidden ${tileClass}`}>
        {image}
      </div>
    );
  };

  return <div className={`${containerClass} ${className}`}>{visible.map(tile)}</div>;
}
