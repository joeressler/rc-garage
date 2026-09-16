import { useAuthStore } from '../../stores/useAuthStore';
import { useGarageStore } from '../../stores/useGarageStore';

interface DiagnosticTopBarProps {
  onRequestAuth: () => void;
}

/**
 * Purpose: identify the signed-in driver and surface live fleet telemetry in the workbench header.
 */
export function DiagnosticTopBar({ onRequestAuth }: DiagnosticTopBarProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const vehicles = useGarageStore((state) => state.vehicles);
  const hasLoaded = useGarageStore((state) => state.hasLoaded);
  const fleetCount = isAuthenticated
    ? hasLoaded
      ? vehicles.length
      : (user?.vehicleCount ?? 0)
    : 0;
  const callsign = user?.callsign ?? 'GUEST';

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-metal-border bg-gradient-to-b from-pit-steel to-pit-grease px-4 py-3 shadow-beveled-panel sm:px-6">
      <div className="flex items-center gap-3">
        <span className="font-display text-xl uppercase tracking-[0.28em] text-hazard-orange sm:text-2xl">
          Pit-Mat Workbench
        </span>
        <span className="hidden font-mono text-[10px] uppercase tracking-widest text-readout-muted sm:inline">
          RC GARAGE
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:gap-5">
        <div className="border border-metal-border bg-pit-black px-3 py-1">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-readout-dim">
            Callsign
          </p>
          <p className="font-mono text-sm text-readout-bright">{callsign}</p>
        </div>

        <div className="flex items-center gap-2 border border-metal-border bg-pit-black px-3 py-1">
          <span
            className="telemetry-beacon inline-block h-2.5 w-2.5 rounded-full bg-neon-radio shadow-neon-glow"
            aria-hidden
          />
          <div>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-readout-dim">
              Telemetry
            </p>
            <p className="font-mono text-sm text-neon-radio">ONLINE</p>
          </div>
        </div>

        <div className="border border-metal-border bg-pit-black px-3 py-1">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-readout-dim">
            Fleet
          </p>
          <p className="font-mono text-sm text-readout-bright">
            {fleetCount} CHASSIS
          </p>
        </div>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={logout}
            className="border border-metal-border bg-pit-black px-3 py-2 font-display text-xs uppercase tracking-[0.2em] text-readout-dim transition hover:border-hazard-orange hover:text-hazard-orange"
          >
            Logout
          </button>
        ) : (
          <button
            type="button"
            onClick={onRequestAuth}
            className="bg-hazard-orange px-3 py-2 font-display text-xs uppercase tracking-[0.2em] text-pit-black shadow-hazard-glow transition hover:bg-hazard-stripe"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
}
