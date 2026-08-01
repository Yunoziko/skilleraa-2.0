import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import {
  PORTFOLIO_ACCEPT,
  RESUME_ACCEPT,
  filenameFromPath,
  uploadProfileFile,
  validateUploadFile,
} from "@/lib/storageService";

/**
 * Existing-UI-friendly uploader: label, button, filename preview, progress bar.
 */
export default function FileUploadField({
  kind = "resume",
  label,
  currentPath,
  currentFilename,
  onUploaded,
  disabled,
  testid,
}) {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [localName, setLocalName] = useState("");

  const preview =
    localName ||
    currentFilename ||
    filenameFromPath(currentPath) ||
    "";

  const accept = kind === "resume" ? RESUME_ACCEPT : PORTFOLIO_ACCEPT;
  const hint =
    kind === "resume"
      ? "PDF only · max 10 MB"
      : "PDF, ZIP, PNG, JPG · max 50 MB";

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validation = validateUploadFile(file, kind);
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setLocalName(file.name);
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadProfileFile(file, kind, setProgress);
      onUploaded?.(result);
    } catch (err) {
      setError(err?.message || "Upload failed");
      setLocalName("");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid={testid || `upload-${kind}`}>
      <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
        {label}
      </label>
      <div className="mt-2 border skl-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-black text-white rounded-full px-4 py-2 text-sm hover:bg-black/90 disabled:opacity-60"
            data-testid={`${kind}-upload-btn`}
          >
            <Upload size={14} aria-hidden />
            {uploading
              ? "Uploading…"
              : currentPath || preview
                ? `Replace ${kind === "resume" ? "resume" : "portfolio"}`
                : `Upload ${kind === "resume" ? "resume" : "portfolio"}`}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={onPick}
            data-testid={`${kind}-file-input`}
          />
          <span className="text-xs text-neutral-500">{hint}</span>
        </div>

        {preview ? (
          <div
            className="mt-3 flex items-center gap-2 text-sm text-neutral-700"
            data-testid={`${kind}-filename`}
          >
            <FileText size={14} className="text-neutral-400 shrink-0" aria-hidden />
            <span className="truncate">{preview}</span>
          </div>
        ) : (
          <p className="mt-3 text-xs text-neutral-400">No file uploaded yet.</p>
        )}

        {uploading && (
          <div className="mt-3" data-testid={`${kind}-progress`}>
            <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full bg-black transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-neutral-500 font-semibold">
              {progress}%
            </div>
          </div>
        )}

        {error && (
          <div
            className="mt-3 text-sm border skl-border rounded-lg px-3 py-2 bg-neutral-50"
            data-testid={`${kind}-upload-error`}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
