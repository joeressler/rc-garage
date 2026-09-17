import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSetupSettings, type SetupEntity } from '../api/setups';
import { useAuthStore } from '../stores/useAuthStore';
import { useGarageStore, type Vehicle } from '../stores/useGarageStore';
import { useSetupStore } from '../stores/useSetupStore';
import { SetupClipboardView } from './SetupClipboardView';

const VEHICLE: Vehicle = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: '11111111-1111-4111-8111-111111111111',
  name: 'Phoenix Trail Rig',
  make: 'Vanquish',
  model: 'VS4-10 Phoenix',
  scale: '1/10',
  vehicleClass: 'crawler_scale',
  isArchived: false,
  setupCount: 1,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

const SAVED_SETUP: SetupEntity = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  vehicleId: VEHICLE.id,
  userId: VEHICLE.userId,
  title: 'Rubicon Trail Low-CoG Comp Spec',
  description: 'Test notes',
  isPublic: true,
  tags: ['comp', 'crawler'],
  qrSlug: 'v9k2pq1x8m',
  calculatedFdr: 10.03,
  frontBiasPercentage: 60.0,
  surfaceType: 'granite_rock',
  locationTag: 'Moab Rim',
  settings: defaultSetupSettings(),
  forkCount: 0,
  likeCount: 0,
  forkedFromSetupId: null,
  rootAncestorSetupId: null,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

function resetStores() {
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
  useGarageStore.getState().reset();
  useSetupStore.getState().reset();
}

describe('SetupClipboardView', () => {
  beforeEach(() => {
    resetStores();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('unexpected fetch'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStores();
  });

  it('renders the clipboard workbench and updates FDR when pinion slider changes', () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    render(
      <MemoryRouter>
        <SetupClipboardView onRequestAuth={vi.fn()} />
      </MemoryRouter>,
    );

    // Initial check: chassis make/model rendered in header clamp
    expect(screen.getByRole('heading', { name: /Vanquish VS4-10 Phoenix/i })).toBeInTheDocument();
    expect(screen.getByText(/VERIFIED SCRUTINEERING/i)).toBeInTheDocument();

    // Verify initial FDR readout
    expect(screen.getByText(/Final Drive Ratio \(FDR\)/i)).toBeInTheDocument();
    expect(screen.getByText(/10\.03:1/i)).toBeInTheDocument();

    // Find pinion slider and adjust it to 12
    const pinionSlider = screen.getByLabelText('Pinion Gear Teeth');
    fireEvent.change(pinionSlider, { target: { value: '12' } });

    // (54 / 12) * 2.6 = 11.7:1
    expect(screen.getByText(/11\.70:1/i)).toBeInTheDocument();
  });

  it('animates CoG distribution and updates bias percentages when axle weights change', () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    render(
      <MemoryRouter>
        <SetupClipboardView onRequestAuth={vi.fn()} />
      </MemoryRouter>,
    );

    // Change front weight to 1600g and rear weight to 1000g -> total 2600g (Front: 61.5%)
    const frontWeightInput = screen.getByLabelText(/Front Axle \(g\)/i);
    fireEvent.change(frontWeightInput, { target: { value: '1600' } });

    expect(screen.getByText(/1600g/i)).toBeInTheDocument();
    expect(screen.getByText(/61\.5%/i)).toBeInTheDocument();
  });

  it('displays inline error when pinion >= spur teeth', () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    render(
      <MemoryRouter>
        <SetupClipboardView onRequestAuth={vi.fn()} />
      </MemoryRouter>,
    );

    const spurInput = screen.getByLabelText('Spur Gear Teeth Input');
    fireEvent.change(spurInput, { target: { value: '10' } }); // spur (10) < pinion (14)

    expect(screen.getByText(/Spur gear teeth must exceed pinion gear teeth/i)).toBeInTheDocument();
  });

  it('renders a saved setup with its QR badge when activeSetup exists', () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });
    useSetupStore.setState({
      activeSetup: SAVED_SETUP,
      targetVehicleId: VEHICLE.id,
    });

    render(
      <MemoryRouter>
        <SetupClipboardView onRequestAuth={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/SLUG: \/s\/v9k2pq1x8m/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print Chassis QR/i })).toBeInTheDocument();
  });
});
