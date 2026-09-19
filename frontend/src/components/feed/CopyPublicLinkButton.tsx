import { useEffect, useState } from 'react';

interface CopyPublicLinkButtonProps {
  qrSlug: string;
}

/**
 * Purpose: copy the public /s/:slug inspection URL using the current browser origin.
 */
export function CopyPublicLinkButton({ qrSlug }: CopyPublicLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    const url = `${window.location.origin}/s/${qrSlug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="border border-metal-border bg-pit-black px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-readout-bright transition hover:border-hazard-orange hover:text-hazard-orange"
    >
      {copied ? 'Copied' : 'Copy Public Link'}
    </button>
  );
}
