import { h } from "preact";
import { useEffect, useRef } from "preact/hooks";

export interface VoiceUnenrollmentDialogProps {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function VoiceUnenrollmentDialog({
  open,
  busy,
  onCancel,
  onConfirm
}: VoiceUnenrollmentDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelButton.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div
      class="dialog-backdrop"
      data-testid="voice-unenrollment-backdrop"
      onClick={() => onCancel()}
    >
      <section
        class="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-unenrollment-title"
        aria-describedby="voice-unenrollment-description"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <p class="eyebrow">VOICE PROFILE</p>
        <h2 id="voice-unenrollment-title">Delete voice enrollment?</h2>
        <p id="voice-unenrollment-description">
          You will need to enroll your voice again before it can support audit voice checks.
        </p>
        <div class="dialog-actions">
          <button
            ref={cancelButton}
            class="secondary-button"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            class="primary-button"
            type="button"
            aria-label="Delete voice enrollment"
            disabled={busy}
            onClick={() => {
              if (!busy) onConfirm();
            }}
          >
            {busy ? "Deleting…" : "Delete voice enrollment"}
          </button>
        </div>
      </section>
    </div>
  );
}
