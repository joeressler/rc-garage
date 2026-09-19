import { CopyPublicLinkButton } from '../feed/CopyPublicLinkButton';
import { useSetupStore } from '../../stores/useSetupStore';

interface ClipboardActionBarProps {
  onPrintQr?: () => void;
  onForkSetup?: () => void;
  onRequestAuth?: () => void;
  isAuthenticated: boolean;
}

/**
 * Purpose: public/private toggle, save telemetry sheet primary CTA, print QR button, and status messages.
 */
export function ClipboardActionBar({
  onPrintQr,
  onForkSetup,
  onRequestAuth,
  isAuthenticated,
}: ClipboardActionBarProps) {
  const isSaving = useSetupStore((state) => state.isSaving);
  const isDirty = useSetupStore((state) => state.isDirty);
  const meta = useSetupStore((state) => state.meta);
  const updateMeta = useSetupStore((state) => state.updateMeta);
  const saveCurrentSetup = useSetupStore((state) => state.saveCurrentSetup);
  const activeSetup = useSetupStore((state) => state.activeSetup);
  const error = useSetupStore((state) => state.error);
  const validationErrors = useSetupStore((state) => state.validationErrors);
  const validationMessages = [...new Set(Object.values(validationErrors))];

  const hasSavedSlug = !!activeSetup?.qrSlug;

  const handleSave = async () => {
    if (!isAuthenticated) {
      onRequestAuth?.();
      return;
    }
    try {
      await saveCurrentSetup();
    } catch {
      // errors already updated in store
    }
  };

  return (
    <div className="relative mt-6 rounded-b border-b-4 border-l-2 border-r-2 border-metal-highlight bg-gradient-to-t from-pit-black via-pit-grease to-pit-steel p-4 shadow-beveled-panel sm:p-5">
      <span className="hex-rivet left-2 bottom-2" />
      <span className="hex-rivet right-2 bottom-2" />

      {error ? (
        <div className="mb-4 border border-hazard-stripe bg-pit-black p-3 font-mono text-xs text-hazard-orange">
          <p>{error}</p>
          {validationMessages.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Heavy-Duty Visibility Toggle */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-wider text-readout-dim">
            Sheet Visibility:
          </span>
          <button
            type="button"
            onClick={() => updateMeta({ isPublic: !meta.isPublic })}
            className={`flex items-center gap-2 border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition ${
              meta.isPublic
                ? 'border-neon-radio bg-pit-black text-neon-radio shadow-neon-glow'
                : 'border-metal-border bg-pit-black text-readout-dim'
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                meta.isPublic ? 'bg-neon-radio telemetry-beacon' : 'bg-metal-border'
              }`}
            />
            {meta.isPublic ? 'Public Sheet (Community Feed)' : 'Private Pits'}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {activeSetup?.qrSlug ? <CopyPublicLinkButton qrSlug={activeSetup.qrSlug} /> : null}

          {/* Secondary Action: Print Chassis QR */}
          {hasSavedSlug && onPrintQr ? (
            <button
              type="button"
              onClick={onPrintQr}
              className="border border-neon-radio bg-pit-black px-4 py-2.5 font-display text-xs uppercase tracking-[0.2em] text-neon-radio transition hover:bg-neon-radio hover:text-pit-black shadow-neon-glow"
            >
              Print Chassis QR
            </button>
          ) : null}

          {/* Optional: Fork Setup Modal Button */}
          {onForkSetup ? (
            <button
              type="button"
              onClick={onForkSetup}
              className="border border-nitromethane bg-pit-black px-4 py-2.5 font-display text-xs uppercase tracking-[0.2em] text-nitromethane transition hover:bg-nitromethane hover:text-pit-black"
            >
              Fork to My Garage
            </button>
          ) : null}

          {/* Primary Action: Save Telemetry Sheet */}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave()}
            className="bg-hazard-orange px-5 py-2.5 font-display text-sm uppercase tracking-[0.22em] text-pit-black shadow-hazard-glow transition hover:bg-hazard-stripe disabled:opacity-50"
          >
            {isSaving
              ? 'Transmitting Telemetry…'
              : !isAuthenticated
              ? 'Login to Save Sheet'
              : isDirty
              ? 'Save Telemetry Sheet *'
              : hasSavedSlug
              ? 'Telemetry Sheet Saved'
              : 'Save Telemetry Sheet'}
          </button>
        </div>
      </div>
    </div>
  );
}
