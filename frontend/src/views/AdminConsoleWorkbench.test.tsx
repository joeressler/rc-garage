import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminOverview, AdminSetupSummary, AdminUserSummary } from '../api/admin';
import { useAdminStore } from '../stores/useAdminStore';
import { useAuthStore } from '../stores/useAuthStore';
import { AdminConsoleWorkbench } from './AdminConsoleWorkbench';

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

const OVERVIEW: AdminOverview = {
  userCount: 25,
  setupCount: 60,
  publicSetupCount: 45,
  hiddenSetupCount: 5,
  suspendedUserCount: 2,
  likes24h: 18,
  openReportCount: 4,
};

const USER: AdminUserSummary = {
  id: 'user-1',
  callsign: 'ApexPredator',
  email: 'apex@example.com',
  role: 'driver',
  isSuspended: false,
  suspendedAt: null,
  suspensionReason: null,
  avatarUrl: null,
  bio: null,
  vehicleCount: 2,
  setupCount: 4,
  createdAt: '2026-09-17T00:00:00Z',
};

const SETUP: AdminSetupSummary = {
  id: 'setup-1',
  title: 'Outlaw Comp Spec',
  vehicleId: 'veh-1',
  userId: 'user-1',
  authorCallsign: 'ApexPredator',
  authorEmail: 'apex@example.com',
  vehicleName: 'Gatekeeper',
  vehicleMake: 'Element',
  vehicleModel: 'Enduro',
  isPublic: true,
  isHidden: false,
  hiddenAt: null,
  hiddenReason: null,
  forkCount: 3,
  likeCount: 7,
  qrSlug: 'slug-outlaw',
  surfaceType: 'slick_rock',
  calculatedFdr: 12.4,
  frontBiasPercentage: 58.0,
  createdAt: '2026-09-17T00:00:00Z',
  updatedAt: '2026-09-17T00:00:00Z',
};

describe('AdminConsoleWorkbench', () => {
  beforeEach(() => {
    useAdminStore.getState().reset();
    useAuthStore.setState({
      token: 'admin-jwt',
      user: {
        id: 'admin-user',
        callsign: 'PitMaster',
        email: 'pitmaster@example.com',
        role: 'admin',
        isSuspended: false,
        vehicleCount: 0,
        setupCount: 0,
        createdAt: '2026-09-17T00:00:00Z',
      },
      isAuthenticated: true,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/admin/overview')) {
          return Promise.resolve(jsonResponse(envelope(OVERVIEW)));
        }
        if (url.includes('/admin/users')) {
          return Promise.resolve(
            jsonResponse(
              envelope({
                items: [USER],
                nextCursor: null,
                hasMore: false,
              }),
            ),
          );
        }
        if (url.includes('/admin/setups')) {
          return Promise.resolve(
            jsonResponse(
              envelope({
                items: [SETUP],
                nextCursor: null,
                hasMore: false,
              }),
            ),
          );
        }
        if (url.includes('/admin/audit-log')) {
          return Promise.resolve(
            jsonResponse(
              envelope({
                items: [],
                nextCursor: null,
                hasMore: false,
              }),
            ),
          );
        }
        if (url.includes('/admin/reports')) {
          return Promise.resolve(
            jsonResponse(
              envelope({
                items: [],
                nextCursor: null,
                hasMore: false,
              }),
            ),
          );
        }
        return Promise.reject(new Error(`unexpected endpoint: ${url}`));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAdminStore.getState().reset();
  });

  it('renders overview KPIs and driver moderation table for admin', async () => {
    render(
      <MemoryRouter>
        <AdminConsoleWorkbench onRequestAuth={() => {}} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Scrutineering Desk')).toBeInTheDocument();
    expect(await screen.findByText('@ApexPredator')).toBeInTheDocument();
    expect(screen.getByText('Drivers Registered')).toBeInTheDocument();
  });

  it('switches to setups tab and renders setup moderation table', async () => {
    render(
      <MemoryRouter>
        <AdminConsoleWorkbench onRequestAuth={() => {}} />
      </MemoryRouter>,
    );

    const setupsTab = screen.getByRole('button', { name: 'Setup Sheets' });
    fireEvent.click(setupsTab);

    expect(await screen.findByText('Outlaw Comp Spec')).toBeInTheDocument();
    expect(screen.getByText('Force-Hide')).toBeInTheDocument();
  });

  it('renders auth gate message when unauthenticated', () => {
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null });

    render(
      <MemoryRouter>
        <AdminConsoleWorkbench onRequestAuth={() => {}} />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Scrutineering Desk (Restricted Access)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Authenticate Operator')).toBeInTheDocument();
  });
});
