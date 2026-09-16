import { Injectable, NotFoundException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import {
  CreateSetupDto,
  DeleteSetupResult,
  SetupDetailEntity,
  SetupEntity,
  SetupSettings,
  SetupSummary,
  UpdateSetupDto,
} from '../../contracts/setup.contract';
import { DatabaseService } from '../../database/database.service';
import { applyDerivedTelemetry } from './utils/telemetry-math.util';

interface SetupRow {
  id: string;
  vehicle_id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  forked_from_setup_id: string | null;
  root_ancestor_setup_id: string | null;
  fork_count: string | number;
  like_count: string | number;
  qr_slug: string;
  calculated_fdr: string | number;
  front_bias_percentage: string | number;
  surface_type: string;
  location_tag: string | null;
  settings: SetupSettings;
  tags: string[];
  created_at: Date | string;
  updated_at: Date | string;
}

const SETUP_COLUMNS = `
  id,
  vehicle_id,
  user_id,
  title,
  description,
  is_public,
  forked_from_setup_id,
  root_ancestor_setup_id,
  fork_count,
  like_count,
  qr_slug,
  calculated_fdr,
  front_bias_percentage,
  surface_type,
  location_tag,
  settings,
  tags,
  created_at,
  updated_at
`;

const QR_SLUG_LENGTH = 10;
const QR_SLUG_ATTEMPTS = 5;

/**
 * Purpose: persist garage setup sheets with server-computed FDR/CoG and unique chassis slugs.
 */
@Injectable()
export class SetupsService {
  constructor(private readonly database: DatabaseService) {}

  async create(userId: string, dto: CreateSetupDto): Promise<SetupEntity> {
    await this.assertOwnedVehicle(userId, dto.vehicleId);
    const derived = applyDerivedTelemetry(dto.settings);
    const surfaceType = derived.settings.trackConditions.surface;
    const locationTag = derived.settings.trackConditions.locationTag ?? null;

    return this.insertWithUniqueSlug({
      vehicleId: dto.vehicleId,
      userId,
      title: dto.title,
      description: dto.description ?? null,
      isPublic: dto.isPublic,
      tags: dto.tags,
      settings: derived.settings,
      calculatedFdr: derived.calculatedFdr,
      frontBiasPercentage: derived.frontBiasPercentage,
      surfaceType,
      locationTag,
    });
  }

  async list(userId: string, vehicleId: string): Promise<SetupSummary[]> {
    await this.assertOwnedVehicle(userId, vehicleId);

    const result = await this.database.query<SetupRow>(
      `SELECT ${SETUP_COLUMNS}
       FROM setups
       WHERE vehicle_id = $1
       ORDER BY created_at DESC`,
      [vehicleId],
    );

    return result.rows.map((row) => this.toSummary(row));
  }

  async findOne(
    setupId: string,
    callerId?: string,
  ): Promise<SetupDetailEntity> {
    const row = await this.loadById(setupId);
    if (!row) {
      throw new NotFoundException('Setup not found');
    }

    const isOwner = callerId !== undefined && callerId === row.user_id;
    if (!row.is_public && !isOwner) {
      throw new NotFoundException('Setup not found');
    }

    return this.toEntity(row);
  }

  async update(
    userId: string,
    setupId: string,
    dto: UpdateSetupDto,
  ): Promise<SetupEntity> {
    const existing = await this.loadOwned(userId, setupId);
    const nextVehicleId = dto.vehicleId ?? existing.vehicle_id;
    if (nextVehicleId !== existing.vehicle_id) {
      await this.assertOwnedVehicle(userId, nextVehicleId);
    }

    const nextSettings = dto.settings ?? existing.settings;
    const derived = applyDerivedTelemetry(nextSettings);
    const nextTitle = dto.title ?? existing.title;
    const nextDescription =
      dto.description !== undefined ? dto.description : existing.description;
    const nextIsPublic = dto.isPublic ?? existing.is_public;
    const nextTags = dto.tags ?? existing.tags;
    const surfaceType = derived.settings.trackConditions.surface;
    const locationTag = derived.settings.trackConditions.locationTag ?? null;

    const result = await this.database.query<SetupRow>(
      `UPDATE setups
       SET vehicle_id = $1,
           title = $2,
           description = $3,
           is_public = $4,
           tags = $5::text[],
           settings = $6::jsonb,
           calculated_fdr = $7,
           front_bias_percentage = $8,
           surface_type = $9,
           location_tag = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND user_id = $12
       RETURNING ${SETUP_COLUMNS}`,
      [
        nextVehicleId,
        nextTitle,
        nextDescription,
        nextIsPublic,
        nextTags,
        JSON.stringify(derived.settings),
        derived.calculatedFdr,
        derived.frontBiasPercentage,
        surfaceType,
        locationTag,
        setupId,
        userId,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Setup not found');
    }
    return this.toEntity(row);
  }

  async remove(userId: string, setupId: string): Promise<DeleteSetupResult> {
    const result = await this.database.query<{ id: string }>(
      `DELETE FROM setups
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [setupId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Setup not found');
    }

    return { deleted: true, id: setupId };
  }

  private async assertOwnedVehicle(
    userId: string,
    vehicleId: string,
  ): Promise<void> {
    const result = await this.database.query<{ id: string }>(
      `SELECT id FROM vehicles WHERE id = $1 AND user_id = $2`,
      [vehicleId, userId],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException('Vehicle not found');
    }
  }

  private async loadById(setupId: string): Promise<SetupRow | undefined> {
    const result = await this.database.query<SetupRow>(
      `SELECT ${SETUP_COLUMNS} FROM setups WHERE id = $1`,
      [setupId],
    );
    return result.rows[0];
  }

  private async loadOwned(userId: string, setupId: string): Promise<SetupRow> {
    const result = await this.database.query<SetupRow>(
      `SELECT ${SETUP_COLUMNS} FROM setups WHERE id = $1 AND user_id = $2`,
      [setupId, userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Setup not found');
    }
    return row;
  }

  private async insertWithUniqueSlug(input: {
    vehicleId: string;
    userId: string;
    title: string;
    description: string | null;
    isPublic: boolean;
    tags: string[];
    settings: SetupSettings;
    calculatedFdr: number;
    frontBiasPercentage: number;
    surfaceType: string;
    locationTag: string | null;
  }): Promise<SetupEntity> {
    let lastError: unknown;
    for (let attempt = 0; attempt < QR_SLUG_ATTEMPTS; attempt += 1) {
      const qrSlug = nanoid(QR_SLUG_LENGTH);
      try {
        const result = await this.database.query<SetupRow>(
          `INSERT INTO setups (
             vehicle_id,
             user_id,
             title,
             description,
             is_public,
             qr_slug,
             calculated_fdr,
             front_bias_percentage,
             surface_type,
             location_tag,
             settings,
             tags
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::text[]
           )
           RETURNING ${SETUP_COLUMNS}`,
          [
            input.vehicleId,
            input.userId,
            input.title,
            input.description,
            input.isPublic,
            qrSlug,
            input.calculatedFdr,
            input.frontBiasPercentage,
            input.surfaceType,
            input.locationTag,
            JSON.stringify(input.settings),
            input.tags,
          ],
        );
        return this.toEntity(result.rows[0]);
      } catch (error) {
        lastError = error;
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to allocate a unique chassis QR slug');
  }

  private toEntity(row: SetupRow): SetupEntity {
    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      isPublic: row.is_public,
      tags: row.tags ?? [],
      qrSlug: row.qr_slug,
      calculatedFdr: Number(row.calculated_fdr),
      frontBiasPercentage: Number(row.front_bias_percentage),
      surfaceType: row.surface_type,
      locationTag: row.location_tag,
      settings: row.settings,
      forkCount: Number(row.fork_count ?? 0),
      likeCount: Number(row.like_count ?? 0),
      forkedFromSetupId: row.forked_from_setup_id,
      rootAncestorSetupId: row.root_ancestor_setup_id,
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private toSummary(row: SetupRow): SetupSummary {
    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      userId: row.user_id,
      title: row.title,
      isPublic: row.is_public,
      calculatedFdr: Number(row.calculated_fdr),
      frontBiasPercentage: Number(row.front_bias_percentage),
      surfaceType: row.surface_type,
      forkCount: Number(row.fork_count ?? 0),
      likeCount: Number(row.like_count ?? 0),
      qrSlug: row.qr_slug,
      isForked: row.forked_from_setup_id !== null,
      createdAt: this.toIso(row.created_at),
    };
  }

  private toIso(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
