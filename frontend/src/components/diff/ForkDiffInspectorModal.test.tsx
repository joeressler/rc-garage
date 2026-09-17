import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ForkDiffInspectorModal } from './ForkDiffInspectorModal';
import { defaultSetupSettings } from '../../api/setups';

describe('ForkDiffInspectorModal', () => {
  it('does not render when open is false', () => {
    const parent = defaultSetupSettings();
    const current = defaultSetupSettings();

    const { container } = render(
      <ForkDiffInspectorModal
        open={false}
        onClose={vi.fn()}
        parentSettings={parent}
        currentSettings={current}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders side-by-side spec table and displays modified delta highlights', () => {
    const parent = defaultSetupSettings();
    const current = defaultSetupSettings();

    // Modify pinion from 14T to 12T (delta -2T)
    current.drivetrain.pinionTeeth = 12;
    // Modify front shock oil from 350 to 450 (delta +100 CST)
    current.suspension.front.oilViscosityValue = 450;
    current.suspension.front.oilViscosityUnit = 'CST';

    render(
      <ForkDiffInspectorModal
        open={true}
        onClose={vi.fn()}
        parentSettings={parent}
        currentSettings={current}
        parentTitle="Parent Ancestor Spec"
        currentTitle="Forked Chassis Spec"
      />,
    );

    expect(screen.getByText('Mechanical Lineage Deviations')).toBeInTheDocument();
    expect(screen.getByText('Pinion Teeth')).toBeInTheDocument();
    expect(screen.getByText('-2T')).toBeInTheDocument();
    expect(screen.getByText('+100 CST')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    const parent = defaultSetupSettings();
    const current = defaultSetupSettings();

    render(
      <ForkDiffInspectorModal
        open={true}
        onClose={handleClose}
        parentSettings={parent}
        currentSettings={current}
      />,
    );

    const closeBtn = screen.getByRole('button', { name: /close diff modal/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
