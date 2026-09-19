import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('saves radio-box electronics when registering a chassis', async () => {
    useAuthStore.setState({ token: 'test-jwt-token', isAuthenticated: true });
    const posted: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url.includes('/api/garage/vehicles') && method === 'GET') {
          return new Response(JSON.stringify(envelope([])), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/garage/vehicles') && method === 'POST') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          posted.push(body);
          return new Response(
            JSON.stringify(
              envelope(
                {
                  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                  userId: '11111111-1111-4111-8111-111111111111',
                  name: body.name,
                  make: body.make,
                  model: body.model,
                  scale: body.scale ?? '1/10',
                  vehicleClass: body.vehicleClass ?? 'crawler_scale',
                  isArchived: false,
                  electronics: body.electronics ?? {},
                  setupCount: 0,
                  createdAt: '2026-09-18T00:00:00.000Z',
                  updatedAt: '2026-09-18T00:00:00.000Z',
                },
                201,
              ),
            ),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error(`unexpected fetch ${url} ${method}`);
      }),
    );

    render(<GarageFleetView onRequestAuth={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /add new chassis/i }));

    fireEvent.change(screen.getByLabelText('Bay name'), {
      target: { value: 'Phoenix Trail Rig' },
    });
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Vanquish' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'VS4-10 Phoenix' } });
    fireEvent.change(screen.getByLabelText('Motor name'), { target: { value: 'Holmes 540' } });
    fireEvent.change(screen.getByLabelText('Motor product URL'), {
      target: { value: 'https://example.com/holmes-540' },
    });
    fireEvent.change(screen.getByLabelText('Steering servo torque kg'), {
      target: { value: '25' },
    });

    fireEvent.click(screen.getByRole('button', { name: /register chassis/i }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      name: 'Phoenix Trail Rig',
      electronics: {
        motor: {
          name: 'Holmes 540',
          productUrl: 'https://example.com/holmes-540',
        },
        steeringServo: {
          torqueKg: 25,
        },
      },
    });
    expect(await screen.findByText(/radio box stamped · holmes 540/i)).toBeInTheDocument();
  });

  it('rejects a javascript: product URL without saving the chassis', async () => {
    useAuthStore.setState({ token: 'test-jwt-token', isAuthenticated: true });
    await renderGarage();

    fireEvent.click(screen.getByRole('button', { name: /add new chassis/i }));
    fireEvent.change(screen.getByLabelText('Bay name'), {
      target: { value: 'Phoenix Trail Rig' },
    });
    fireEvent.change(screen.getByLabelText('Make'), { target: { value: 'Vanquish' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'VS4-10 Phoenix' } });
    fireEvent.change(screen.getByLabelText('Motor product URL'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /register chassis/i }));

    expect(await screen.findByText(/must start with http:\/\/ or https:\/\//i)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /add new chassis/i })).toBeInTheDocument();
  });

  it('saves radio-box edits on an existing chassis', async () => {
    useAuthStore.setState({ token: 'test-jwt-token', isAuthenticated: true });
    const existing = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: '11111111-1111-4111-8111-111111111111',
      name: 'Phoenix Trail Rig',
      make: 'Vanquish',
      model: 'VS4-10 Phoenix',
      scale: '1/10' as const,
      vehicleClass: 'crawler_scale' as const,
      isArchived: false,
      electronics: {},
      setupCount: 0,
      createdAt: '2026-09-18T00:00:00.000Z',
      updatedAt: '2026-09-18T00:00:00.000Z',
    };
    const putBodies: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        if (url.includes('/api/garage/vehicles') && method === 'GET') {
          return new Response(JSON.stringify(envelope([existing])), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/garage/vehicles/') && method === 'PUT') {
          const body = JSON.parse(String(init?.body ?? '{}'));
          putBodies.push(body);
          return new Response(
            JSON.stringify(
              envelope({
                ...existing,
                ...body,
                electronics: body.electronics ?? existing.electronics,
              }),
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        throw new Error(`unexpected fetch ${url} ${method}`);
      }),
    );

    render(<GarageFleetView onRequestAuth={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /edit chassis/i }));
    fireEvent.change(screen.getByLabelText('ESC name'), { target: { value: 'Hobbywing 1080' } });
    fireEvent.change(screen.getByLabelText('ESC product URL'), {
      target: { value: 'https://example.com/hobbywing-1080' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save chassis spec/i }));

    await waitFor(() => expect(putBodies).toHaveLength(1));
    expect(putBodies[0]).toMatchObject({
      electronics: {
        esc: {
          name: 'Hobbywing 1080',
          productUrl: 'https://example.com/hobbywing-1080',
        },
      },
    });
  });
});
