import { useState } from 'react';

interface DriverAvatarProps {
  callsign: string;
  avatarUrl: string | null;
  size: 'sm' | 'md';
}

function isHttpsUrl(value: string | null): value is string {
  return Boolean(value && /^https:\/\//i.test(value));
}

/**
 * Purpose: derive 1–2 initials from a callsign when no https avatar is available.
 */
export function driverInitials(callsign: string): string {
  const cleaned = callsign.replace(/[^a-zA-Z0-9]/g, '');
  const source = cleaned || callsign;
  return source.slice(0, 2).toUpperCase();
}

/**
 * Purpose: render a decorative driver avatar beside a visible callsign without leaking http image hosts.
 */
export function DriverAvatar({ callsign, avatarUrl, size }: DriverAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = isHttpsUrl(avatarUrl) && !imageFailed;
  const sizeClass = size === 'md' ? 'h-12 w-12 text-sm' : 'h-6 w-6 text-[9px]';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-neon-radio bg-pit-steel ${sizeClass}`}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="font-mono font-bold uppercase tracking-wider text-neon-radio">
          {driverInitials(callsign)}
        </span>
      )}
    </span>
  );
}
