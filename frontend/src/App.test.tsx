import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useAuthStore } from './stores/useAuthStore';
import { useGarageStore } from './stores/useGarageStore';
import { useNotificationStore } from './stores/useNotificationStore';
import { useSetupStore } from './stores/useSetupStore';

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

function resetStores() {
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
  useGarageStore.getState().reset();
  useNotificationStore.getState().reset();
  useSetupStore.getState().reset();
  window.localStorage.removeItem('rc-garage-auth');
}

describe('App guest landing', () => {
  beforeEach(() => {
    resetStores();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/garage/feed')) {
          return jsonResponse(
            envelope({
              items: [],
              nextCursor: null,
              hasMore: false,
            }),
          );
        }
        throw new Error(`unexpected fetch ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStores();
  });

  it('sends unauthenticated visitors from / to the community feed workbench', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Global RC Setup Workbench')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /rack sealed/i })).not.toBeInTheDocument();
  });
});
