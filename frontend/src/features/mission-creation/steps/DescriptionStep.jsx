import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, X } from "lucide-react";

import VoiceNoteRecorder from "../VoiceNoteRecorder";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500";
const labelClass = "mb-1 block text-sm font-medium text-text-primary";

export default function DescriptionStep({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  photo,
  onPhotoChange,
  voiceNote,
  onVoiceNoteChange,
}) {
  const { t } = useTranslation();
  const [photoUrl, setPhotoUrl] = useState(null);
  useEffect(() => {
    if (!photo) { setPhotoUrl(null); return undefined; }
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-text-primary">
        {t("missionCreation.description.title")}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        {t("missionCreation.description.subtitle")}
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="mission-title" className={labelClass}>{t("missionCreation.description.titleLabel")}</label>
          <input
            id="mission-title"
            type="text"
            className={inputClass}
            placeholder={t("missionCreation.description.titlePlaceholder")}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
            minLength={3}
            maxLength={150}
          />
        </div>

        <details open={description || photo || voiceNote ? true : undefined} className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-text-secondary">{t("missionCreation.description.addDetails")}</summary>
        <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="mission-description" className={labelClass}>{t("missionCreation.description.descriptionLabel")}</label>
          <textarea
            id="mission-description"
            className={`${inputClass} min-h-[96px]`}
            placeholder={t("missionCreation.description.descriptionPlaceholder")}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            maxLength={2000}
          />
        </div>

        <div>
          <label className={labelClass}>{t("missionCreation.description.photoLabel")}</label>
          {photo ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-card p-2">
              <img
                src={photoUrl || undefined}
                alt={photo.name}
                className="h-14 w-14 rounded-lg object-cover"
              />
              <span className="flex-1 truncate text-sm text-text-secondary">{photo.name}</span>
              <button
                type="button"
                onClick={() => onPhotoChange(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-red-600 hover:bg-red-50"
                aria-label={t("missionCreation.description.removePhoto")}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface-main px-4 py-3 text-sm text-text-secondary hover:border-blue-400 hover:text-text-primary">
              <ImagePlus size={18} />
              {t("missionCreation.description.addPhoto")}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => onPhotoChange(e.target.files?.[0] || null)}
              />
            </label>
          )}
        </div>

        <VoiceNoteRecorder value={voiceNote} onChange={onVoiceNoteChange} />
        </div>
        </details>
      </div>
    </div>
  );
}
