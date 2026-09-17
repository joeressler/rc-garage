import { useMemo } from 'react';
import { computeSetupDiff } from '../../api/diff';
import type { SetupSettings } from '../../api/setups';
import { SideBySideSpecTable } from './SideBySideSpecTable';

interface ForkDiffInspectorModalProps {
  open: boolean;
  onClose: () => void;
  parentSettings: SetupSettings | null;
  currentSettings: SetupSettings;
  parentTitle?: string;
  currentTitle?: string;
}

/**
 * Purpose: render a beveled modal overlay with corner hex-rivets displaying the side-by-side mechanical diff against parent ancestor sheet.
 */
export function ForkDiffInspectorModal({
  open,
  onClose,
  parentSettings,
  currentSettings,
  parentTitle = 'Parent Ancestor Spec',
  currentTitle = 'Forked Chassis Spec',
}: ForkDiffInspectorModalProps) {
  const diff = useMemo(() => {
    if (!parentSettings) return null;
    return computeSetupDiff(parentSettings, currentSettings);
  }, [parentSettings, currentSettings]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fork-diff-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-pit-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hex Rivets */}
        <span className="hex-rivet left-2 top-2" />
        <span className="hex-rivet right-2 top-2" />
        <span className="hex-rivet bottom-2 left-2" />
        <span className="hex-rivet bottom-2 right-2" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-metal-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="border border-hazard-orange bg-pit-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-hazard-orange">
                Diagnostic Diff Inspector
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-readout-dim">
                Fork Telemetry Comparison
              </span>
            </div>
            <h2
              id="fork-diff-modal-title"
              className="mt-1 font-display text-2xl font-bold uppercase tracking-wider text-readout-bright"
            >
              Mechanical Lineage Deviations
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close diff modal"
            className="border border-metal-border bg-pit-black px-3 py-1 font-mono text-xs text-readout-muted hover:border-hazard-orange hover:text-hazard-orange"
          >
            ✕ Close
          </button>
        </div>

        {/* Diff Content */}
        <div className="mt-6">
          {!parentSettings ? (
            <div className="border border-metal-border bg-pit-black p-8 text-center font-mono text-xs text-hazard-orange">
              Parent setup telemetry sheet not loaded or unavailable.
            </div>
          ) : diff ? (
            <div>
              <div className="mb-4 flex items-center justify-between font-mono text-xs text-readout-dim">
                <span>
                  Total Deviations Detected:{' '}
                  <strong className="text-nitromethane">{diff.entries.length}</strong>
                </span>
                <span className="text-[10px] text-readout-muted">
                  Delta values highlighted in <span className="text-nitromethane font-bold">Nitromethane Pink</span>
                </span>
              </div>
              <SideBySideSpecTable
                entries={diff.entries}
                parentTitle={parentTitle}
                currentTitle={currentTitle}
              />
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex justify-end border-t border-metal-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-hazard-orange bg-hazard-orange px-6 py-2 font-display text-xs font-bold uppercase tracking-widest text-pit-black hover:bg-hazard-orange/90"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
}
