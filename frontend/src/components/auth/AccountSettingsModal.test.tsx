import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/useAuthStore';
import { AccountSettingsModal } from './AccountSettingsModal';

const TOKEN = 'test-jwt-token';
const PROFILE = {
  id: '11111111-1111-4111-8111-111111111111',
  callsign: 'TrailBoss',
  email: 'trailboss@example.com',
  role: 'driver' as const,
  isSuspended: false,
  createdAt: '2026-09-16T00:00:00.000Z',
  vehicleCount: 1,
  setupCount: 2,
  bio: 'Moab regular',
  avatarUrl: 'https://cdn.example.com/boss.png',
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

function lastPasswordField(): HTMLElement {
  const passwords = screen.getAllByLabelText(/^password$/i);
  const field = passwords[passwords.length - 1];
  if (!field) {
    throw new Error('Delete-account password field missing');
  }
  return field;
}

function signedIn(): void {
  useAuthStore.setState({
    token: TOKEN,
    user: PROFILE,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}

describe('AccountSettingsModal', () => {
  beforeEach(() => {
    signedIn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('unexpected fetch'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    window.localStorage.removeItem('rc-garage-auth');
  });

  it('does not render when closed', () => {
    const { container } = render(
      <AccountSettingsModal open={false} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('saves bio and https avatar URL through PATCH /auth/profile', async () => {
    const updated = {
      ...PROFILE,
      bio: 'Slickrock specialist',
      avatarUrl: 'https://cdn.example.com/new.png',
    };
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(envelope(updated)));

    render(<AccountSettingsModal open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/^bio$/i), {
      target: { value: 'Slickrock specialist' },
    });
    fireEvent.change(screen.getByLabelText(/avatar url/i), {
      target: { value: 'https://cdn.example.com/new.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/garage/auth/profile');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({
      bio: 'Slickrock specialist',
      avatarUrl: 'https://cdn.example.com/new.png',
    });
    expect(screen.getByText(/profile saved/i)).toBeInTheDocument();
  });

  it('requires typing DELETE before calling the self-delete API', async () => {
    const onClose = vi.fn();
    render(<AccountSettingsModal open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/^confirmation$/i), {
      target: { value: 'nope' },
    });
    fireEvent.change(lastPasswordField(), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    expect(
      screen.getByText(/Type DELETE to confirm account removal/i),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('deletes the account and closes the modal after confirmation', async () => {
    const onClose = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(envelope({ deleted: true })),
    );

    render(<AccountSettingsModal open onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/^confirmation$/i), {
      target: { value: 'DELETE' },
    });
    fireEvent.change(lastPasswordField(), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [path, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/garage/auth/me');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(String(init.body))).toEqual({
      password: 'password123',
      confirmation: 'DELETE',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
