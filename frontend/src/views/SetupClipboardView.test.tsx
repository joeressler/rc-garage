import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSetupSettings, type SetupEntity, type SetupSummary } from '../api/setups';
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
  electronics: {},
  setupCount: 1,
  createdAt: '2026-09-16T00:00:00.000Z',
  updatedAt: '2026-09-16T00:00:00.000Z',
};

const VEHICLE_B: Vehicle = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: VEHICLE.userId,
  name: 'Capra Trail Rig',
  make: 'Axial',
  model: 'Capra',
  scale: '1/10',
  vehicleClass: 'crawler_scale',
  isArchived: false,
  electronics: {},
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

const SIBLING_SETUP: SetupEntity = {
  ...SAVED_SETUP,
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  title: 'Moab Slickrock High-Pinion',
  qrSlug: 'slick9x8m2',
  calculatedFdr: 11.7,
};

const CAPRA_SETUP: SetupEntity = {
  ...SAVED_SETUP,
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  vehicleId: VEHICLE_B.id,
  title: 'Capra Night Practice',
  qrSlug: 'capra1x8m2',
  calculatedFdr: 9.45,
};

function envelope<T>(data: T, statusCode = 200) {
  return {
    success: true as const,
    statusCode,
    data,
    timestamp: '2026-09-16T00:00:00.000Z',
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toSummary(setup: SetupEntity): SetupSummary {
  return {
    id: setup.id,
    vehicleId: setup.vehicleId,
    userId: setup.userId,
    title: setup.title,
    isPublic: setup.isPublic,
    calculatedFdr: setup.calculatedFdr,
    frontBiasPercentage: setup.frontBiasPercentage,
    surfaceType: setup.surfaceType,
    forkCount: setup.forkCount,
    likeCount: setup.likeCount,
    qrSlug: setup.qrSlug,
    isForked: !!setup.forkedFromSetupId,
    createdAt: setup.createdAt,
  };
}

function stubGarageSetupFetch(
  handlers: {
    listByVehicle?: Record<string, SetupSummary[]>;
    accountList?: SetupSummary[];
    byId?: Record<string, SetupEntity>;
    onCreate?: (payload: Record<string, unknown>) => SetupEntity;
    onUpdate?: (setupId: string, payload: Record<string, unknown>) => SetupEntity;
  } = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      const payload = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};

      if (method === 'POST' && /\/api\/garage\/setups\/?$/.test(url)) {
        if (!handlers.onCreate) {
          throw new Error(`unexpected setup create ${url}`);
        }
        return jsonResponse(envelope(handlers.onCreate(payload), 201));
      }

      if (method === 'PUT') {
        const updateMatch = url.match(/\/api\/garage\/setups\/([0-9a-f-]+)/i);
        if (!handlers.onUpdate || !updateMatch?.[1]) {
          throw new Error(`unexpected setup update ${url}`);
        }
        return jsonResponse(envelope(handlers.onUpdate(updateMatch[1], payload)));
      }

      const vehicleMatch = url.match(/\/api\/garage\/setups\?vehicleId=([^&]+)/);
      if (vehicleMatch) {
        const vehicleId = decodeURIComponent(vehicleMatch[1] ?? '');
        return jsonResponse(envelope(handlers.listByVehicle?.[vehicleId] ?? []));
      }

      const detailMatch = url.match(/\/api\/garage\/setups\/([0-9a-f-]+)/i);
      if (detailMatch) {
        const setup = handlers.byId?.[detailMatch[1] ?? ''];
        if (!setup) {
          throw new Error(`unexpected setup fetch ${url}`);
        }
        return jsonResponse(envelope(setup));
      }

      if (/\/api\/garage\/setups\/?$/.test(url)) {
        return jsonResponse(envelope(handlers.accountList ?? []));
      }

      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

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

function renderClipboard(onRequestAuth: () => void = vi.fn()) {
  return render(
    <MemoryRouter>
      <SetupClipboardView onRequestAuth={onRequestAuth} />
    </MemoryRouter>,
  );
}

async function settleSwitcher() {
  await screen.findByRole('tab', { name: /This Chassis/i });
  await waitFor(() => {
    expect(screen.queryByText(/Querying stamped sheets/i)).not.toBeInTheDocument();
  });
}

describe('SetupClipboardView', () => {
  beforeEach(() => {
    resetStores();
    stubGarageSetupFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStores();
  });

  it('renders the clipboard workbench and updates FDR when pinion slider changes', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    renderClipboard();
    await settleSwitcher();

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

  it('animates CoG distribution and updates bias percentages when axle weights change', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    renderClipboard();
    await settleSwitcher();

    // Change front weight to 1600g and rear weight to 1000g -> total 2600g (Front: 61.5%)
    const frontWeightInput = screen.getByLabelText(/Front Axle \(g\)/i);
    fireEvent.change(frontWeightInput, { target: { value: '1600' } });

    expect(screen.getByText(/1600g/i)).toBeInTheDocument();
    expect(screen.getByText(/61\.5%/i)).toBeInTheDocument();
  });

  it('displays inline error when pinion >= spur teeth', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    renderClipboard();
    await settleSwitcher();

    const spurInput = screen.getByLabelText('Spur Gear Teeth Input');
    fireEvent.change(spurInput, { target: { value: '10' } }); // spur (10) < pinion (14)

    expect(screen.getByText(/Spur gear teeth must exceed pinion gear teeth/i)).toBeInTheDocument();
  });

  it('renders a saved setup with its QR badge when activeSetup exists', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });
    useSetupStore.setState({
      activeSetup: SAVED_SETUP,
      targetVehicleId: VEHICLE.id,
    });

    renderClipboard();
    await settleSwitcher();

    expect(screen.getByText(/SLUG: \/s\/v9k2pq1x8m/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print Chassis QR/i })).toBeInTheDocument();
  });

  it('opens ForkDiffInspectorModal when View Diff is clicked on a forked setup', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    const parentSettings = defaultSetupSettings();
    parentSettings.drivetrain.pinionTeeth = 14;

    const forkedSetup: SetupEntity = {
      ...SAVED_SETUP,
      forkedFromSetupId: 'parent-setup-id',
    };

    useSetupStore.setState({
      activeSetup: forkedSetup,
      targetVehicleId: VEHICLE.id,
      comparisonParentSetup: parentSettings,
    });

    // Update active settings to have 12T pinion (-2T)
    useSetupStore.getState().updateGearing(12, 54, 2.6);

    renderClipboard();
    await settleSwitcher();

    expect(screen.getByText(/FORK OF ANCESTOR/i)).toBeInTheDocument();
    const viewDiffBtn = screen.getByRole('button', { name: /View Diff/i });
    fireEvent.click(viewDiffBtn);

    expect(screen.getByText('Mechanical Lineage Deviations')).toBeInTheDocument();
    expect(screen.getByText('-2T')).toBeInTheDocument();
  });

  it('opens QrPitStickerPrinterModal when Print Chassis QR is clicked', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });
    useSetupStore.setState({
      activeSetup: SAVED_SETUP,
      targetVehicleId: VEHICLE.id,
    });

    renderClipboard();
    await settleSwitcher();

    const printQrBtn = screen.getByRole('button', { name: /Print Chassis QR/i });
    fireEvent.click(printQrBtn);

    expect(screen.getByText('Pit-Mat Printing Bay')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Direct Print Chassis Tag/i })).toBeInTheDocument();
  });

  it('lists sibling sheets for the active chassis and loads the selected setup', async () => {
    stubGarageSetupFetch({
      listByVehicle: {
        [VEHICLE.id]: [toSummary(SAVED_SETUP), toSummary(SIBLING_SETUP)],
      },
      byId: {
        [SIBLING_SETUP.id]: SIBLING_SETUP,
      },
    });
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    renderClipboard();
    await settleSwitcher();

    const siblingChip = await screen.findByRole('button', {
      name: /Moab Slickrock High-Pinion/i,
    });
    fireEvent.click(siblingChip);

    await waitFor(() => {
      expect(screen.getByText(/SLUG: \/s\/slick9x8m2/i)).toBeInTheDocument();
    });
    expect(useSetupStore.getState().activeSetup?.id).toBe(SIBLING_SETUP.id);
  });

  it('shows every garage sheet when All My Sheets is selected', async () => {
    stubGarageSetupFetch({
      listByVehicle: {
        [VEHICLE.id]: [toSummary(SAVED_SETUP)],
        [VEHICLE_B.id]: [toSummary(CAPRA_SETUP)],
      },
      accountList: [toSummary(SAVED_SETUP), toSummary(CAPRA_SETUP)],
    });
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({
      vehicles: [VEHICLE, VEHICLE_B],
      activeVehicleId: VEHICLE.id,
    });

    renderClipboard();
    await settleSwitcher();

    expect(
      await screen.findByRole('button', { name: /Rubicon Trail Low-CoG Comp Spec/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Capra Night Practice/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /All My Sheets/i }));

    expect(await screen.findByRole('button', { name: /Capra Night Practice/i })).toBeInTheDocument();
    expect(screen.getByText(/Capra Trail Rig · FDR 9\.45:1/i)).toBeInTheDocument();
  });

  it('keeps Custom Internal Ratio selected so the gearbox field can be edited', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    renderClipboard();
    await settleSwitcher();

    const ratioSelect = screen.getByLabelText('Transmission Internal Ratio');
    fireEvent.change(ratioSelect, { target: { value: 'custom' } });

    expect(ratioSelect).toHaveValue('custom');

    fireEvent.change(screen.getByLabelText('Custom internal ratio'), {
      target: { value: '3.25' },
    });

    // (54 / 14) * 3.25 = 12.54:1
    expect(screen.getByText(/12\.54:1/i)).toBeInTheDocument();
    expect(ratioSelect).toHaveValue('custom');
  });

  it('stamps LMT 10.16:1 internal ratio without hitting the gearbox cap', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    renderClipboard();
    await settleSwitcher();

    fireEvent.change(screen.getByLabelText('Transmission Internal Ratio'), {
      target: { value: '10.16' },
    });
    fireEvent.change(screen.getByLabelText('Pinion Gear Teeth'), {
      target: { value: '19' },
    });
    fireEvent.change(screen.getByLabelText('Spur Gear Teeth Input'), {
      target: { value: '35' },
    });

    // (35 / 19) * 10.16 = 18.72:1
    expect(screen.getByText(/18\.72:1/i)).toBeInTheDocument();
    expect(
      useSetupStore.getState().validationErrors['settings.drivetrain.transmissionInternalRatio'],
    ).toBeUndefined();
  });

  it('lists shock and tire validation messages when save is blocked', async () => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });
    useSetupStore.getState().setTargetVehicleId(VEHICLE.id);
    useSetupStore.getState().updateGearing(14, 54, 3.25);
    useSetupStore.getState().updateSuspensionCorner('front', { springRateDescription: '' });
    useSetupStore.getState().updateTires('front', { compound: '' });

    renderClipboard();
    await settleSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Save Telemetry Sheet/i }));

    expect(await screen.findByText(/Fix highlighted telemetry inputs before saving/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Spring rate is required/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tire compound is required/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Custom internal ratio')).toHaveValue(3.25);
  });

  it('loads the target chassis spec when swapping bays that already have a sheet', async () => {
    stubGarageSetupFetch({
      listByVehicle: {
        [VEHICLE.id]: [toSummary(SAVED_SETUP)],
        [VEHICLE_B.id]: [toSummary(CAPRA_SETUP)],
      },
      byId: {
        [SAVED_SETUP.id]: SAVED_SETUP,
        [CAPRA_SETUP.id]: CAPRA_SETUP,
      },
    });
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({
      vehicles: [VEHICLE, VEHICLE_B],
      activeVehicleId: VEHICLE.id,
    });
    useSetupStore.setState({
      activeSetup: SAVED_SETUP,
      activeSettings: SAVED_SETUP.settings,
      targetVehicleId: VEHICLE.id,
      meta: {
        title: SAVED_SETUP.title,
        description: SAVED_SETUP.description ?? '',
        isPublic: SAVED_SETUP.isPublic,
        tags: SAVED_SETUP.tags,
      },
    });

    renderClipboard();
    await settleSwitcher();

    fireEvent.change(screen.getByLabelText('Active chassis'), {
      target: { value: VEHICLE_B.id },
    });

    await waitFor(() => {
      expect(screen.getByText(/SLUG: \/s\/capra1x8m2/i)).toBeInTheDocument();
    });
    expect(useSetupStore.getState().activeSetup?.id).toBe(CAPRA_SETUP.id);
    expect(useSetupStore.getState().activeSetup?.vehicleId).toBe(VEHICLE_B.id);
    expect(useGarageStore.getState().activeVehicleId).toBe(VEHICLE_B.id);
  });

  it('opens a new draft for an empty chassis instead of rewriting the previous spec', async () => {
    const createdSetup: SetupEntity = {
      ...CAPRA_SETUP,
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      title: 'Axial Capra Spec',
      qrSlug: 'newlmt9x8m',
    };
    stubGarageSetupFetch({
      listByVehicle: {
        [VEHICLE.id]: [toSummary(SAVED_SETUP)],
        [VEHICLE_B.id]: [],
      },
      byId: {
        [SAVED_SETUP.id]: SAVED_SETUP,
      },
      onCreate: (payload) => {
        expect(payload.vehicleId).toBe(VEHICLE_B.id);
        return createdSetup;
      },
    });
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true });
    useGarageStore.setState({
      vehicles: [VEHICLE, VEHICLE_B],
      activeVehicleId: VEHICLE.id,
    });
    useSetupStore.setState({
      activeSetup: SAVED_SETUP,
      activeSettings: SAVED_SETUP.settings,
      targetVehicleId: VEHICLE.id,
      meta: {
        title: SAVED_SETUP.title,
        description: SAVED_SETUP.description ?? '',
        isPublic: SAVED_SETUP.isPublic,
        tags: SAVED_SETUP.tags,
      },
    });

    renderClipboard();
    await settleSwitcher();

    fireEvent.change(screen.getByLabelText('Active chassis'), {
      target: { value: VEHICLE_B.id },
    });

    await waitFor(() => {
      expect(useSetupStore.getState().activeSetup).toBeNull();
      expect(useSetupStore.getState().isLoading).toBe(false);
    });
    expect(useSetupStore.getState().targetVehicleId).toBe(VEHICLE_B.id);
    expect(screen.getByText(/DRAFT BENCH SHEET/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Axial Capra/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Pinion Gear Teeth'), {
      target: { value: '12' },
    });
    expect(useSetupStore.getState().activeSetup).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Save Telemetry Sheet/i }));

    await waitFor(() => {
      expect(useSetupStore.getState().activeSetup?.id).toBe(createdSetup.id);
    });
    expect(useSetupStore.getState().activeSetup?.vehicleId).toBe(VEHICLE_B.id);
    expect(
      vi.mocked(fetch).mock.calls.some((call) => {
        const url = String(call[0]);
        const method = String(call[1]?.method ?? 'GET').toUpperCase();
        return method === 'PUT' && url.includes(SAVED_SETUP.id);
      }),
    ).toBe(false);
  });

  it('loads an owned setupId onto the clipboard editor', async () => {
    stubGarageSetupFetch({
      listByVehicle: {
        [VEHICLE.id]: [toSummary(SAVED_SETUP)],
      },
      byId: {
        [SAVED_SETUP.id]: SAVED_SETUP,
      },
    });
    useAuthStore.setState({
      token: 'test-token',
      isAuthenticated: true,
      user: {
        id: VEHICLE.userId,
        callsign: 'TrailBoss',
        email: 'trailboss@example.com',
        role: 'driver',
        isSuspended: false,
        createdAt: '2026-09-16T00:00:00.000Z',
        vehicleCount: 1,
        setupCount: 1,
      },
    });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });

    render(
      <MemoryRouter initialEntries={[`/clipboard?setupId=${SAVED_SETUP.id}`]}>
        <Routes>
          <Route path="/clipboard" element={<SetupClipboardView onRequestAuth={vi.fn()} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/SLUG: \/s\/v9k2pq1x8m/i)).toBeInTheDocument();
    expect(useSetupStore.getState().activeSetup?.id).toBe(SAVED_SETUP.id);
  });

  it('redirects a foreign clipboard setupId to feed inspect without replacing the active sheet', async () => {
    const foreignSetup: SetupEntity = {
      ...SAVED_SETUP,
      id: '99999999-9999-4999-8999-999999999999',
      userId: '22222222-2222-4222-8222-222222222222',
      title: 'Someone Else Moab Spec',
      qrSlug: 'frgn9x8m2a',
    };
    stubGarageSetupFetch({
      listByVehicle: {
        [VEHICLE.id]: [toSummary(SAVED_SETUP)],
      },
      byId: {
        [foreignSetup.id]: foreignSetup,
        [SAVED_SETUP.id]: SAVED_SETUP,
      },
    });
    useAuthStore.setState({
      token: 'test-token',
      isAuthenticated: true,
      user: {
        id: VEHICLE.userId,
        callsign: 'TrailBoss',
        email: 'trailboss@example.com',
        role: 'driver',
        isSuspended: false,
        createdAt: '2026-09-16T00:00:00.000Z',
        vehicleCount: 1,
        setupCount: 1,
      },
    });
    useGarageStore.setState({ vehicles: [VEHICLE], activeVehicleId: VEHICLE.id });
    useSetupStore.setState({
      activeSetup: SAVED_SETUP,
      activeSettings: SAVED_SETUP.settings,
      targetVehicleId: VEHICLE.id,
      meta: {
        title: SAVED_SETUP.title,
        description: SAVED_SETUP.description ?? '',
        isPublic: SAVED_SETUP.isPublic,
        tags: SAVED_SETUP.tags,
      },
    });

    render(
      <MemoryRouter initialEntries={[`/clipboard?setupId=${foreignSetup.id}`]}>
        <Routes>
          <Route path="/clipboard" element={<SetupClipboardView onRequestAuth={vi.fn()} />} />
          <Route path="/feed" element={<FeedInspectProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('feed-inspect')).toHaveTextContent(foreignSetup.id);
    expect(useSetupStore.getState().activeSetup?.id).toBe(SAVED_SETUP.id);
    expect(useSetupStore.getState().targetVehicleId).toBe(VEHICLE.id);
  });

  it('redirects unauthenticated clipboard setupId to feed inspect', async () => {
    render(
      <MemoryRouter initialEntries={[`/clipboard?setupId=${SAVED_SETUP.id}`]}>
        <Routes>
          <Route path="/clipboard" element={<SetupClipboardView onRequestAuth={vi.fn()} />} />
          <Route path="/feed" element={<FeedInspectProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('feed-inspect')).toHaveTextContent(SAVED_SETUP.id);
    expect(useSetupStore.getState().activeSetup).toBeNull();
  });
});

function FeedInspectProbe() {
  const [params] = useSearchParams();
  return <div data-testid="feed-inspect">{params.get('inspect')}</div>;
}
