import type { FeedItem } from '../../api/feed';
import { formatFdr, VEHICLE_CLASS_LABELS } from '../../lib/vehicle-labels';

interface SetupSheetCardProps {
  item: FeedItem;
  onInspect: (item: FeedItem) => void;
  onQuickFork: (item: FeedItem) => void;
  onToggleLike: (item: FeedItem) => void;
  isLiking?: boolean;
}

/**
 * Purpose: render an interactive community setup sheet card displaying chassis stencils, live telemetry stats, and social fork/star counters.
 */
export function SetupSheetCard({
  item,
  onInspect,
  onQuickFork,
  onToggleLike,
  isLiking = false,
}: SetupSheetCardProps) {
  const { title, author, vehicle, calculatedFdr, frontBiasPercentage, surfaceType, forkCount, likeCount, isLikedByCaller } = item;
  const classLabel = VEHICLE_CLASS_LABELS[vehicle.class] ?? vehicle.class;

  return (
    <article
      data-testid={`setup-card-${item.id}`}
      className="relative flex flex-col justify-between border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-5 shadow-beveled-panel transition hover:border-hazard-orange"
    >
      {/* Background Stencil Watermark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-3 bottom-12 select-none font-display text-4xl font-black uppercase tracking-widest text-metal-border/20"
      >
        {classLabel.split(' ')[0]}
      </div>

      <div>
        {/* Card Header: Author Callout & Class Badge */}
        <div className="flex items-start justify-between gap-2 border-b border-metal-border pb-3">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-hazard-orange">
              @{author.callsign}
            </span>
            <h3 className="mt-0.5 font-display text-base font-bold uppercase tracking-wider text-readout-bright">
              {title}
            </h3>
          </div>
          <span className="border border-neon-radio/50 bg-pit-black px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neon-radio shadow-neon-glow">
            {classLabel}
          </span>
        </div>

        {/* Vehicle Metadata Subheading */}
        <div className="mt-2.5 flex items-center justify-between text-xs text-readout-dim">
          <span className="font-mono uppercase tracking-wider">
            {vehicle.make} {vehicle.model}
          </span>
          <span className="border border-metal-border/80 bg-pit-black px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-readout-muted">
            {surfaceType.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Telemetry Stats Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 border border-metal-border bg-pit-black/80 p-3">
          <div>
            <span className="block font-mono text-[9px] uppercase tracking-widest text-readout-muted">
              Final Drive
            </span>
            <span className="font-mono text-sm font-bold text-readout-bright">
              {formatFdr(calculatedFdr)}
            </span>
          </div>
          <div>
            <span className="block font-mono text-[9px] uppercase tracking-widest text-readout-muted">
              Front CoG
            </span>
            <span className="font-mono text-sm font-bold text-hazard-orange">
              {frontBiasPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer: Social Metrics & Action Buttons */}
      <div className="mt-5 border-t border-metal-border pt-3">
        <div className="flex items-center justify-between">
          {/* Social Counters */}
          <div className="flex items-center gap-3">
            {/* Like / Endorse Button */}
            <button
              type="button"
              onClick={() => onToggleLike(item)}
              disabled={isLiking}
              aria-label={`Like setup sheet ${title}, ${likeCount} likes`}
              className={`flex items-center gap-1.5 font-mono text-xs transition ${
                isLikedByCaller
                  ? 'text-nitromethane font-bold'
                  : 'text-readout-muted hover:text-nitromethane'
              }`}
            >
              <svg
                className="h-4 w-4"
                fill={isLikedByCaller ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span>{likeCount}</span>
            </button>

            {/* Fork Counter */}
            <div
              className="flex items-center gap-1 font-mono text-xs text-readout-muted"
              title="Forks branched from this setup"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                />
              </svg>
              <span>{forkCount}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onQuickFork(item)}
              className="border border-metal-border bg-pit-black px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-readout-bright hover:border-hazard-orange hover:text-hazard-orange"
            >
              Fork
            </button>
            <button
              type="button"
              onClick={() => onInspect(item)}
              className="border border-hazard-orange bg-hazard-orange/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-hazard-orange hover:bg-hazard-orange hover:text-pit-black transition"
            >
              Inspect
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
