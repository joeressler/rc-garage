import { FormEvent, useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register';

/**
 * Purpose: collect driver credentials for JWT registration and login without leaving the pit-mat shell.
 */
export function AuthModal({ open, onClose }: AuthModalProps) {
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [callsign, setCallsign] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open && isAuthenticated) {
      onClose();
    }
  }, [open, isAuthenticated, onClose]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLocalError(null);
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, password, callsign });
      }
      onClose();
    } catch {
      setLocalError('Check credentials and try again.');
    }
  }

  const banner = localError ?? error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pit-black/80 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative w-full max-w-md border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="hex-rivet left-2 top-2" />
        <span className="hex-rivet right-2 top-2" />
        <span className="hex-rivet bottom-2 left-2" />
        <span className="hex-rivet bottom-2 right-2" />

        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-hazard-orange">
          Scrutineering Gate
        </p>
        <h2
          id="auth-modal-title"
          className="mt-1 font-display text-3xl uppercase tracking-wide text-readout-bright"
        >
          {mode === 'login' ? 'Driver Login' : 'Register Callsign'}
        </h2>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={`flex-1 border px-3 py-1 font-display text-xs uppercase tracking-[0.2em] ${
              mode === 'login'
                ? 'border-hazard-orange text-hazard-orange'
                : 'border-metal-border text-readout-muted'
            }`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`flex-1 border px-3 py-1 font-display text-xs uppercase tracking-[0.2em] ${
              mode === 'register'
                ? 'border-hazard-orange text-hazard-orange'
                : 'border-metal-border text-readout-muted'
            }`}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
                Callsign
              </span>
              <input
                required
                minLength={3}
                maxLength={30}
                pattern="^[a-zA-Z0-9_-]+$"
                value={callsign}
                onChange={(event) => setCallsign(event.target.value)}
                className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Email
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Password
            </span>
            <input
              required
              type="password"
              minLength={mode === 'register' ? 8 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange"
            />
          </label>

          {banner ? (
            <p className="border border-hazard-stripe bg-pit-black px-3 py-2 font-mono text-xs text-hazard-orange">
              {banner}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-hazard-orange py-2 font-display text-sm uppercase tracking-[0.24em] text-pit-black shadow-hazard-glow disabled:opacity-60"
          >
            {isLoading ? 'Syncing…' : mode === 'login' ? 'Enter Garage' : 'Create Driver'}
          </button>
        </form>
      </div>
    </div>
  );
}
