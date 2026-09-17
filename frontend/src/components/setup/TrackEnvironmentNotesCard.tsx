import type { GripLevel, SurfaceType } from '../../api/setups';
import { GRIP_LEVELS, SURFACES } from '../../api/setups-constants';
import { useSetupStore } from '../../stores/useSetupStore';

/**
 * Purpose: terrain surface typology picker, grip level selector, location tag, and driver notes.
 */
export function TrackEnvironmentNotesCard() {
  const trackConditions = useSetupStore((state) => state.activeSettings.trackConditions);
  const driverNotes = useSetupStore((state) => state.activeSettings.driverNotes ?? '');
  const updateTrackConditions = useSetupStore((state) => state.updateTrackConditions);
  const updateDriverNotes = useSetupStore((state) => state.updateDriverNotes);

  return (
    <article className="relative border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-5 shadow-beveled-panel">
      <span className="hex-rivet left-2 top-2" />
      <span className="hex-rivet right-2 top-2" />

      <div className="flex items-center justify-between border-b border-metal-border pb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hazard-orange">
            Drawer D · Trail Environment
          </p>
          <h2 className="font-display text-xl uppercase tracking-wide text-readout-bright">
            Track Conditions & Driver Notes
          </h2>
        </div>
        <span className="font-mono text-[10px] text-readout-dim">FIELD METADATA</span>
      </div>

      <div className="mt-5 space-y-4">
        {/* Surface & Grip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="font-mono text-xs uppercase tracking-wider text-readout-dim">
              Surface Typology
            </label>
            <select
              value={trackConditions.surface}
              onChange={(e) =>
                updateTrackConditions({ surface: e.target.value as SurfaceType })
              }
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-1.5 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
            >
              {SURFACES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-mono text-xs uppercase tracking-wider text-readout-dim">
              Grip Level
            </label>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {GRIP_LEVELS.map((g) => {
                const isSelected = trackConditions.grip === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => updateTrackConditions({ grip: g.value as GripLevel })}
                    className={`py-1.5 text-center font-mono text-[10px] uppercase tracking-wider transition ${
                      isSelected
                        ? 'border border-hazard-orange bg-hazard-orange/20 text-hazard-orange font-bold'
                        : 'border border-metal-border bg-pit-black text-readout-dim hover:text-readout-bright'
                    }`}
                  >
                    {g.value}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Location Tag & Ambient Temperature */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="font-mono text-xs uppercase tracking-wider text-readout-dim">
              Location / Trail Tag
            </label>
            <input
              type="text"
              value={trackConditions.locationTag ?? ''}
              onChange={(e) => updateTrackConditions({ locationTag: e.target.value })}
              placeholder="e.g. Moab Hell's Revenge / Glen Helen"
              maxLength={80}
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-1.5 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
            />
          </div>

          <div>
            <label className="font-mono text-xs uppercase tracking-wider text-readout-dim">
              Ambient Temp (°C)
            </label>
            <input
              type="number"
              min={-20}
              max={60}
              value={trackConditions.ambientTempCelsius ?? 20}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val)) updateTrackConditions({ ambientTempCelsius: val });
              }}
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-1.5 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
            />
          </div>
        </div>

        {/* Driver Notes Textarea */}
        <div>
          <label className="font-mono text-xs uppercase tracking-wider text-readout-dim">
            Driver Setup Notes & Observations
          </label>
          <textarea
            rows={3}
            value={driverNotes}
            onChange={(e) => updateDriverNotes(e.target.value)}
            placeholder="Document shock dampening feel, side-hill stability, tire compound grip notes on slick sandstone..."
            maxLength={2000}
            className="mt-1 w-full border border-metal-border bg-pit-black p-3 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
          />
        </div>
      </div>
    </article>
  );
}
