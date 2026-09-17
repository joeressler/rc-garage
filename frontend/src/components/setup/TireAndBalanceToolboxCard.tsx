import type { FoamInsertType } from '../../api/setups';
import { FOAM_INSERTS } from '../../api/setups-constants';
import { useSetupStore } from '../../stores/useSetupStore';

/**
 * Purpose: tire compound selectors, brass counter steppers, corner weights, and two-tone CoG balance scale bar.
 */
export function TireAndBalanceToolboxCard() {
  const tiresAndWeight = useSetupStore((state) => state.activeSettings.tiresAndWeight);
  const updateWeights = useSetupStore((state) => state.updateWeights);
  const updateTires = useSetupStore((state) => state.updateTires);
  const validationErrors = useSetupStore((state) => state.validationErrors);

  const frontTire = tiresAndWeight.front;
  const rearTire = tiresAndWeight.rear;
  const weight = tiresAndWeight.weight;

  const frontWeight = weight.frontAxleWeightGrams;
  const rearWeight = weight.rearAxleWeightGrams;
  const totalRtr = weight.totalRtrWeightGrams;
  const frontBiasPct = weight.frontWeightBiasPercentage ?? 50;
  const rearBiasPct = weight.rearWeightBiasPercentage ?? 50;

  const weightError = validationErrors['settings.tiresAndWeight.weight.totalRtrWeightGrams'];

  return (
    <article className="relative border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-5 shadow-beveled-panel">
      <span className="hex-rivet left-2 top-2" />
      <span className="hex-rivet right-2 top-2" />

      <div className="flex items-center justify-between border-b border-metal-border pb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hazard-orange">
            Drawer B · Traction & Mass
          </p>
          <h2 className="font-display text-xl uppercase tracking-wide text-readout-bright">
            Tires & Corner Balance
          </h2>
        </div>
        <span className="font-mono text-[10px] text-readout-dim">1.9" CRAWLER SPEC</span>
      </div>

      <div className="mt-5 space-y-5">
        {/* Front & Rear Tire Spec Controls */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Front Axle Tire */}
          <div className="border border-metal-border/70 bg-pit-grease p-3 space-y-2.5">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-readout-bright">
              Front Axle Tires
            </p>
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Compound</label>
              <input
                type="text"
                value={frontTire.compound}
                onChange={(e) => updateTires('front', { compound: e.target.value })}
                placeholder="e.g. Predator / Sticky"
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Insert Typology</label>
              <select
                value={frontTire.insertType}
                onChange={(e) => updateTires('front', { insertType: e.target.value as FoamInsertType })}
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              >
                {FOAM_INSERTS.map((insert) => (
                  <option key={insert.value} value={insert.value}>
                    {insert.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Front Brass Weight Stepper */}
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Brass Weight / Wheel</label>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateTires('front', {
                      brassWheelWeightGramsPerWheel: Math.max(
                        0,
                        frontTire.brassWheelWeightGramsPerWheel - 10,
                      ),
                    })
                  }
                  className="h-7 w-7 border border-metal-border bg-pit-black font-mono text-sm text-readout-bright hover:border-hazard-orange"
                >
                  -
                </button>
                <div className="flex-1 border border-metal-border bg-pit-black px-2 py-1 text-center font-mono text-xs text-readout-bright">
                  {frontTire.brassWheelWeightGramsPerWheel}g
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateTires('front', {
                      brassWheelWeightGramsPerWheel: Math.min(
                        500,
                        frontTire.brassWheelWeightGramsPerWheel + 10,
                      ),
                    })
                  }
                  className="h-7 w-7 border border-metal-border bg-pit-black font-mono text-sm text-readout-bright hover:border-hazard-orange"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Rear Axle Tire */}
          <div className="border border-metal-border/70 bg-pit-grease p-3 space-y-2.5">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-readout-bright">
              Rear Axle Tires
            </p>
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Compound</label>
              <input
                type="text"
                value={rearTire.compound}
                onChange={(e) => updateTires('rear', { compound: e.target.value })}
                placeholder="e.g. Predator / Sticky"
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Insert Typology</label>
              <select
                value={rearTire.insertType}
                onChange={(e) => updateTires('rear', { insertType: e.target.value as FoamInsertType })}
                className="mt-1 w-full border border-metal-border bg-pit-black px-2 py-1 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
              >
                {FOAM_INSERTS.map((insert) => (
                  <option key={insert.value} value={insert.value}>
                    {insert.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Rear Brass Weight Stepper */}
            <div>
              <label className="font-mono text-[10px] uppercase text-readout-muted">Brass Weight / Wheel</label>
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateTires('rear', {
                      brassWheelWeightGramsPerWheel: Math.max(
                        0,
                        rearTire.brassWheelWeightGramsPerWheel - 10,
                      ),
                    })
                  }
                  className="h-7 w-7 border border-metal-border bg-pit-black font-mono text-sm text-readout-bright hover:border-hazard-orange"
                >
                  -
                </button>
                <div className="flex-1 border border-metal-border bg-pit-black px-2 py-1 text-center font-mono text-xs text-readout-bright">
                  {rearTire.brassWheelWeightGramsPerWheel}g
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateTires('rear', {
                      brassWheelWeightGramsPerWheel: Math.min(
                        500,
                        rearTire.brassWheelWeightGramsPerWheel + 10,
                      ),
                    })
                  }
                  className="h-7 w-7 border border-metal-border bg-pit-black font-mono text-sm text-readout-bright hover:border-hazard-orange"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Axle Weights Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="front-axle-weight-input" className="font-mono text-xs uppercase tracking-wider text-readout-dim">
              Front Axle (g)
            </label>
            <input
              id="front-axle-weight-input"
              type="number"
              min={100}
              max={15000}
              step={10}
              value={frontWeight}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!Number.isNaN(val)) updateWeights(val, rearWeight);
              }}
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-1.5 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange"
            />
          </div>
          <div>
            <label htmlFor="rear-axle-weight-input" className="font-mono text-xs uppercase tracking-wider text-readout-dim">
              Rear Axle (g)
            </label>
            <input
              id="rear-axle-weight-input"
              type="number"
              min={100}
              max={15000}
              step={10}
              value={rearWeight}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!Number.isNaN(val)) updateWeights(frontWeight, val);
              }}
              className="mt-1 w-full border border-metal-border bg-pit-black px-3 py-1.5 font-mono text-sm text-readout-bright outline-none focus:border-hazard-orange"
            />
          </div>
        </div>
        {weightError ? (
          <p className="font-mono text-[10px] text-hazard-orange">{weightError}</p>
        ) : null}

        {/* Center of Gravity (CoG) Balance Scale Bar */}
        <div className="border border-metal-border bg-pit-black p-3 rounded">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-readout-dim">
              FRONT: <strong className="text-hazard-orange">{frontWeight}g</strong> ({frontBiasPct}%)
            </span>
            <span className="text-readout-muted text-[10px] uppercase">RTR Total: {totalRtr}g</span>
            <span className="text-readout-dim">
              REAR: <strong className="text-anodized-blue">{rearWeight}g</strong> ({rearBiasPct}%)
            </span>
          </div>

          {/* Analog two-tone progress bar with center equilibrium marker */}
          <div className="relative mt-2.5 h-4 w-full overflow-hidden rounded bg-pit-steel border border-pit-rubber">
            {/* Front Bias portion */}
            <div
              className="h-full bg-hazard-orange transition-all duration-300"
              style={{ width: `${frontBiasPct}%` }}
            />
            {/* Center 50/50 equilibrium marker */}
            <div
              className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white shadow-sm -translate-x-1/2 z-10"
              title="50% Equilibrium Center"
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-readout-muted">
            <span>60% Target Comp Front Bias</span>
            <span>50/50 Balance</span>
            <span>Rear Heavy</span>
          </div>
        </div>
      </div>
    </article>
  );
}
