import type { VehicleClass } from '../api/qr';

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  crawler_scale: 'SCALE CRAWLER',
  rock_bouncer: 'ROCK BOUNCER',
  comp_crawler_pro: 'COMP CRAWLER PRO',
  buggy_2wd: '2WD BUGGY',
  buggy_4wd: '4WD BUGGY',
  short_course: 'SHORT COURSE',
  touring_onroad: 'TOURING',
  drift_rwd: 'RWD DRIFT',
  monster_truck: 'MONSTER TRUCK',
};

export function formatFdr(value: number): string {
  return `${value.toFixed(2)}:1`;
}

export function formatShock(value: number, unit: 'WT' | 'CST'): string {
  return `${value} ${unit}`;
}
