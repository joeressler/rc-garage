import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicInspectionSheet } from '../../api/qr';
import { defaultSetupSettings, type SetupEntity } from '../../api/setups';
import { useAuthStore } from '../../stores/useAuthStore';
import { SetupInspectOverlay } from './SetupInspectOverlay';

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

const SETUP: SetupEntity = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  vehicleId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: 'foreign-driver',
  title: 'Moab Slickrock Spec',
  description: 'Trail notes from the rim.',
  isPublic: true,
  tags: ['moab'],
  qrSlug: 'v9k2pq1x8m',
  calculatedFdr: 10.03,
  frontBiasPercentage: 60.0,
  surfaceType: 'slick_rock',
  locationTag: 'Moab Rim',
  settings: defaultSetupSettings(),
  forkCount: 4,
  likeCount: 9,
  forkedFromSetupId: null,
  rootAncestorSetupId: null,
  createdAt: '2026-09-17T00:00:00Z',
  updatedAt: '2026-09-17T00:00:00Z',
};

const INSPECTION: PublicInspectionSheet = {
  setupId: SETUP.id,
  title: SETUP.title,
  qrSlug: SETUP.qrSlug,
  shortUrl: '/s/v9k2pq1x8m',
  calculatedFdr: SETUP.calculatedFdr,
  batteryCellCount: 3,
  vehicle: {
    name: 'Sendero Trail Rig',
    make: 'Element',
    model: 'Enduro Sendero HD',
    scale: '1/10',
    vehicleClass: 'crawler_scale',
    electronics: {
      motor: {
        name: 'Holmes 540',
        productUrl: 'https://example.com/holmes-540',
        motorType: 'brushed' as const,
        kv: 1800,
      },
      esc: {
        name: 'Hobbywing 1080',
      },
      steeringServo: {
        name: 'Reefs 422HD',
        torqueKg: 25,
      },
    },
  },
  frontShock: { oilViscosityValue: 350, oilViscosityUnit: 'CST' },
  rearShock: { oilViscosityValue: 300, oilViscosityUnit: 'CST' },
  frontTire: { brand: 'Pro-Line', model: 'Hyrax 1.9', compound: 'Predator' },
  rearTire: { brand: 'Pro-Line', model: 'Hyrax 1.9', compound: 'Predator' },
  verified: true,
};

function stubInspectFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const resolveMatch = url.match(/\/api\/garage\/qr\/resolve\/([^/?]+)/);
      if (resolveMatch) {
        const slug = decodeURIComponent(resolveMatch[1] ?? '');
        if (slug !== SETUP.qrSlug) {
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

      if (url.includes(`/api/garage/setups/${SETUP.id}`)) {
        return jsonResponse(envelope(SETUP));
      }

      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

describe('SetupInspectOverlay', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    stubInspectFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a public sheet by id without using clipboard editor state', async () => {
    const onClose = vi.fn();
    const onRequestFork = vi.fn();

    render(
      <SetupInspectOverlay
        open
        setupId={SETUP.id}
        authorCallsign="TrailBoss"
        onClose={onClose}
        onRequestFork={onRequestFork}
        onRequestAuth={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Element Enduro Sendero HD' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Moab Slickrock Spec')).toBeInTheDocument();
    expect(screen.getByText('@TrailBoss')).toBeInTheDocument();
    expect(screen.getByText('14T')).toBeInTheDocument();
    expect(screen.getByText(/95g brass/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Community Feed/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Telemetry Sheet/i })).not.toBeInTheDocument();
  });

  it('renders named electronics as shop links when a product URL is set', async () => {
    render(
      <SetupInspectOverlay
        open
        slug={SETUP.qrSlug}
        onClose={vi.fn()}
        onRequestFork={vi.fn()}
        onRequestAuth={vi.fn()}
      />,
    );

    const motorLink = await screen.findByRole('link', { name: 'Holmes 540' });
    expect(motorLink).toHaveAttribute('href', 'https://example.com/holmes-540');
    expect(motorLink).toHaveAttribute('target', '_blank');
    expect(motorLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Hobbywing 1080')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hobbywing 1080' })).not.toBeInTheDocument();
    expect(screen.getByText(/Reefs 422HD/)).toBeInTheDocument();
    expect(screen.getByText(/25 kg·cm/)).toBeInTheDocument();
  });

  it('returns to the feed and can request a fork onto an owned chassis', async () => {
    const onClose = vi.fn();
    const onRequestFork = vi.fn();

    render(
      <SetupInspectOverlay
        open
        slug={SETUP.qrSlug}
        onClose={onClose}
        onRequestFork={onRequestFork}
        onRequestAuth={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Fork to My Garage/i }));
    expect(onRequestFork).toHaveBeenCalledWith({
      id: SETUP.id,
      title: SETUP.title,
      authorCallsign: undefined,
    });

    fireEvent.click(screen.getByRole('button', { name: /Back to Community Feed/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a pit inspection 404 for unknown slugs', async () => {
    const onClose = vi.fn();

    render(
      <SetupInspectOverlay
        open
        slug="deadslug12"
        onClose={onClose}
        onRequestFork={vi.fn()}
        onRequestAuth={vi.fn()}
      />,
    );

    expect(await screen.findByText('Chassis tag not on the board')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back to Community Feed/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
