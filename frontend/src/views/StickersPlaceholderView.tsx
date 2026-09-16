import { ChassisStickerPrinter } from '../components/qr/ChassisStickerPrinter';
import { WorkbenchPlaceholder } from '../components/workbench/WorkbenchPlaceholder';

export function StickersPlaceholderView() {
  return (
    <WorkbenchPlaceholder
      drawer="04"
      title="QR Pit-Stickers"
      milestone="Milestone 12"
      summary="Download, 300 DPI PNG export, and direct print are owned by QrPitStickerPrinterModal. This milestone only ships the 1.5 inch sticker template that modal will compose."
    >
      <div className="mt-6 inline-block border border-metal-border bg-pit-black p-4">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">
          1.5" template preview
        </p>
        <ChassisStickerPrinter
          chassisName="VS4-10 Phoenix"
          calculatedFdr={10.8}
          qrSlug="v9k2pq1x8m"
        />
      </div>
    </WorkbenchPlaceholder>
  );
}
