import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedItem } from '../api/feed';
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

describe('CommunityFeedWorkbench', () => {
  beforeEach(() => {
    resetStores();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            envelope({
              items: [FEED_ITEM],
              nextCursor: null,
              hasMore: false,
            }),
          ),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStores();
  });

  it('renders feed header and setup sheet cards', async () => {
    render(
      <MemoryRouter>
        <CommunityFeedWorkbench onRequestAuth={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Global RC Setup Workbench')).toBeInTheDocument();
    expect(await screen.findByText('Moab Slickrock Spec')).toBeInTheDocument();
    expect(screen.getByText('@TrailBoss')).toBeInTheDocument();
    expect(screen.getAllByText('SCALE CRAWLER').length).toBeGreaterThan(0);
  });

  it('triggers onRequestAuth when unauthorized user clicks quick fork', async () => {
    const handleAuth = vi.fn();
    render(
      <MemoryRouter>
        <CommunityFeedWorkbench onRequestAuth={handleAuth} />
      </MemoryRouter>,
    );

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

    render(
      <MemoryRouter>
        <CommunityFeedWorkbench onRequestAuth={vi.fn()} />
      </MemoryRouter>,
    );

    const forkBtn = await screen.findByRole('button', { name: /^fork$/i });
    fireEvent.click(forkBtn);

    expect(screen.getByText('Fork Telemetry into Garage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fork of Moab Slickrock Spec')).toBeInTheDocument();
  });
});
