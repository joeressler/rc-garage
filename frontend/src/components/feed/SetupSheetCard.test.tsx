import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { FeedItem } from '../../api/feed';
import { SetupSheetCard } from './SetupSheetCard';

const ITEM: FeedItem = {
  id: 'feed-setup-1',
  title: 'Moab Slickrock Spec',
  author: { callsign: 'TrailBoss', avatarUrl: null },
  vehicle: { make: 'Element', model: 'Enduro Sendero HD', class: 'crawler_scale' },
  calculatedFdr: 10.5,
  frontBiasPercentage: 60.0,
  surfaceType: 'slick_rock',
  forkCount: 4,
  likeCount: 9,
  isLikedByCaller: false,
  qrSlug: 'v9k2pq1x8m',
  tags: ['moab', 'comp'],
  createdAt: '2026-09-17T00:00:00Z',
};

function renderCard(item: FeedItem, handlers?: Partial<{
  onInspect: (item: FeedItem) => void;
  onQuickFork: (item: FeedItem) => void;
  onToggleLike: (item: FeedItem) => void;
}>) {
  return render(
    <MemoryRouter initialEntries={['/feed']}>
      <Routes>
        <Route
          path="/feed"
          element={
            <SetupSheetCard
              item={item}
              onInspect={handlers?.onInspect ?? vi.fn()}
              onQuickFork={handlers?.onQuickFork ?? vi.fn()}
              onToggleLike={handlers?.onToggleLike ?? vi.fn()}
            />
          }
        />
        <Route path="/u/:callsign" element={<div>driver-garage</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SetupSheetCard', () => {
  it('links the author callsign to the public driver garage', () => {
    renderCard(ITEM);

    fireEvent.click(screen.getByRole('link', { name: /@TrailBoss/i }));
    expect(screen.getByText('driver-garage')).toBeInTheDocument();
  });

  it('does not navigate when like or fork are clicked', () => {
    const onToggleLike = vi.fn();
    const onQuickFork = vi.fn();
    renderCard(ITEM, { onToggleLike, onQuickFork });

    fireEvent.click(screen.getByRole('button', { name: /like setup sheet/i }));
    fireEvent.click(screen.getByRole('button', { name: /^fork$/i }));

    expect(onToggleLike).toHaveBeenCalledTimes(1);
    expect(onQuickFork).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('driver-garage')).not.toBeInTheDocument();
    expect(screen.getByText('Moab Slickrock Spec')).toBeInTheDocument();
  });

  it('renders an https avatar image and initials when the URL is missing', () => {
    const { unmount } = renderCard({
      ...ITEM,
      author: { callsign: 'TrailBoss', avatarUrl: 'https://example.com/avatar.png' },
    });
    const image = document.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://example.com/avatar.png');
    expect(image).toHaveAttribute('alt', '');
    unmount();

    renderCard(ITEM);
    expect(screen.getByText('TR')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });
});
