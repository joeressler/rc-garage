import { apiJson } from './http';

export type VehicleScale = '1/24' | '1/18' | '1/10' | '1/8' | '1/7' | '1/5';

export type VehicleClass =
  | 'crawler_scale'
  | 'rock_bouncer'
  | 'comp_crawler_pro'
  | 'buggy_2wd'
  | 'buggy_4wd'
  | 'short_course'
  | 'touring_onroad'
  | 'drift_rwd'
  | 'monster_truck';

export interface PublicInspectionVehicle {
  name: string;
  make: string;
  model: string;
  scale: VehicleScale;
  vehicleClass: VehicleClass;
}

export interface PublicInspectionShock {
  oilViscosityValue: number;
  oilViscosityUnit: 'WT' | 'CST';
}

export interface PublicInspectionTire {
  brand: string;
  model: string;
  compound: string;
}

export interface PublicInspectionSheet {
  setupId: string;
  title: string;
  qrSlug: string;
  shortUrl: string;
  calculatedFdr: number;
  batteryCellCount: number;
  vehicle: PublicInspectionVehicle;
  frontShock: PublicInspectionShock;
  rearShock: PublicInspectionShock;
  frontTire: PublicInspectionTire;
  rearTire: PublicInspectionTire;
  verified: true;
}

export function apiResolveInspection(slug: string): Promise<PublicInspectionSheet> {
  return apiJson<PublicInspectionSheet>(
    `/api/garage/qr/resolve/${encodeURIComponent(slug)}`,
  );
}

export function chassisQrSvgUrl(setupId: string, size = 450): string {
  return `/api/garage/setups/${encodeURIComponent(setupId)}/qr?format=svg&size=${size}`;
}
