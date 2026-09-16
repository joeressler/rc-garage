import { chassisQrSvgUrl } from '../../api/qr';
import { formatFdr } from '../../lib/vehicle-labels';

export interface ChassisStickerPrinterProps {
  chassisName: string;
  calculatedFdr: number;
  qrSlug: string;
  setupId?: string;
}

/**
 * Purpose: render the 1.5" high-contrast vinyl chassis sticker template for later print/download composition.
 */
export function ChassisStickerPrinter({
  chassisName,
  calculatedFdr,
  qrSlug,
  setupId,
}: ChassisStickerPrinterProps) {
  const qrSrc = setupId ? chassisQrSvgUrl(setupId) : undefined;

  return (
    <article
      className="chassis-sticker-printer flex flex-col justify-between bg-white p-[0.08in] text-black"
      style={{ width: '1.5in', height: '1.5in' }}
    >
      <header className="text-center font-display text-[9px] font-bold uppercase leading-tight tracking-wide">
        {chassisName}
      </header>

      <div className="mx-auto flex h-[0.92in] w-[0.92in] items-center justify-center bg-white">
        {qrSrc ? (
          <img
            src={qrSrc}
            alt={`Chassis QR for ${qrSlug}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div
            aria-hidden
            className="h-full w-full border border-black bg-[repeating-conic-gradient(#000_0_25%,#fff_0_50%)] bg-[length:12px_12px]"
          />
        )}
      </div>

      <footer className="text-center font-mono text-[7px] leading-tight">
        <p>FDR: {formatFdr(calculatedFdr)}</p>
        <p>/s/{qrSlug}</p>
      </footer>
    </article>
  );
}
