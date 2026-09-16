import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import {
  PublicInspectionSheet,
  QrImageResult,
  QrQuery,
} from '../../contracts/qr.contract';
import { SetupSettings } from '../../contracts/setup.contract';
import { DatabaseService } from '../../database/database.service';
import { buildChassisInspectionUrl } from './utils/qr-url.util';

interface QrSetupRow {
  qr_slug: string;
}

interface PublicInspectionRow {
  id: string;
  title: string;
  qr_slug: string;
  calculated_fdr: string | number;
  settings: SetupSettings;
  vehicle_name: string;
  make: string;
  model: string;
  scale: string;
  vehicle_class: string;
}

const QR_ECC_LEVEL = 'H' as const;
const QR_DARK = '#000000';
const QR_LIGHT = '#FFFFFF';

/**
 * Purpose: emit Level-H chassis sticker QR images and public pit-inspection summaries.
 */
@Injectable()
export class QrService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async generate(setupId: string, query: QrQuery): Promise<QrImageResult> {
    const setup = await this.loadQrSlug(setupId);
    const targetUrl = this.buildTargetUrl(setup.qr_slug);
    const options = {
      errorCorrectionLevel: QR_ECC_LEVEL,
      margin: query.margin,
      width: query.size,
      color: { dark: QR_DARK, light: QR_LIGHT },
    };

    if (query.format === 'png') {
      const body = await QRCode.toBuffer(targetUrl, {
        ...options,
        type: 'png',
      });
      return { body, contentType: 'image/png', format: 'png' };
    }

    const svg = await QRCode.toString(targetUrl, {
      ...options,
      type: 'svg',
    });
    return {
      body: Buffer.from(svg, 'utf8'),
      contentType: 'image/svg+xml',
      format: 'svg',
    };
  }

  async resolveBySlug(slug: string): Promise<PublicInspectionSheet> {
    const result = await this.database.query<PublicInspectionRow>(
      `SELECT
         s.id,
         s.title,
         s.qr_slug,
         s.calculated_fdr,
         s.settings,
         v.name AS vehicle_name,
         v.make,
         v.model,
         v.scale,
         v.vehicle_class
       FROM setups s
       JOIN vehicles v ON v.id = s.vehicle_id
       WHERE s.qr_slug = $1
         AND s.is_public = TRUE`,
      [slug],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Setup not found');
    }

    const settings = row.settings;
    const shortUrl = this.buildTargetUrl(row.qr_slug);

    return {
      setupId: row.id,
      title: row.title,
      qrSlug: row.qr_slug,
      shortUrl,
      calculatedFdr: Number(row.calculated_fdr),
      batteryCellCount: settings.drivetrain.batteryCellCount ?? 3,
      vehicle: {
        name: row.vehicle_name,
        make: row.make,
        model: row.model,
        scale: row.scale as PublicInspectionSheet['vehicle']['scale'],
        vehicleClass:
          row.vehicle_class as PublicInspectionSheet['vehicle']['vehicleClass'],
      },
      frontShock: {
        oilViscosityValue: settings.suspension.front.oilViscosityValue,
        oilViscosityUnit: settings.suspension.front.oilViscosityUnit,
      },
      rearShock: {
        oilViscosityValue: settings.suspension.rear.oilViscosityValue,
        oilViscosityUnit: settings.suspension.rear.oilViscosityUnit,
      },
      frontTire: {
        brand: settings.tiresAndWeight.front.brand,
        model: settings.tiresAndWeight.front.model,
        compound: settings.tiresAndWeight.front.compound,
      },
      rearTire: {
        brand: settings.tiresAndWeight.rear.brand,
        model: settings.tiresAndWeight.rear.model,
        compound: settings.tiresAndWeight.rear.compound,
      },
      verified: true,
    };
  }

  buildTargetUrl(slug: string): string {
    return buildChassisInspectionUrl(
      this.config.get<string>('APP_BASE_URL'),
      slug,
    );
  }

  private async loadQrSlug(setupId: string): Promise<QrSetupRow> {
    const result = await this.database.query<QrSetupRow>(
      `SELECT qr_slug FROM setups WHERE id = $1`,
      [setupId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Setup not found');
    }
    return row;
  }
}
