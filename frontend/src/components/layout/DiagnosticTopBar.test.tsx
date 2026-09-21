import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/useAuthStore';
import { useGarageStore } from '../../stores/useGarageStore';
import { useNotificationStore } from '../../stores/useNotificationStore';
import { DiagnosticTopBar } from './DiagnosticTopBar';

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

describe('DiagnosticTopBar', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: 'test-jwt-token',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        callsign: 'TrailBoss',
        email: 'trailboss@example.com',
        role: 'driver',
        isSuspended: false,
        createdAt: '2026-09-16T00:00:00.000Z',
        vehicleCount: 2,
        setupCount: 3,
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    useGarageStore.getState().reset();
    useNotificationStore.getState().reset();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(envelope({ unreadCount: 0 }))),
    );
  });

  afterEach(() => {
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    useGarageStore.getState().reset();
    useNotificationStore.getState().reset();
    vi.unstubAllGlobals();
  });

  it('opens account settings from the authenticated Settings control', () => {
    render(
      <MemoryRouter>
        <DiagnosticTopBar onRequestAuth={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog', { name: /account settings/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(screen.getByRole('dialog', { name: /account settings/i })).toBeInTheDocument();
    expect(screen.queryByText(/forgot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/verify/i)).not.toBeInTheDocument();
  });
});
