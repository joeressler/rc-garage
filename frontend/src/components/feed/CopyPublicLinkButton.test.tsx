import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyPublicLinkButton } from './CopyPublicLinkButton';

describe('CopyPublicLinkButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies the public /s/:slug URL from the browser origin', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<CopyPublicLinkButton qrSlug="v9k2pq1x8m" />);

    fireEvent.click(screen.getByRole('button', { name: /copy public link/i }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/v9k2pq1x8m`);
    expect(await screen.findByRole('button', { name: /^copied$/i })).toBeInTheDocument();
  });
});
