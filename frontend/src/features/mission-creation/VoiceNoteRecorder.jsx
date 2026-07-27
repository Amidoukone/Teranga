import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Square, Play, Pause, Trash2 } from "lucide-react";

// Note vocale optionnelle (docs/DEV_SPEC_TERANGA_v3.md section 4.1, étape 3). API MediaRecorder
// du navigateur — aucune dépendance npm. Dégradation gracieuse si l'API n'est pas disponible
// (navigateur ancien, contexte non sécurisé) : le composant se masque plutôt que de bloquer le
// reste du formulaire, même esprit que googleMapsLoader.js.

const PREFERRED_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mp4"];

function pickSupportedMimeType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return null;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || null;
}

function isRecordingSupported() {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator?.mediaDevices?.getUserMedia)
  );
}

/**
 * @param {object} props
 * @param {File|null} props.value
 * @param {(file: File|null) => void} props.onChange
 */
export default function VoiceNoteRecorder({ value, onChange }) {
  const { t } = useTranslation();
  const [supported] = useState(isRecordingSupported);
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (!supported) return null;

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || recorder.mimeType || "audio/webm" });
        const ext = (mimeType || recorder.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type });
        onChange(file);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (_err) {
      setError(t("missionCreation.description.voiceNote.permissionDenied"));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const removeRecording = () => {
    onChange(null);
    setPlaying(false);
  };

  return (
    <div className="rounded-xl border border-border bg-surface-card p-3">
      <p className="mb-2 text-xs font-medium text-text-secondary">
        {t("missionCreation.description.voiceNote.label")}
      </p>

      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}

      {!value ? (
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
            recording
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-border bg-surface-main text-text-secondary hover:text-text-primary"
          }`}
        >
          {recording ? <Square size={16} /> : <Mic size={16} />}
          {recording
            ? t("missionCreation.description.voiceNote.stop")
            : t("missionCreation.description.voiceNote.start")}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <audio
            ref={audioRef}
            src={previewUrl}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <button
            type="button"
            onClick={togglePlayback}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-main text-text-secondary hover:text-text-primary"
            aria-label={playing ? t("missionCreation.description.voiceNote.pause") : t("missionCreation.description.voiceNote.play")}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <span className="text-sm text-text-secondary">
            {t("missionCreation.description.voiceNote.recorded")}
          </span>
          <button
            type="button"
            onClick={removeRecording}
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-main text-red-600 hover:bg-red-50"
            aria-label={t("missionCreation.description.voiceNote.remove")}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
