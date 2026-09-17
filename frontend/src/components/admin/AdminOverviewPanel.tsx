import type { AdminOverview } from '../../api/admin';

interface AdminOverviewPanelProps {
  overview: AdminOverview | null;
  isLoading: boolean;
}

/**
 * Purpose: render the Scrutineering Desk industrial KPI strip for platform operators.
 */
export function AdminOverviewPanel({
  overview,
  isLoading,
}: AdminOverviewPanelProps) {
  const stats = [
    {
      label: 'Drivers Registered',
      value: overview ? overview.userCount : '-',
      accent: 'text-readout-bright',
      indicator: 'bg-readout-dim',
    },
    {
      label: 'Public Setups',
      value: overview ? overview.publicSetupCount : '-',
      accent: 'text-neon-radio',
      indicator: 'bg-neon-radio',
    },
    {
      label: 'Force-Hidden Setups',
      value: overview ? overview.hiddenSetupCount : '-',
      accent: 'text-hazard-orange',
      indicator: 'bg-hazard-orange',
    },
    {
      label: 'Suspended Accounts',
      value: overview ? overview.suspendedUserCount : '-',
      accent: 'text-nitromethane',
      indicator: 'bg-nitromethane',
    },
    {
      label: 'Community Likes (24h)',
      value: overview ? overview.likes24h : '-',
      accent: 'text-anodized-blue',
      indicator: 'bg-anodized-blue',
    },
    {
      label: 'Total Sheets Logged',
      value: overview ? overview.setupCount : '-',
      accent: 'text-readout-bright',
      indicator: 'bg-metal-highlight',
    },
  ];

  return (
    <section
      aria-label="Admin overview KPIs"
      className="border border-metal-border bg-pit-grease p-4 shadow-beveled-panel"
    >
      <div className="mb-3 flex items-center justify-between border-b border-metal-border pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-hazard-orange animate-pulse" />
          <h2 className="font-display text-sm uppercase tracking-[0.2em] text-readout-bright">
            Platform Telemetry & Moderation Status
          </h2>
        </div>
        {isLoading && (
          <span className="font-mono text-xs text-readout-dim animate-pulse">
            Syncing telemetry...
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col justify-between border border-metal-border/60 bg-pit-black/60 p-3"
          >
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${stat.indicator}`} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-readout-muted">
                {stat.label}
              </span>
            </div>
            <div
              className={`mt-2 font-mono text-2xl font-bold tracking-tight ${stat.accent}`}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
