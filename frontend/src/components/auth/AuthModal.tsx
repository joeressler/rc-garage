import { FormEvent, useEffect, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useAuthStore } from '../../stores/useAuthStore';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? '';
const USE_LIVE_RECAPTCHA =
  RECAPTCHA_SITE_KEY.length > 0 && RECAPTCHA_SITE_KEY !== 'dev-bypass';

/**
 * Purpose: collect driver credentials, COPPA age attestation, legal acceptance, and a reCAPTCHA v2 token without leaving the pit-mat shell.
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
  const [ageAttested, setAgeAttested] = useState(false);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA | null>(null);

  useEffect(() => {
    if (open && isAuthenticated) {
      onClose();
    }
  }, [open, isAuthenticated, onClose]);

  if (!open) {
    return null;
  }

  function resetRecaptcha(): void {
    recaptchaRef.current?.reset();
    setRecaptchaToken(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLocalError(null);
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        if (!ageAttested) {
          setLocalError('Confirm you are 13 years of age or older.');
          return;
        }
        if (!acceptedLegal) {
          setLocalError(
            'Agree to the Terms, Privacy Policy, and Community Guidelines.',
          );
          return;
        }
        if (USE_LIVE_RECAPTCHA && !recaptchaToken) {
          setLocalError('Complete the reCAPTCHA challenge.');
          return;
        }
        await register({
          email,
          password,
          callsign,
          ageAttested: true,
          acceptedLegal: true,
          recaptchaToken: recaptchaToken || 'dev-bypass',
        });
      }
      onClose();
    } catch {
      if (mode === 'register') {
        resetRecaptcha();
      }
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
            onClick={() => {
              setMode('login');
              resetRecaptcha();
            }}
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
              minLength={mode === 'register' ? 10 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange"
            />
          </label>

          {mode === 'register' ? (
            <>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={ageAttested}
                  onChange={(event) => setAgeAttested(event.target.checked)}
                  className="mt-1"
                />
                <span className="font-sans text-xs text-readout-dim">
                  I confirm I am 13 years of age or older.
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={acceptedLegal}
                  onChange={(event) => setAcceptedLegal(event.target.checked)}
                  className="mt-1"
                />
                <span className="font-sans text-xs text-readout-dim">
                  I agree to the{' '}
                  <a
                    href="/legal/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-hazard-orange underline"
                  >
                    Terms
                  </a>
                  ,{' '}
                  <a
                    href="/legal/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-hazard-orange underline"
                  >
                    Privacy Policy
                  </a>
                  , and{' '}
                  <a
                    href="/legal/guidelines"
                    target="_blank"
                    rel="noreferrer"
                    className="text-hazard-orange underline"
                  >
                    Community Guidelines
                  </a>
                  .
                </span>
              </label>
              {USE_LIVE_RECAPTCHA ? (
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={RECAPTCHA_SITE_KEY}
                  theme="dark"
                  onChange={(token) => setRecaptchaToken(token)}
                />
              ) : null}
              <p className="font-sans text-[10px] leading-relaxed text-readout-muted">
                This site is protected by reCAPTCHA and the Google{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-hazard-orange underline"
                >
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a
                  href="https://policies.google.com/terms"
                  target="_blank"
                  rel="noreferrer"
                  className="text-hazard-orange underline"
                >
                  Terms of Use
                </a>{' '}
                apply.
              </p>
            </>
          ) : null}

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

        <nav className="mt-4 flex flex-wrap justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">
          <a className="hover:text-hazard-orange" href="/legal/terms" target="_blank" rel="noreferrer">
            Terms
          </a>
          <a
            className="hover:text-hazard-orange"
            href="/legal/privacy"
            target="_blank"
            rel="noreferrer"
          >
            Privacy
          </a>
          <a
            className="hover:text-hazard-orange"
            href="/legal/guidelines"
            target="_blank"
            rel="noreferrer"
          >
            Guidelines
          </a>
        </nav>
      </div>
    </div>
  );
}
