import { useState, useRef } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Upload, FileText, X } from "lucide-react";

export default function ResumeUpload({ currentUrl, currentName, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const openPicker = () => inputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "png", "jpg", "jpeg"].includes(ext)) {
      toast.error("Only PDF, PNG, JPG allowed");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/upload?kind=resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Resume uploaded");
      onUploaded?.(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = async () => {
    try {
      await api.put("/profile", { resume_url: "", resume_filename: "" });
      onUploaded?.({ url: "", filename: "" });
      toast.success("Removed");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const backend = process.env.REACT_APP_BACKEND_URL;
  const token = typeof window !== "undefined" ? localStorage.getItem("skl_token") : null;

  return (
    <div>
      <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Resume</label>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFile}
        data-testid="resume-file-input"
      />

      {currentUrl ? (
        <div className="mt-2 flex items-center justify-between gap-3 border skl-border rounded-xl px-4 py-3" data-testid="resume-current">
          <a
            href={`${backend}${currentUrl}${token ? `?auth=${token}` : ""}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 min-w-0"
          >
            <FileText size={14} className="text-neutral-500 shrink-0" />
            <span className="text-sm truncate">{currentName || "Resume"}</span>
          </a>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openPicker}
              disabled={uploading}
              className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-white transition"
              data-testid="resume-replace-btn"
            >
              {uploading ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={clear}
              className="p-1.5 rounded-full border skl-border hover:bg-white"
              aria-label="Remove"
              data-testid="resume-remove-btn"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="mt-2 w-full border skl-border rounded-xl px-4 py-6 text-sm hover:bg-neutral-50 transition flex items-center justify-center gap-2 disabled:opacity-60"
          data-testid="resume-upload-btn"
        >
          <Upload size={14} />
          {uploading ? "Uploading…" : "Upload resume (PDF · max 5MB)"}
        </button>
      )}
    </div>
  );
}
