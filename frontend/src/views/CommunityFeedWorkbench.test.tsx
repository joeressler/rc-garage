import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedItem } from '../api/feed';
import type { PublicInspectionSheet } from '../api/qr';
import { defaultSetupSettings, type SetupEntity } from '../api/setups';
import { useAuthStore } from '../stores/useAuthStore';
import { useGarageStore } from '../stores/useGarageStore';
import { useSetupStore } from '../stores/useSetupStore';
import { CommunityFeedWorkbench } from './CommunityFeedWorkbench';

function envelope<T>(data: T, statusCode = 200) {
  return {
    success: true as const,
    statusCode,
    data,
    timestamp: '2026-09-17T00:00:00.000Z',
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const FEED_ITEM: FeedItem = {
  id: 'feed-setup-1',
  title: 'Moab Slickrock Spec',
  author: { callsign: 'TrailBoss', avatarUrl: null },
  vehicle: { make: 'Element', model: 'Enduro Sendero HD', class: 'crawler_scale' },
  calculatedFdr: 10.5,
  frontBiasPercentage: 60.0,
  surfaceType: 'slick_rock',
  forkCount: 4,
  likeCount: 9,
  isLikedByCaller: false,
  qrSlug: 'v9k2pq1x8m',
  createdAt: '2026-09-17T00:00:00Z',
};

const FEED_SETUP: SetupEntity = {
  id: FEED_ITEM.id,
  vehicleId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: 'foreign-driver',
  title: FEED_ITEM.title,
  description: null,
  isPublic: true,
  tags: [],
  qrSlug: FEED_ITEM.qrSlug,
  calculatedFdr: FEED_ITEM.calculatedFdr,
  frontBiasPercentage: FEED_ITEM.frontBiasPercentage,
  surfaceType: FEED_ITEM.surfaceType,
  locationTag: null,
  settings: defaultSetupSettings(),
  forkCount: FEED_ITEM.forkCount,
  likeCount: FEED_ITEM.likeCount,
  forkedFromSetupId: null,
  rootAncestorSetupId: null,
  createdAt: FEED_ITEM.createdAt,
  updatedAt: FEED_ITEM.createdAt,
};

const INSPECTION: PublicInspectionSheet = {
  setupId: FEED_ITEM.id,
  title: FEED_ITEM.title,
  qrSlug: FEED_ITEM.qrSlug,
  shortUrl: `/s/${FEED_ITEM.qrSlug}`,
  calculatedFdr: FEED_ITEM.calculatedFdr,
  batteryCellCount: 3,
  vehicle: {
    name: 'Sendero Trail Rig',
    make: FEED_ITEM.vehicle.make,
    model: FEED_ITEM.vehicle.model,
    scale: '1/10',
    vehicleClass: FEED_ITEM.vehicle.class,
  },
  frontShock: { oilViscosityValue: 350, oilViscosityUnit: 'CST' },
  rearShock: { oilViscosityValue: 300, oilViscosityUnit: 'CST' },
  frontTire: { brand: 'Pro-Line', model: 'Hyrax 1.9', compound: 'Predator' },
  rearTire: { brand: 'Pro-Line', model: 'Hyrax 1.9', compound: 'Predator' },
  verified: true,
};

const OWNED_CLIPBOARD_SETUP: SetupEntity = {
  ...FEED_SETUP,
  id: 'owned-setup-1',
  userId: 'u-1',
  title: 'My Phoenix Night Spec',
  qrSlug: 'own3dslug1',
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

function stubCommunityFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/garage/feed')) {
        return jsonResponse(
          envelope({
            items: [FEED_ITEM],
            nextCursor: null,
            hasMore: false,
          }),
        );
      }

      const resolveMatch = url.match(/\/api\/garage\/qr\/resolve\/([^/?]+)/);
      if (resolveMatch) {
        const slug = decodeURIComponent(resolveMatch[1] ?? '');
        if (slug !== FEED_ITEM.qrSlug) {
          return jsonResponse(
            {
              success: false,
              statusCode: 404,
              error: 'Not Found',
              message: ['Setup not found'],
              timestamp: '2026-09-17T00:00:00.000Z',
            },
            404,
          );
        }
        return jsonResponse(envelope(INSPECTION));
      }

      if (url.includes(`/api/garage/setups/${FEED_ITEM.id}`)) {
        return jsonResponse(envelope(FEED_SETUP));
      }

      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

function renderFeed(onRequestAuth: () => void = vi.fn(), initialEntry = '/feed') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/feed"
          element={<CommunityFeedWorkbench onRequestAuth={onRequestAuth} />}
        />
        <Route
          path="/s/:slug"
          element={<CommunityFeedWorkbench onRequestAuth={onRequestAuth} />}
        />
        <Route path="/clipboard" element={<div data-testid="clipboard-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CommunityFeedWorkbench', () => {
  beforeEach(() => {
    resetStores();
    stubCommunityFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStores();
  });

  it('renders feed header and setup sheet cards', async () => {
    renderFeed();

    expect(screen.getByText('Global RC Setup Workbench')).toBeInTheDocument();
    expect(await screen.findByText('Moab Slickrock Spec')).toBeInTheDocument();
    expect(screen.getByText('@TrailBoss')).toBeInTheDocument();
    expect(screen.getAllByText('SCALE CRAWLER').length).toBeGreaterThan(0);
  });

  it('triggers onRequestAuth when unauthorized user clicks quick fork', async () => {
    const handleAuth = vi.fn();
    renderFeed(handleAuth);

    const forkBtn = await screen.findByRole('button', { name: /^fork$/i });
    fireEvent.click(forkBtn);
    expect(handleAuth).toHaveBeenCalledTimes(1);
  });

  it('allows authenticated driver to open fork modal', async () => {
    useAuthStore.setState({ token: 'jwt-token', isAuthenticated: true });
    useGarageStore.setState({
      vehicles: [
        {
          id: 'v-123',
          userId: 'u-1',
          name: 'My Phoenix',
          make: 'Vanquish',
          model: 'Phoenix',
          scale: '1/10',
          vehicleClass: 'crawler_scale',
          isArchived: false,
          setupCount: 0,
          createdAt: '2026-09-17T00:00:00Z',
          updatedAt: '2026-09-17T00:00:00Z',
        },
      ],
      activeVehicleId: 'v-123',
    });

    renderFeed();

    const forkBtn = await screen.findByRole('button', { name: /^fork$/i });
    fireEvent.click(forkBtn);

    expect(screen.getByText('Fork Telemetry into Garage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fork of Moab Slickrock Spec')).toBeInTheDocument();
  });

  it('inspects a community sheet over the feed without touching clipboard editor state', async () => {
    useSetupStore.setState({
      activeSetup: OWNED_CLIPBOARD_SETUP,
      activeSettings: OWNED_CLIPBOARD_SETUP.settings,
      targetVehicleId: OWNED_CLIPBOARD_SETUP.vehicleId,
    });

    renderFeed();

    fireEvent.click(await screen.findByRole('button', { name: /^inspect$/i }));

    expect(await screen.findByTestId('setup-inspect-overlay')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Back to Community Feed/i })).toBeInTheDocument();
    expect(screen.queryByTestId('clipboard-route')).not.toBeInTheDocument();
    expect(useSetupStore.getState().activeSetup?.id).toBe(OWNED_CLIPBOARD_SETUP.id);
    expect(useSetupStore.getState().targetVehicleId).toBe(OWNED_CLIPBOARD_SETUP.vehicleId);

    fireEvent.click(screen.getByRole('button', { name: /Back to Community Feed/i }));
    expect(screen.queryByTestId('setup-inspect-overlay')).not.toBeInTheDocument();
    expect(screen.getByText('Global RC Setup Workbench')).toBeInTheDocument();
    expect(useSetupStore.getState().activeSetup?.id).toBe(OWNED_CLIPBOARD_SETUP.id);
  });

  it('opens QR slug inspection over the community feed', async () => {
    renderFeed(vi.fn(), `/s/${FEED_ITEM.qrSlug}`);

    expect(await screen.findByTestId('setup-inspect-overlay')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Element Enduro Sendero HD' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Global RC Setup Workbench')).toBeInTheDocument();
    expect(screen.queryByTestId('clipboard-route')).not.toBeInTheDocument();
  });
});
