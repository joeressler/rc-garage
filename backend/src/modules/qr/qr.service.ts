import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import {
  PublicInspectionSheet,
  QrImageResult,
  QrQuery,
  ShareHtmlDocument,
  SitemapUrlEntry,
} from '../../contracts/qr.contract';
import { SetupSettings } from '../../contracts/setup.contract';
import { parseChassisElectronics } from '../../contracts/vehicle.contract';
import { DatabaseService } from '../../database/database.service';
import {
  buildShareHtml,
  buildShareNotFoundHtml,
  buildSitemapXml,
  formatSitemapLastmod,
  SITEMAP_SETUP_URL_LIMIT,
  SITEMAP_STATIC_PATHS,
} from './qr-html.util';
import {
  buildChassisInspectionUrl,
  buildChassisQrPngUrl,
  normalizeAppBaseUrl,
} from './utils/qr-url.util';

interface QrSetupRow {
  qr_slug: string;
}

interface PublicInspectionRow {
  id: string;
  title: string;
  qr_slug: string;
  calculated_fdr: string | number;
  settings: SetupSettings;
  callsign: string;
  avatar_url: string | null;
  vehicle_name: string;
  make: string;
  model: string;
  scale: string;
  vehicle_class: string;
  electronics?: unknown;
}

interface SharePreviewRow {
  id: string;
  title: string;
  qr_slug: string;
  calculated_fdr: string | number;
  front_bias_percentage: string | number;
  callsign: string;
  make: string;
  model: string;
}

interface SitemapSetupRow {
  qr_slug: string;
  updated_at: Date | string;
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
         u.callsign,
         u.avatar_url,
         v.name AS vehicle_name,
         v.make,
         v.model,
         v.scale,
         v.vehicle_class,
         v.electronics
       FROM setups s
       JOIN vehicles v ON v.id = s.vehicle_id
       JOIN users u ON u.id = s.user_id
       WHERE s.qr_slug = $1
         AND s.is_public = TRUE
         AND s.is_hidden = FALSE`,
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
      author: {
        callsign: row.callsign,
        avatarUrl: row.avatar_url,
      },
      vehicle: {
        name: row.vehicle_name,
        make: row.make,
        model: row.model,
        scale: row.scale as PublicInspectionSheet['vehicle']['scale'],
        vehicleClass:
          row.vehicle_class as PublicInspectionSheet['vehicle']['vehicleClass'],
        electronics: parseChassisElectronics(row.electronics),
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

  /**
   * Purpose: return crawler HTML instead of throwing so 404 stays text/html, not the JSON envelope.
   */
  async buildShareDocument(slug: string): Promise<ShareHtmlDocument> {
    const result = await this.database.query<SharePreviewRow>(
      `SELECT
         s.id,
         s.title,
         s.qr_slug,
         s.calculated_fdr,
         s.front_bias_percentage,
         u.callsign,
         v.make,
         v.model
       FROM setups s
       JOIN vehicles v ON v.id = s.vehicle_id
       JOIN users u ON u.id = s.user_id
       WHERE s.qr_slug = $1
         AND s.is_public = TRUE
         AND s.is_hidden = FALSE`,
      [slug],
    );

    const row = result.rows[0];
    if (!row) {
      return { statusCode: 404, html: buildShareNotFoundHtml() };
    }

    const origin = this.config.get<string>('APP_BASE_URL');
    return {
      statusCode: 200,
      html: buildShareHtml({
        setupId: row.id,
        title: row.title,
        callsign: row.callsign,
        make: row.make,
        model: row.model,
        calculatedFdr: Number(row.calculated_fdr),
        frontBiasPercentage: Number(row.front_bias_percentage),
        canonicalUrl: buildChassisInspectionUrl(origin, row.qr_slug),
        ogImageUrl: buildChassisQrPngUrl(origin, row.id),
      }),
    };
  }

  async buildSitemapXmlDocument(): Promise<string> {
    const origin = normalizeAppBaseUrl(this.config.get<string>('APP_BASE_URL'));
    const staticUrls: SitemapUrlEntry[] = SITEMAP_STATIC_PATHS.map((path) => ({
      loc: path === '/' ? `${origin}/` : `${origin}${path}`,
    }));

    const result = await this.database.query<SitemapSetupRow>(
      `SELECT qr_slug, updated_at
         FROM setups
        WHERE is_public = TRUE
          AND is_hidden = FALSE
        ORDER BY updated_at DESC
        LIMIT $1`,
      [SITEMAP_SETUP_URL_LIMIT],
    );

    const setupUrls: SitemapUrlEntry[] = result.rows.map((row) => ({
      loc: buildChassisInspectionUrl(origin, row.qr_slug),
      lastmod: formatSitemapLastmod(row.updated_at),
    }));

    return buildSitemapXml([...staticUrls, ...setupUrls]);
  }

  buildTargetUrl(slug: string): string {
    return buildChassisInspectionUrl(
      this.config.get<string>('APP_BASE_URL'),
      slug,
    );
  }

  private async loadQrSlug(setupId: string): Promise<QrSetupRow> {
    const result = await this.database.query<QrSetupRow>(
      `SELECT qr_slug FROM setups WHERE id = $1 AND is_hidden = FALSE`,
      [setupId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Setup not found');
    }
    return row;
  }
}
