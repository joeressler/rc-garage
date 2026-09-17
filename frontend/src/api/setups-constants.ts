import type {
  FluidUnit,
  FoamInsertType,
  GripLevel,
  SurfaceType,
} from './setups';

export const FOAM_INSERTS: readonly { value: FoamInsertType; label: string }[] = [
  { value: 'dual_stage_foam', label: 'Dual Stage Closed/Open Cell' },
  { value: 'single_stage_foam', label: 'Single Stage Open Cell' },
  { value: 'printed_silicone_matrix', label: 'Printed Silicone Matrix' },
  { value: 'air_pocket', label: 'Air Pocket Beadlock' },
  { value: 'none', label: 'No Insert (Open Rim)' },
] as const;

export const FLUID_UNITS: readonly { value: FluidUnit; label: string }[] = [
  { value: 'CST', label: 'CST (Centistokes)' },
  { value: 'WT', label: 'WT (Weight)' },
] as const;

export const SURFACES: readonly { value: SurfaceType; label: string }[] = [
  { value: 'granite_rock', label: 'Granite Rock' },
  { value: 'slick_rock', label: 'Slick Rock' },
  { value: 'river_stone', label: 'River Stone' },
  { value: 'packed_dirt', label: 'Packed Dirt' },
  { value: 'loose_loam', label: 'Loose Loam' },
  { value: 'clay_indoor', label: 'Clay (Indoor Track)' },
  { value: 'carpet_offroad', label: 'Carpet Offroad' },
  { value: 'asphalt', label: 'Asphalt' },
  { value: 'snow_ice', label: 'Snow & Ice' },
] as const;

export const GRIP_LEVELS: readonly { value: GripLevel; label: string }[] = [
  { value: 'low', label: 'Low Grip' },
  { value: 'medium', label: 'Medium Grip' },
  { value: 'high', label: 'High Grip' },
  { value: 'extreme', label: 'Extreme Grip' },
] as const;
