import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../../stores/useAuthStore';
import { AuthModal } from './AuthModal';

const TOKEN = 'test-jwt-token';
const PROFILE = {
  id: '11111111-1111-4111-8111-111111111111',
  callsign: 'TrailBoss',
  email: 'trailboss@example.com',
  role: 'driver' as const,
  isSuspended: false,
  createdAt: '2026-09-16T00:00:00.000Z',
};

function envelope<T>(data: T, statusCode = 201) {
  return {
    success: true as const,
    statusCode,
    data,
    timestamp: '2026-09-16T00:00:00.000Z',
  };
}

function jsonResponse(data: unknown, status = 201): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resetAuthStore(): void {
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  });
  window.localStorage.removeItem('rc-garage-auth');
}

describe('AuthModal', () => {
  beforeEach(() => {
    resetAuthStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('unexpected fetch'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthStore();
  });

  it('does not render when closed', () => {
    const { container } = render(<AuthModal open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('requires the age attestation checkbox on register and never offers forgot-password', () => {
    render(<AuthModal open onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^register$/i }));

    expect(
      screen.getByText(/I confirm I am 13 years of age or older/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/forgot/i)).not.toBeInTheDocument();

    const password = screen.getByLabelText('Password', { selector: 'input' });
    expect(password).toHaveAttribute('minLength', '10');

    fireEvent.change(screen.getByRole('textbox', { name: /^callsign$/i }), {
      target: { value: 'TrailBoss' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
      target: { value: 'trailboss@example.com' },
    });
    fireEvent.change(password, { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create driver/i }));

    expect(
      screen.getByText(/Confirm you are 13 years of age or older/i),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(
      screen.getByText(/I agree to the/i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Terms$/i }).length).toBeGreaterThan(0);
  });

  it('requires the legal checkbox after age attestation', () => {
    render(<AuthModal open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^register$/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /^callsign$/i }), {
      target: { value: 'TrailBoss' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
      target: { value: 'trailboss@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password', { selector: 'input' }), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /13 years of age/i }));
    fireEvent.click(screen.getByRole('button', { name: /create driver/i }));

    expect(
      screen.getByText(/Agree to the Terms, Privacy Policy, and Community Guidelines/i),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('registers with ageAttested true after the checkbox is confirmed', async () => {
    const onClose = vi.fn();
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/register')) {
        return jsonResponse(envelope({ token: TOKEN, user: PROFILE }, 201), 201);
      }
      if (url.includes('/auth/me')) {
        return jsonResponse(
          envelope({ ...PROFILE, vehicleCount: 0, setupCount: 0 }, 200),
          200,
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    render(<AuthModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /^register$/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /^callsign$/i }), {
      target: { value: 'TrailBoss' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^email$/i }), {
      target: { value: 'trailboss@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password', { selector: 'input' }), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /13 years of age/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree to the/i }));
    fireEvent.submit(screen.getByRole('button', { name: /create driver/i }).closest('form')!);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const registerCall = vi.mocked(fetch).mock.calls.find(([path]) =>
      String(path).includes('/auth/register'),
    );
    expect(registerCall).toBeDefined();
    expect(JSON.parse(String(registerCall?.[1]?.body))).toMatchObject({
      email: 'trailboss@example.com',
      password: 'password123',
      callsign: 'TrailBoss',
      ageAttested: true,
      acceptedLegal: true,
      recaptchaToken: 'dev-bypass',
    });
  });
});
