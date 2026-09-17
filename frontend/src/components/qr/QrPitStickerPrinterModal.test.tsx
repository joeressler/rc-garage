import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QrPitStickerPrinterModal } from './QrPitStickerPrinterModal';

describe('QrPitStickerPrinterModal', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <QrPitStickerPrinterModal
        open={false}
        onClose={vi.fn()}
        chassisName="Element Enduro"
        calculatedFdr={10.5}
        qrSlug="v9k2pq1x8m"
        setupId="setup-123"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders sticker preview, download links and triggers print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <QrPitStickerPrinterModal
        open={true}
        onClose={vi.fn()}
        chassisName="Element Enduro"
        calculatedFdr={10.5}
        qrSlug="v9k2pq1x8m"
        setupId="setup-123"
        setupTitle="Moab Slickrock Spec"
      />,
    );

    expect(screen.getByText('Moab Slickrock Spec')).toBeInTheDocument();
    expect(screen.getByText('1.5" x 1.5" Vinyl Chassis Tag')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /download svg vector/i })).toHaveAttribute(
      'href',
      '/api/garage/setups/setup-123/qr?format=svg&size=450',
    );
    expect(screen.getByRole('link', { name: /download 300 dpi png/i })).toHaveAttribute(
      'href',
      '/api/garage/setups/setup-123/qr?format=png&size=450',
    );

    const printBtn = screen.getByRole('button', { name: /direct print chassis tag/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
  });
});
