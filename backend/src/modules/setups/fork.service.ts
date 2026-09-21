import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { nanoid } from 'nanoid';
import {
  ForkSetupDto,
  SetupSettingsOverride,
} from '../../contracts/fork.contract';
import {
  SetupEntity,
  SetupSettings,
  SetupSettingsSchema,
} from '../../contracts/setup.contract';
import { DatabaseService } from '../../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
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
const TITLE_MAX = 100;

/**
 * Purpose: clone a public (or owned) setup into the caller's garage with immutable lineage pointers.
 */
@Injectable()
export class ForkService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  async fork(
    userId: string,
    sourceSetupId: string,
    dto: ForkSetupDto,
  ): Promise<SetupEntity> {
    const source = await this.loadSource(sourceSetupId);
    if (!source.is_public && source.user_id !== userId) {
      throw new NotFoundException('Setup not found');
    }

    await this.assertOwnedTargetVehicle(userId, dto.targetVehicleId);

    const mergedSettings = this.mergeAndValidate(
      source.settings,
      dto.settingOverrides,
    );
    const derived = applyDerivedTelemetry(mergedSettings);
    const title = this.resolveTitle(source.title, dto.title);
    const description =
      dto.description !== undefined ? dto.description : source.description;
    const rootAncestorSetupId = source.root_ancestor_setup_id ?? source.id;
    const surfaceType = derived.settings.trackConditions.surface;
    const locationTag = derived.settings.trackConditions.locationTag ?? null;

    return this.insertForkedSetup({
      vehicleId: dto.targetVehicleId,
      userId,
      title,
      description,
      tags: source.tags ?? [],
      settings: derived.settings,
      calculatedFdr: derived.calculatedFdr,
      frontBiasPercentage: derived.frontBiasPercentage,
      surfaceType,
      locationTag,
      forkedFromSetupId: source.id,
      rootAncestorSetupId,
    });
  }

  private async loadSource(sourceSetupId: string): Promise<SetupRow> {
    const result = await this.database.query<SetupRow>(
      `SELECT ${SETUP_COLUMNS} FROM setups WHERE id = $1`,
      [sourceSetupId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Setup not found');
    }
    return row;
  }

  private async assertOwnedTargetVehicle(
    userId: string,
    vehicleId: string,
  ): Promise<void> {
    const result = await this.database.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM vehicles WHERE id = $1`,
      [vehicleId],
    );
    const vehicle = result.rows[0];
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    if (vehicle.user_id !== userId) {
      throw new ForbiddenException('Target vehicle is not in your garage');
    }
  }

  private mergeAndValidate(
    sourceSettings: SetupSettings,
    overrides?: SetupSettingsOverride,
  ): SetupSettings {
    const cloned = structuredClone(sourceSettings);
    const merged = deepMerge(cloned, overrides ?? {});
    const parsed = SetupSettingsSchema.safeParse(merged);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue: { path: (string | number)[]; message: string }) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      });
      throw new BadRequestException(messages);
    }
    return parsed.data;
  }

  private resolveTitle(sourceTitle: string, override?: string): string {
    if (override !== undefined) {
      return override;
    }
    const raw = `Fork of ${sourceTitle}`;
    return raw.length <= TITLE_MAX ? raw : raw.slice(0, TITLE_MAX);
  }

  private async insertForkedSetup(input: {
    vehicleId: string;
    userId: string;
    title: string;
    description: string | null;
    tags: string[];
    settings: SetupSettings;
    calculatedFdr: number;
    frontBiasPercentage: number;
    surfaceType: string;
    locationTag: string | null;
    forkedFromSetupId: string;
    rootAncestorSetupId: string;
  }): Promise<SetupEntity> {
    let lastError: unknown;
    for (let attempt = 0; attempt < QR_SLUG_ATTEMPTS; attempt += 1) {
      const qrSlug = nanoid(QR_SLUG_LENGTH);
      const client = await this.database.getClient();
      try {
        await client.query('BEGIN');
        const inserted = await client.query<SetupRow>(
          `INSERT INTO setups (
             vehicle_id,
             user_id,
             title,
             description,
             is_public,
             forked_from_setup_id,
             root_ancestor_setup_id,
             qr_slug,
             calculated_fdr,
             front_bias_percentage,
             surface_type,
             location_tag,
             settings,
             tags
           ) VALUES (
             $1, $2, $3, $4, FALSE, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::text[]
           )
           RETURNING ${SETUP_COLUMNS}`,
          [
            input.vehicleId,
            input.userId,
            input.title,
            input.description,
            input.forkedFromSetupId,
            input.rootAncestorSetupId,
            qrSlug,
            input.calculatedFdr,
            input.frontBiasPercentage,
            input.surfaceType,
            input.locationTag,
            JSON.stringify(input.settings),
            input.tags,
          ],
        );
        const parentRes = await client.query<{
          user_id: string;
          is_public: boolean;
        }>(
          `UPDATE setups SET fork_count = fork_count + 1 WHERE id = $1
           RETURNING user_id, is_public`,
          [input.forkedFromSetupId],
        );
        const parent = parentRes.rows[0];
        if (parent) {
          await this.notifications.insertOnClient(client, {
            type: 'fork',
            recipientUserId: parent.user_id,
            actorUserId: input.userId,
            setupId: input.forkedFromSetupId,
            isPublic: parent.is_public,
          });
        }
        await client.query('COMMIT');
        return this.toEntity(inserted.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        lastError = error;
        if (!isUniqueViolation(error)) {
          throw error;
        }
      } finally {
        client.release();
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

  private toIso(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Purpose: overlay sparse fork overrides onto a cloned ancestor settings tree.
 */
export function deepMerge<T>(base: T, override: unknown): T {
  if (override === undefined) {
    return structuredClone(base);
  }
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return structuredClone(override) as T;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) {
      continue;
    }
    const current = result[key];
    result[key] =
      isPlainObject(current) && isPlainObject(value)
        ? deepMerge(current, value)
        : structuredClone(value);
  }
  return result as T;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}
