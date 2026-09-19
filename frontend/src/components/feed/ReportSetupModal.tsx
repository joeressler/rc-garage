import { useEffect, useState, type FormEvent } from 'react';
import {
  apiCreateReport,
  type ReportReasonCode,
  type ReportTargetType,
} from '../../api/reports';
import { ApiError } from '../../api/http';
import { useAuthStore } from '../../stores/useAuthStore';

const REASON_OPTIONS: { value: ReportReasonCode; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Abuse' },
  { value: 'stolen_setup', label: 'Stolen setup' },
  { value: 'malware_link', label: 'Malware link' },
  { value: 'other', label: 'Other' },
];

export interface ReportTarget {
  targetType: ReportTargetType;
  targetId: string;
  label: string;
}

interface ReportSetupModalProps {
  open: boolean;
  target: ReportTarget | null;
  onClose: () => void;
}

/**
 * Purpose: collect a reasoned content report from an inspect overlay without leaving the pit-mat chrome.
 */
export function ReportSetupModal({ open, target, onClose }: ReportSetupModalProps) {
  const token = useAuthStore((state) => state.token);
  const [reasonCode, setReasonCode] = useState<ReportReasonCode>('spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open || !target) {
      return;
    }
    setReasonCode('spam');
    setDetails('');
    setError(null);
    setIsSubmitting(false);
    setSubmitted(false);
  }, [open, target?.targetId, target?.targetType]);

  if (!open || !target) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError('Sign in to file a report.');
      return;
    }
    if (reasonCode === 'other' && !details.trim()) {
      setError('Details are required when the reason is Other.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await apiCreateReport(
        {
          targetType: target.targetType,
          targetId: target.targetId,
          reasonCode,
          details: details.trim() || undefined,
        },
        token,
      );
      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.messages.join(' ') || err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Report failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-pit-black/80 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg border-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel">
        <div className="flex items-center justify-between border-b border-metal-border pb-3">
          <h2
            id="report-modal-title"
            className="font-display text-lg font-bold uppercase tracking-wider text-readout-bright"
          >
            {reportModalTitle(target.targetType)}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-sm text-readout-muted hover:text-readout-bright"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="mt-4 space-y-4">
            <p className="font-mono text-sm text-neon-radio">
              Report filed. Scrutineering will review the queue.
            </p>
            <div className="flex justify-end border-t border-metal-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="border border-hazard-orange bg-hazard-orange px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-pit-black"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-4">
            {error ? (
              <p className="border border-nitromethane/50 bg-nitromethane/10 p-2 font-mono text-xs text-nitromethane">
                {error}
              </p>
            ) : null}

            <div>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-readout-muted">
                Target
              </span>
              <p className="font-display text-sm font-bold text-readout-bright">{target.label}</p>
            </div>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
                Reason
              </span>
              <select
                value={reasonCode}
                onChange={(event) =>
                  setReasonCode(event.target.value as ReportReasonCode)
                }
                className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              >
                {REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-readout-muted">
                Details
              </span>
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={500}
                rows={4}
                className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </label>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-metal-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="border border-metal-border bg-pit-black px-4 py-2 font-mono text-xs uppercase tracking-wider text-readout-dim hover:text-readout-bright"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="border border-hazard-orange bg-hazard-orange px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-pit-black hover:bg-hazard-orange/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Filing…' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function reportModalTitle(targetType: ReportTargetType): string {
  if (targetType === 'user') {
    return 'Report Driver';
  }
  if (targetType === 'comment') {
    return 'Report Pit Note';
  }
  return 'Report Setup Sheet';
}
