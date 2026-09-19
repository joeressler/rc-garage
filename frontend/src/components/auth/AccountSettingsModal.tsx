import { FormEvent, useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';

interface AccountSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Purpose: let a signed-in driver edit bio/avatar URL, rotate credentials, and delete the account.
 */
export function AccountSettingsModal({ open, onClose }: AccountSettingsModalProps) {
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const changePassword = useAuthStore((state) => state.changePassword);
  const changeEmail = useAuthStore((state) => state.changeEmail);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);

  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [nextEmail, setNextEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setBio(user?.bio ?? '');
    setAvatarUrl(user?.avatarUrl ?? '');
    setNextEmail(user?.email ?? '');
    setLocalError(null);
    setStatus(null);
    setCurrentPassword('');
    setNextPassword('');
    setEmailPassword('');
    setDeletePassword('');
    setDeleteConfirmation('');
  }, [open, user?.bio, user?.avatarUrl, user?.email]);

  if (!open) {
    return null;
  }

  const banner = localError ?? error;

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLocalError(null);
    setStatus(null);
    try {
      await updateProfile({
        bio: bio.trim() === '' ? null : bio,
        avatarUrl: avatarUrl.trim() === '' ? null : avatarUrl.trim(),
      });
      setStatus('Profile saved.');
    } catch {
      setLocalError('Unable to save profile.');
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLocalError(null);
    setStatus(null);
    try {
      await changePassword({ currentPassword, nextPassword });
      setCurrentPassword('');
      setNextPassword('');
      setStatus('Password updated.');
    } catch {
      setLocalError('Unable to change password.');
    }
  }

  async function handleChangeEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLocalError(null);
    setStatus(null);
    try {
      await changeEmail({ password: emailPassword, nextEmail });
      setEmailPassword('');
      setStatus('Email updated.');
    } catch {
      setLocalError('Unable to change email.');
    }
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLocalError(null);
    setStatus(null);
    if (deleteConfirmation !== 'DELETE') {
      setLocalError('Type DELETE to confirm account removal.');
      return;
    }
    try {
      await deleteAccount({ password: deletePassword, confirmation: 'DELETE' });
      onClose();
    } catch {
      setLocalError('Unable to delete account.');
    }
  }

  const fieldClass =
    'mt-1 w-full border border-metal-border bg-pit-black px-3 py-2 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pit-black/80 px-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-6 shadow-beveled-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="hex-rivet left-2 top-2" />
        <span className="hex-rivet right-2 top-2" />
        <span className="hex-rivet bottom-2 left-2" />
        <span className="hex-rivet bottom-2 right-2" />

        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-hazard-orange">
          Driver Bay
        </p>
        <h2
          id="account-settings-title"
          className="mt-1 font-display text-3xl uppercase tracking-wide text-readout-bright"
        >
          Account Settings
        </h2>
        <p className="mt-1 font-mono text-xs text-readout-muted">@{user?.callsign}</p>

        {banner ? (
          <p className="mt-4 border border-hazard-stripe bg-pit-black px-3 py-2 font-mono text-xs text-hazard-orange">
            {banner}
          </p>
        ) : null}
        {status ? (
          <p className="mt-4 border border-neon-radio bg-pit-black px-3 py-2 font-mono text-xs text-neon-radio">
            {status}
          </p>
        ) : null}

        <form className="mt-5 space-y-3" onSubmit={(event) => void handleSaveProfile(event)}>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Bio
            </span>
            <textarea
              maxLength={250}
              rows={3}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Avatar URL (https)
            </span>
            <input
              type="url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-hazard-orange px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-pit-black shadow-hazard-glow disabled:opacity-60"
          >
            Save Profile
          </button>
        </form>

        <form className="mt-8 space-y-3 border-t border-metal-border pt-5" onSubmit={(event) => void handleChangePassword(event)}>
          <p className="font-display text-sm uppercase tracking-[0.16em] text-readout-bright">
            Change Password
          </p>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Current Password
            </span>
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Next Password
            </span>
            <input
              required
              type="password"
              minLength={10}
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="border border-metal-border bg-pit-black px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-readout-bright hover:border-hazard-orange disabled:opacity-60"
          >
            Update Password
          </button>
        </form>

        <form className="mt-8 space-y-3 border-t border-metal-border pt-5" onSubmit={(event) => void handleChangeEmail(event)}>
          <p className="font-display text-sm uppercase tracking-[0.16em] text-readout-bright">
            Change Email
          </p>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Password
            </span>
            <input
              required
              type="password"
              value={emailPassword}
              onChange={(event) => setEmailPassword(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Next Email
            </span>
            <input
              required
              type="email"
              value={nextEmail}
              onChange={(event) => setNextEmail(event.target.value)}
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="border border-metal-border bg-pit-black px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-readout-bright hover:border-hazard-orange disabled:opacity-60"
          >
            Update Email
          </button>
        </form>

        <form className="mt-8 space-y-3 border-t border-hazard-orange/40 pt-5" onSubmit={(event) => void handleDelete(event)}>
          <p className="font-display text-sm uppercase tracking-[0.16em] text-hazard-orange">
            Delete Account
          </p>
          <p className="font-sans text-xs text-readout-dim">
            Type DELETE and your password. Fleet sheets cascade; fork children keep lineage pointers.
          </p>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Confirmation
            </span>
            <input
              required
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-dim">
              Password
            </span>
            <input
              required
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              className={fieldClass}
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="border border-hazard-orange bg-hazard-orange/10 px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-hazard-orange disabled:opacity-60"
          >
            Delete My Account
          </button>
        </form>
      </div>
    </div>
  );
}
