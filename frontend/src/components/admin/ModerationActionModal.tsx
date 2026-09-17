import { useState } from 'react';

interface ModerationActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  targetName: string;
  actionLabel: string;
  danger?: boolean;
  requireReason?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Purpose: modal prompt for destructive or privileged operator actions with required reasons.
 */
export function ModerationActionModal({
  isOpen,
  title,
  description,
  targetName,
  actionLabel,
  danger = true,
  requireReason = true,
  isLoading = false,
  error = null,
  onConfirm,
  onClose,
}: ModerationActionModalProps) {
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireReason && reason.trim().length < 3) {
      setValidationError('Reason must be at least 3 characters.');
      return;
    }
    setValidationError(null);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch {
      // Error is reflected via props
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-pit-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg border border-metal-border bg-pit-grease p-6 shadow-beveled-panel">
        <div className="flex items-center justify-between border-b border-metal-border pb-3">
          <h3
            className={`font-display text-lg uppercase tracking-[0.16em] ${
              danger ? 'text-hazard-orange' : 'text-readout-bright'
            }`}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-sm text-readout-dim hover:text-readout-bright"
          >
            [ESC]
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="font-sans text-xs text-readout-dim leading-relaxed">
            {description} Target:{' '}
            <strong className="font-mono text-readout-bright">
              {targetName}
            </strong>
          </p>

          <div>
            <label
              htmlFor="mod-reason"
              className="block font-mono text-xs uppercase tracking-wider text-readout-muted mb-1"
            >
              Operator Reason {requireReason ? '(Required)' : '(Optional)'}
            </label>
            <textarea
              id="mod-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="Specify the reason for this action (audit trail recorded)..."
              className="w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright placeholder:text-readout-muted focus:border-hazard-orange focus:outline-none"
            />
            {validationError && (
              <p className="mt-1 font-mono text-[11px] text-hazard-orange">
                {validationError}
              </p>
            )}
            {error && (
              <p className="mt-1 font-mono text-[11px] text-hazard-orange">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-metal-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="border border-metal-border bg-pit-steel px-4 py-1.5 font-display text-xs uppercase tracking-wider text-readout-dim hover:text-readout-bright disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`border px-4 py-1.5 font-display text-xs uppercase tracking-wider transition disabled:opacity-50 ${
                danger
                  ? 'border-hazard-orange bg-hazard-orange text-pit-black font-bold hover:bg-hazard-stripe'
                  : 'border-neon-radio bg-neon-radio text-pit-black font-bold hover:opacity-90'
              }`}
            >
              {isLoading ? 'Processing...' : actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
