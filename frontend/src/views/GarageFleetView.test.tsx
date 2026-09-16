import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/useAuthStore';
import { useGarageStore } from '../stores/useGarageStore';
import { GarageFleetView } from './GarageFleetView';

function envelope<T>(data: T, statusCode = 200) {
  return {
    success: true as const,
    statusCode,
    data,
    timestamp: '2026-09-16T00:00:00.000Z',
  };
}

function emptyFleetResponse(): Response {
  return new Response(JSON.stringify(envelope([])), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resetStores(): void {
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
  useGarageStore.getState().reset();
}

let resolveFetch: ((value: Response) => void) | null;

async function renderGarage(onRequestAuth: () => void = vi.fn()) {
  const view = render(<GarageFleetView onRequestAuth={onRequestAuth} />);
  if (resolveFetch) {
    await act(async () => {
      resolveFetch?.(emptyFleetResponse());
      await Promise.resolve();
      await Promise.resolve();
    });
  }
  return view;
}

describe('GarageFleetView', () => {
  beforeEach(() => {
    resetStores();
    resolveFetch = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetStores();
  });

  it('shows industrial onboarding for guests', async () => {
    const onRequestAuth = vi.fn();
    await renderGarage(onRequestAuth);

    expect(screen.getByRole('heading', { name: /rack sealed/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open scrutineering gate/i }));
    expect(onRequestAuth).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('prompts an authenticated empty garage to register the first vehicle', async () => {
    useAuthStore.setState({ token: 'test-jwt-token', isAuthenticated: true });
    await renderGarage();

    expect(screen.getByRole('heading', { name: /empty chassis rack/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /register the first vehicle/i }));
    expect(screen.getByRole('dialog', { name: /add new chassis/i })).toBeInTheDocument();
  });

  it('keeps the add-chassis modal open and surfaces Zod errors for an empty name', async () => {
    useAuthStore.setState({ token: 'test-jwt-token', isAuthenticated: true });
    await renderGarage();

    fireEvent.click(screen.getByRole('button', { name: /add new chassis/i }));
    const dialog = screen.getByRole('dialog', { name: /add new chassis/i });
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(await screen.findByText(/name the chassis bay/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /add new chassis/i })).toBeInTheDocument();
  });
});
