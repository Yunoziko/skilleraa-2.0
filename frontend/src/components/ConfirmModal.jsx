import { motion, AnimatePresence } from "framer-motion";

/**
 * Lightweight confirm dialog matching Skilleraa black/white UI.
 */
export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="confirm-modal"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="relative w-full max-w-md bg-white border skl-border rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.12)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
          >
            <h2 id="confirm-modal-title" className="font-display text-2xl tracking-tighter font-medium">
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{description}</p>
            )}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-full border skl-border hover:bg-neutral-50 disabled:opacity-60"
                data-testid="confirm-modal-cancel"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-full bg-black text-white hover:bg-black/90 disabled:opacity-60"
                data-testid="confirm-modal-confirm"
              >
                {loading ? "Working…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
