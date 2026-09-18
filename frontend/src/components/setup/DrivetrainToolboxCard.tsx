import { useEffect, useState } from 'react';
import { TRANSMISSION_PRESETS } from '../../api/setups';
import { formatFdr } from '../../lib/vehicle-labels';
import { useSetupStore } from '../../stores/useSetupStore';

/**
 * Purpose: interactive dual range sliders for pinion and spur, transmission presets, and LED FDR readout.
 */
export function DrivetrainToolboxCard() {
  const drivetrain = useSetupStore((state) => state.activeSettings.drivetrain);
  const updateGearing = useSetupStore((state) => state.updateGearing);
  const validationErrors = useSetupStore((state) => state.validationErrors);
  const activeSetupId = useSetupStore((state) => state.activeSetup?.id);

  const pinion = drivetrain.pinionTeeth;
  const spur = drivetrain.spurTeeth;
  const internalRatio = drivetrain.transmissionInternalRatio;
  const calculatedFdr = drivetrain.calculatedFdr ?? 0;
  // Keep Custom selected even when the current ratio still matches a named gearbox preset.
  const [useCustomRatio, setUseCustomRatio] = useState(false);

  useEffect(() => {
    setUseCustomRatio(false);
  }, [activeSetupId]);

  const gearingError =
    validationErrors['settings.drivetrain.spurTeeth'] ||
    validationErrors['settings.drivetrain.pinionTeeth'] ||
    validationErrors['settings.drivetrain'];
  const ratioError = validationErrors['settings.drivetrain.transmissionInternalRatio'];

  const isPresetMatch = TRANSMISSION_PRESETS.some(
    (preset) => Math.abs(preset.internalRatio - internalRatio) < 0.001,
  );
  const showCustomRatio = useCustomRatio || !isPresetMatch;

  return (
    <article className="relative border-t-2 border-l-2 border-pit-rubber bg-pit-steel p-5 shadow-beveled-panel">
      <span className="hex-rivet left-2 top-2" />
      <span className="hex-rivet right-2 top-2" />

      <div className="flex items-center justify-between border-b border-metal-border pb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-hazard-orange">
            Drawer A · Power & Transmission
          </p>
          <h2 className="font-display text-xl uppercase tracking-wide text-readout-bright">
            Drivetrain & Gearing
          </h2>
        </div>
        <span className="font-mono text-[10px] text-readout-dim">48P MESH</span>
      </div>

      <div className="mt-5 space-y-5">
        {/* Pinion Teeth Slider */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="pinion-teeth-slider" className="font-mono text-xs uppercase tracking-wider text-readout-dim">
              Pinion Gear Teeth
            </label>
            <div className="flex items-center gap-1.5 font-mono text-sm">
              <input
                id="pinion-teeth-input"
                aria-label="Pinion Gear Teeth Input"
                type="number"
                min={9}
                max={60}
                value={pinion}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!Number.isNaN(val)) updateGearing(val, spur, internalRatio);
                }}
                className="w-16 border border-metal-border bg-pit-black px-2 py-0.5 text-right font-mono text-readout-bright outline-none focus:border-hazard-orange"
              />
              <span className="text-readout-muted">T</span>
            </div>
          </div>
          <input
            id="pinion-teeth-slider"
            aria-label="Pinion Gear Teeth"
            type="range"
            min={9}
            max={60}
            step={1}
            value={pinion}
            onChange={(e) => updateGearing(parseInt(e.target.value, 10), spur, internalRatio)}
            className="mt-2 h-2 w-full cursor-pointer appearance-none bg-pit-black accent-hazard-orange focus:outline-none"
          />
          <div className="flex justify-between font-mono text-[9px] text-readout-muted">
            <span>9T (Crawler Crawl)</span>
            <span>60T (Speed Run)</span>
          </div>
        </div>

        {/* Spur Teeth Slider */}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="spur-teeth-slider" className="font-mono text-xs uppercase tracking-wider text-readout-dim">
              Spur Gear Teeth
            </label>
            <div className="flex items-center gap-1.5 font-mono text-sm">
              <input
                id="spur-teeth-input"
                aria-label="Spur Gear Teeth Input"
                type="number"
                min={30}
                max={120}
                value={spur}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!Number.isNaN(val)) updateGearing(pinion, val, internalRatio);
                }}
                className={`w-16 border bg-pit-black px-2 py-0.5 text-right font-mono text-readout-bright outline-none focus:border-hazard-orange ${
                  gearingError ? 'border-hazard-stripe' : 'border-metal-border'
                }`}
              />
              <span className="text-readout-muted">T</span>
            </div>
          </div>
          <input
            id="spur-teeth-slider"
            aria-label="Spur Gear Teeth"
            type="range"
            min={30}
            max={120}
            step={1}
            value={spur}
            onChange={(e) => updateGearing(pinion, parseInt(e.target.value, 10), internalRatio)}
            className="mt-2 h-2 w-full cursor-pointer appearance-none bg-pit-black accent-hazard-orange focus:outline-none"
          />
          <div className="flex justify-between font-mono text-[9px] text-readout-muted">
            <span>30T</span>
            <span>120T</span>
          </div>
          {gearingError ? (
            <p className="mt-1 font-mono text-[10px] text-hazard-orange">{gearingError}</p>
          ) : null}
        </div>

        {/* Internal Transmission Ratio Presets */}
        <div>
          <label htmlFor="transmission-presets-select" className="block font-mono text-xs uppercase tracking-wider text-readout-dim">
            Transmission Internal Ratio
          </label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <select
              id="transmission-presets-select"
              value={showCustomRatio ? 'custom' : internalRatio.toString()}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setUseCustomRatio(true);
                  return;
                }
                setUseCustomRatio(false);
                updateGearing(pinion, spur, parseFloat(e.target.value));
              }}
              className="flex-1 border border-metal-border bg-pit-black px-3 py-1.5 font-mono text-xs text-readout-bright outline-none focus:border-hazard-orange"
            >
              {TRANSMISSION_PRESETS.map((p) => (
                <option key={p.id} value={p.internalRatio}>
                  {p.name}
                </option>
              ))}
              <option value="custom">Custom Internal Ratio</option>
            </select>
            <div className="flex items-center gap-1 font-mono text-xs">
              <input
                type="number"
                aria-label="Custom internal ratio"
                step="0.01"
                min={1.0}
                max={6.0}
                value={internalRatio}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (Number.isNaN(val)) {
                    return;
                  }
                  setUseCustomRatio(true);
                  updateGearing(pinion, spur, val);
                }}
                className={`w-20 border bg-pit-black px-2 py-1.5 text-right font-mono text-readout-bright outline-none focus:border-hazard-orange ${
                  ratioError ? 'border-hazard-stripe' : 'border-metal-border'
                }`}
              />
              <span className="text-readout-muted">:1</span>
            </div>
          </div>
          {ratioError ? (
            <p className="mt-1 font-mono text-[10px] text-hazard-orange">{ratioError}</p>
          ) : null}
        </div>

        {/* LED Digital Readout for Calculated FDR */}
        <div className="border border-metal-border bg-pit-black p-3 rounded">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-readout-muted">
                Final Drive Ratio (FDR)
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-readout-dim">
                (Spur / Pinion) × Internal Ratio
              </p>
            </div>
            <div className="font-mono text-2xl font-bold tracking-wider text-hazard-orange text-right">
              {formatFdr(calculatedFdr)}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
