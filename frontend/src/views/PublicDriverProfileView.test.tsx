import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedItem } from '../api/feed';
import type { PublicDriverProfile } from '../api/profiles';
import { useAuthStore } from '../stores/useAuthStore';
import { useGarageStore } from '../stores/useGarageStore';
import { useSetupStore } from '../stores/useSetupStore';
import { PublicDriverProfileView } from './PublicDriverProfileView';

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

const ITEM: FeedItem = {
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
  tags: ['moab'],
  createdAt: '2026-09-17T00:00:00Z',
};

const PROFILE: PublicDriverProfile = {
  callsign: 'TrailBoss',
  bio: null,
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  publicSetupCount: 1,
  items: [ITEM],
  nextCursor: null,
  hasMore: false,
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

describe('PublicDriverProfileView', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStores();
  });

  it('renders the public garage header, empty bio line, and setup cards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/garage/profiles/TrailBoss')) {
          return jsonResponse(envelope(PROFILE));
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );

    render(
      <MemoryRouter initialEntries={['/u/TrailBoss']}>
        <Routes>
          <Route
            path="/u/:callsign"
            element={<PublicDriverProfileView onRequestAuth={vi.fn()} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '@TrailBoss' })).toBeInTheDocument();
    expect(screen.getByText('No bio logged')).toBeInTheDocument();
    expect(screen.getByText(/public sheets/i)).toBeInTheDocument();
    expect(screen.getByText('Moab Slickrock Spec')).toBeInTheDocument();
  });

  it('shows a not-found garage when the callsign is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            success: false,
            statusCode: 404,
            error: 'Not Found',
            message: ['Driver not found'],
            timestamp: '2026-09-17T00:00:00.000Z',
          },
          404,
        ),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/u/UnknownCallsign']}>
        <Routes>
          <Route
            path="/u/:callsign"
            element={<PublicDriverProfileView onRequestAuth={vi.fn()} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /driver not found/i })).toBeInTheDocument();
  });
});
