import { z } from 'zod';
import { FeedAuthor } from './feed.contract';
import { FluidUnitEnum } from './setup.contract';
import {
  ChassisElectronicsSchema,
  VehicleClassEnum,
  VehicleScaleEnum,
} from './vehicle.contract';

export const QrFormatSchema = z.enum(['svg', 'png']);

export const QrQuerySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    format: QrFormatSchema.default('svg'),
    size: z.coerce.number().int().min(128).max(2048).default(512),
    margin: z.coerce.number().int().min(0).max(16).default(2),
  }),
);

export const QrSlugParamSchema = z
  .string()
  .length(10, 'QR slug must be 10 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'QR slug must be URL-safe');

export const PublicInspectionVehicleSchema = z.object({
  name: z.string(),
  make: z.string(),
  model: z.string(),
  scale: VehicleScaleEnum,
  vehicleClass: VehicleClassEnum,
  electronics: ChassisElectronicsSchema.optional().default({}),
});

export const PublicInspectionShockSchema = z.object({
  oilViscosityValue: z.number(),
  oilViscosityUnit: FluidUnitEnum,
});

export const PublicInspectionTireSchema = z.object({
  brand: z.string(),
  model: z.string(),
  compound: z.string(),
});

export type QrFormat = z.infer<typeof QrFormatSchema>;
export type QrQuery = z.infer<typeof QrQuerySchema>;
export type PublicInspectionVehicle = z.infer<
  typeof PublicInspectionVehicleSchema
>;
export type PublicInspectionShock = z.infer<typeof PublicInspectionShockSchema>;
export type PublicInspectionTire = z.infer<typeof PublicInspectionTireSchema>;

export interface PublicInspectionSheet {
  setupId: string;
  title: string;
  qrSlug: string;
  shortUrl: string;
  calculatedFdr: number;
  batteryCellCount: number;
  author: FeedAuthor;
  vehicle: PublicInspectionVehicle;
  frontShock: PublicInspectionShock;
  rearShock: PublicInspectionShock;
  frontTire: PublicInspectionTire;
  rearTire: PublicInspectionTire;
  verified: true;
}

export interface QrImageResult {
  body: Buffer;
  contentType: 'image/svg+xml' | 'image/png';
  format: QrFormat;
}

/** Purpose: fields interpolated into crawler-visible share HTML (Open Graph). */
export interface ShareHtmlFields {
  setupId: string;
  title: string;
  callsign: string;
  make: string;
  model: string;
  calculatedFdr: number;
  frontBiasPercentage: number;
  canonicalUrl: string;
  ogImageUrl: string;
}

export interface ShareHtmlDocument {
  statusCode: 200 | 404;
  html: string;
}

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
}
