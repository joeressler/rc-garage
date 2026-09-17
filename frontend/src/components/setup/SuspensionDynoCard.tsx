import { cstToApproxWt, wtToApproxCst } from '../../api/setups';
import { FLUID_UNITS } from '../../api/setups-constants';
import { useSetupStore } from '../../stores/useSetupStore';

/**
 * Purpose: side-by-side front and rear shock dyno inspection cards with viscosity readouts and alignment dials.
 */
export function SuspensionDynoCard() {
  const suspension = useSetupStore((state) => state.activeSettings.suspension);
  const updateSuspensionCorner = useSetupStore((state) => state.updateSuspensionCorner);

  const front = suspension.front;
  const rear = suspension.rear;

  // Dual viscosity display calculation
  const frontDualViscosity =
    front.oilViscosityUnit === 'CST'
      ? `${cstToApproxWt(front.oilViscosityValue)} WT / ${front.oilViscosityValue} CST`
      : `${front.oilViscosityValue} WT / ${wtToApproxCst(front.oilViscosityValue)} CST`;

  const rearDualViscosity =
    rear.oilViscosityUnit === 'CST'
      ? `${cstToApproxWt(rear.oilViscosityValue)} WT / ${rear.oilViscosityValue} CST`
      : `${rear.oilViscosityValue} WT / ${wtToApproxCst(rear.oilViscosityValue)} CST`;

  return (
    <article className="relative border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-5 shadow-beveled-panel">
      <span className="hex-rivet left-2 top-2" />
      <span className="hex-rivet right-2 top-2" />

      <div className="flex items-center justify-between border-b border-metal-border pb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hazard-orange">
            Drawer C · Geometry & Damping
          </p>
          <h2 className="font-display text-xl uppercase tracking-wide text-readout-bright">
            Suspension & Shock Dyno Readouts
          </h2>
        </div>
        <span className="font-mono text-[10px] text-readout-dim">DUAL-RATE TELEMETRY</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Front Axle Shock Dyno */}
        <div className="border border-metal-border/70 bg-pit-grease p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-metal-border/50 pb-2">
            <span className="font-display text-lg uppercase tracking-wider text-readout-bright">
              Front Axle Shocks
            </span>
            <span className="border border-anodized-blue/50 bg-pit-black px-2 py-0.5 font-mono text-[10px] text-anodized-blue">
              {frontDualViscosity}
            </span>
          </div>

          {/* Fluid Viscosity Input */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">
                Fluid Viscosity
              </label>
              <input
                type="number"
                min={10}
                max={5000}
                step={25}
                value={front.oilViscosityValue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!Number.isNaN(val)) updateSuspensionCorner('front', { oilViscosityValue: val });
                }}
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Unit</label>
              <select
                value={front.oilViscosityUnit}
                onChange={(e) =>
                  updateSuspensionCorner('front', {
                    oilViscosityUnit: e.target.value as 'CST' | 'WT',
                  })
                }
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              >
                {FLUID_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Springs & Ride Height */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Springs</label>
              <input
                type="text"
                value={front.springRateDescription}
                onChange={(e) =>
                  updateSuspensionCorner('front', { springRateDescription: e.target.value })
                }
                placeholder="e.g. 1.4 lb/in"
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">
                Ride Height (mm)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={front.rideHeightMm}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!Number.isNaN(val)) updateSuspensionCorner('front', { rideHeightMm: val });
                }}
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </div>
          </div>

          {/* Alignment Angles: Camber & Toe Dials */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Camber */}
            <div className="border border-metal-border bg-pit-black p-2.5 rounded">
              <div className="flex justify-between font-mono text-[10px] text-readout-muted">
                <span>CAMBER</span>
                <span className="text-hazard-orange font-bold">{front.camberAngleDeg}°</span>
              </div>
              <input
                type="range"
                min={-8.0}
                max={8.0}
                step={0.5}
                value={front.camberAngleDeg}
                onChange={(e) =>
                  updateSuspensionCorner('front', { camberAngleDeg: parseFloat(e.target.value) })
                }
                className="mt-2 h-1.5 w-full cursor-pointer appearance-none bg-pit-steel accent-hazard-orange focus:outline-none"
              />
              <div className="flex justify-between font-mono text-[8px] text-readout-muted mt-1">
                <span>-8°</span>
                <span>0°</span>
                <span>+8°</span>
              </div>
            </div>

            {/* Toe */}
            <div className="border border-metal-border bg-pit-black p-2.5 rounded">
              <div className="flex justify-between font-mono text-[10px] text-readout-muted">
                <span>TOE ANGLE</span>
                <span className="text-hazard-orange font-bold">{front.toeAngleDeg}°</span>
              </div>
              <input
                type="range"
                min={-8.0}
                max={8.0}
                step={0.5}
                value={front.toeAngleDeg}
                onChange={(e) =>
                  updateSuspensionCorner('front', { toeAngleDeg: parseFloat(e.target.value) })
                }
                className="mt-2 h-1.5 w-full cursor-pointer appearance-none bg-pit-steel accent-hazard-orange focus:outline-none"
              />
              <div className="flex justify-between font-mono text-[8px] text-readout-muted mt-1">
                <span>-8° Out</span>
                <span>0°</span>
                <span>+8° In</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rear Axle Shock Dyno */}
        <div className="border border-metal-border/70 bg-pit-grease p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-metal-border/50 pb-2">
            <span className="font-display text-lg uppercase tracking-wider text-readout-bright">
              Rear Axle Shocks
            </span>
            <span className="border border-anodized-blue/50 bg-pit-black px-2 py-0.5 font-mono text-[10px] text-anodized-blue">
              {rearDualViscosity}
            </span>
          </div>

          {/* Fluid Viscosity Input */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">
                Fluid Viscosity
              </label>
              <input
                type="number"
                min={10}
                max={5000}
                step={25}
                value={rear.oilViscosityValue}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!Number.isNaN(val)) updateSuspensionCorner('rear', { oilViscosityValue: val });
                }}
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Unit</label>
              <select
                value={rear.oilViscosityUnit}
                onChange={(e) =>
                  updateSuspensionCorner('rear', {
                    oilViscosityUnit: e.target.value as 'CST' | 'WT',
                  })
                }
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              >
                {FLUID_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Springs & Ride Height */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Springs</label>
              <input
                type="text"
                value={rear.springRateDescription}
                onChange={(e) =>
                  updateSuspensionCorner('rear', { springRateDescription: e.target.value })
                }
                placeholder="e.g. 1.1 lb/in"
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">
                Ride Height (mm)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={rear.rideHeightMm}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!Number.isNaN(val)) updateSuspensionCorner('rear', { rideHeightMm: val });
                }}
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </div>
          </div>

          {/* Alignment Angles: Camber & Toe Dials */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Camber */}
            <div className="border border-metal-border bg-pit-black p-2.5 rounded">
              <div className="flex justify-between font-mono text-[10px] text-readout-muted">
                <span>CAMBER</span>
                <span className="text-hazard-orange font-bold">{rear.camberAngleDeg}°</span>
              </div>
              <input
                type="range"
                min={-8.0}
                max={8.0}
                step={0.5}
                value={rear.camberAngleDeg}
                onChange={(e) =>
                  updateSuspensionCorner('rear', { camberAngleDeg: parseFloat(e.target.value) })
                }
                className="mt-2 h-1.5 w-full cursor-pointer appearance-none bg-pit-steel accent-hazard-orange focus:outline-none"
              />
              <div className="flex justify-between font-mono text-[8px] text-readout-muted mt-1">
                <span>-8°</span>
                <span>0°</span>
                <span>+8°</span>
              </div>
            </div>

            {/* Toe */}
            <div className="border border-metal-border bg-pit-black p-2.5 rounded">
              <div className="flex justify-between font-mono text-[10px] text-readout-muted">
                <span>TOE ANGLE</span>
                <span className="text-hazard-orange font-bold">{rear.toeAngleDeg}°</span>
              </div>
              <input
                type="range"
                min={-8.0}
                max={8.0}
                step={0.5}
                value={rear.toeAngleDeg}
                onChange={(e) =>
                  updateSuspensionCorner('rear', { toeAngleDeg: parseFloat(e.target.value) })
                }
                className="mt-2 h-1.5 w-full cursor-pointer appearance-none bg-pit-steel accent-hazard-orange focus:outline-none"
              />
              <div className="flex justify-between font-mono text-[8px] text-readout-muted mt-1">
                <span>-8° Out</span>
                <span>0°</span>
                <span>+8° In</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
