import { chassisQrPngUrl, chassisQrSvgUrl } from '../../api/qr';
import { ChassisStickerPrinter } from './ChassisStickerPrinter';

interface QrPitStickerPrinterModalProps {
  open: boolean;
  onClose: () => void;
  chassisName: string;
  calculatedFdr: number;
  qrSlug: string;
  setupId: string;
  setupTitle?: string;
}

/**
 * Purpose: render a dedicated pit-sticker modal composing ChassisStickerPrinter with SVG/PNG vector/bitmap downloads and direct print triggers.
 */
export function QrPitStickerPrinterModal({
  open,
  onClose,
  chassisName,
  calculatedFdr,
  qrSlug,
  setupId,
  setupTitle,
}: QrPitStickerPrinterModalProps) {
  if (!open) return null;

  const svgUrl = chassisQrSvgUrl(setupId, 450);
  const pngUrl = chassisQrPngUrl(setupId, 450);

  const handleDirectPrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-printer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-pit-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hex Rivets */}
        <span className="hex-rivet left-2 top-2" />
        <span className="hex-rivet right-2 top-2" />
        <span className="hex-rivet bottom-2 left-2" />
        <span className="hex-rivet bottom-2 right-2" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-metal-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="border border-hazard-orange bg-pit-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-hazard-orange">
                Pit-Mat Printing Bay
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-readout-dim">
                1.5" x 1.5" Vinyl Chassis Tag
              </span>
            </div>
            <h2
              id="qr-printer-modal-title"
              className="mt-1 font-display text-xl font-bold uppercase tracking-wider text-readout-bright"
            >
              {setupTitle ?? chassisName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close printer modal"
            className="border border-metal-border bg-pit-black px-2.5 py-1 font-mono text-xs text-readout-muted hover:border-hazard-orange hover:text-hazard-orange"
          >
            ✕
          </button>
        </div>

        {/* 1:1 Scale Preview Container */}
        <div className="mt-5 flex flex-col items-center justify-center border border-metal-border bg-pit-black p-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-readout-muted">
            1:1 Scale High-Contrast Print Preview (300 DPI)
          </p>
          <div className="border-2 border-white/20 p-2 shadow-xl bg-white/5">
            <ChassisStickerPrinter
              chassisName={chassisName}
              calculatedFdr={calculatedFdr}
              qrSlug={qrSlug}
              setupId={setupId}
            />
          </div>
          <span className="mt-3 font-mono text-[9px] uppercase tracking-wider text-readout-dim">
            Level H Error Correction · Public Route: /s/{qrSlug}
          </span>
        </div>

        {/* Action Buttons: Direct Print + SVG / PNG Exports */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleDirectPrint}
            className="w-full border border-hazard-orange bg-hazard-orange py-2.5 font-display text-xs font-bold uppercase tracking-wider text-pit-black shadow-hazard-glow hover:bg-hazard-orange/90 transition"
          >
            Direct Print Chassis Tag (Sheet Layout)
          </button>

          <div className="grid grid-cols-2 gap-2">
            <a
              href={svgUrl}
              download={`chassis-qr-${qrSlug}.svg`}
              className="flex items-center justify-center border border-metal-border bg-pit-black py-2 font-mono text-[11px] uppercase tracking-wider text-readout-bright hover:border-neon-radio hover:text-neon-radio transition text-center"
            >
              Download SVG Vector
            </a>
            <a
              href={pngUrl}
              download={`chassis-qr-${qrSlug}.png`}
              className="flex items-center justify-center border border-metal-border bg-pit-black py-2 font-mono text-[11px] uppercase tracking-wider text-readout-bright hover:border-neon-radio hover:text-neon-radio transition text-center"
            >
              Download 300 DPI PNG
            </a>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="border border-metal-border px-4 py-1.5 font-mono text-xs text-readout-dim hover:text-readout-bright"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
