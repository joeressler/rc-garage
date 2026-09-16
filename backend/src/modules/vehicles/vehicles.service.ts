import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateVehicleDto,
  DeleteVehicleResult,
  UpdateVehicleDto,
  VehicleClass,
  VehicleEntity,
  VehicleScale,
  VehicleSetupSummary,
  VehicleWithSetupsEntity,
} from '../../contracts/vehicle.contract';
import { DatabaseService } from '../../database/database.service';

interface VehicleRow {
  id: string;
  user_id: string;
  name: string;
  make: string;
  model: string;
  scale: string;
  vehicle_class: string;
  is_archived: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  setup_count?: string | number;
}

interface SetupSummaryRow {
  id: string;
  vehicle_id: string;
  user_id: string;
  title: string;
  is_public: boolean;
  calculated_fdr: string | number;
  front_bias_percentage: string | number;
  surface_type: string;
  fork_count: string | number;
  like_count: string | number;
  qr_slug: string;
  forked_from_setup_id: string | null;
  created_at: Date | string;
}

const VEHICLE_COLUMNS = `
  v.id,
  v.user_id,
  v.name,
  v.make,
  v.model,
  v.scale,
  v.vehicle_class,
  v.is_archived,
  v.created_at,
  v.updated_at,
  (
    SELECT COUNT(*)::int
    FROM setups s
    WHERE s.vehicle_id = v.id
  ) AS setup_count
`;

/**
 * Purpose: persist and authorize digital-garage chassis records for the authenticated driver.
 */
@Injectable()
export class VehiclesService {
  constructor(private readonly database: DatabaseService) {}

  async create(userId: string, dto: CreateVehicleDto): Promise<VehicleEntity> {
    const result = await this.database.query<VehicleRow>(
      `INSERT INTO vehicles (user_id, name, make, model, scale, vehicle_class)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id,
         user_id,
         name,
         make,
         model,
         scale,
         vehicle_class,
         is_archived,
         created_at,
         updated_at`,
      [userId, dto.name, dto.make, dto.model, dto.scale, dto.vehicleClass],
    );

    return this.toEntity({ ...result.rows[0], setup_count: 0 });
  }

  async list(userId: string, archived: boolean): Promise<VehicleEntity[]> {
    const result = await this.database.query<VehicleRow>(
      `SELECT ${VEHICLE_COLUMNS}
       FROM vehicles v
       WHERE v.user_id = $1
         AND v.is_archived = $2
       ORDER BY v.created_at DESC`,
      [userId, archived],
    );

    return result.rows.map((row) => this.toEntity(row));
  }

  async findOne(
    userId: string,
    vehicleId: string,
  ): Promise<VehicleWithSetupsEntity> {
    const vehicleResult = await this.database.query<VehicleRow>(
      `SELECT ${VEHICLE_COLUMNS}
       FROM vehicles v
       WHERE v.id = $1
         AND v.user_id = $2`,
      [vehicleId, userId],
    );

    const vehicle = vehicleResult.rows[0];
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const setupsResult = await this.database.query<SetupSummaryRow>(
      `SELECT
         id,
         vehicle_id,
         user_id,
         title,
         is_public,
         calculated_fdr,
         front_bias_percentage,
         surface_type,
         fork_count,
         like_count,
         qr_slug,
         forked_from_setup_id,
         created_at
       FROM setups
       WHERE vehicle_id = $1
       ORDER BY created_at DESC`,
      [vehicleId],
    );

    return {
      ...this.toEntity(vehicle),
      setups: setupsResult.rows.map((row) => this.toSetupSummary(row)),
    };
  }

  async update(
    userId: string,
    vehicleId: string,
    dto: UpdateVehicleDto,
  ): Promise<VehicleEntity> {
    const assignments: string[] = [];
    const params: unknown[] = [];
    let index = 1;

    if (dto.name !== undefined) {
      assignments.push(`name = $${index++}`);
      params.push(dto.name);
    }
    if (dto.make !== undefined) {
      assignments.push(`make = $${index++}`);
      params.push(dto.make);
    }
    if (dto.model !== undefined) {
      assignments.push(`model = $${index++}`);
      params.push(dto.model);
    }
    if (dto.scale !== undefined) {
      assignments.push(`scale = $${index++}`);
      params.push(dto.scale);
    }
    if (dto.vehicleClass !== undefined) {
      assignments.push(`vehicle_class = $${index++}`);
      params.push(dto.vehicleClass);
    }
    if (dto.isArchived !== undefined) {
      assignments.push(`is_archived = $${index++}`);
      params.push(dto.isArchived);
    }

    if (assignments.length > 0) {
      assignments.push('updated_at = CURRENT_TIMESTAMP');
    }

    const setClause =
      assignments.length > 0 ? `SET ${assignments.join(', ')}` : '';
    params.push(vehicleId, userId);

    const result = await this.database.query<VehicleRow>(
      assignments.length > 0
        ? `UPDATE vehicles
           ${setClause}
           WHERE id = $${index++} AND user_id = $${index}
           RETURNING
             id,
             user_id,
             name,
             make,
             model,
             scale,
             vehicle_class,
             is_archived,
             created_at,
             updated_at`
        : `SELECT
             id,
             user_id,
             name,
             make,
             model,
             scale,
             vehicle_class,
             is_archived,
             created_at,
             updated_at
           FROM vehicles
           WHERE id = $1 AND user_id = $2`,
      params,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('Vehicle not found');
    }

    const countResult = await this.database.query<{ setup_count: string | number }>(
      `SELECT COUNT(*)::int AS setup_count FROM setups WHERE vehicle_id = $1`,
      [vehicleId],
    );

    return this.toEntity({
      ...row,
      setup_count: countResult.rows[0]?.setup_count ?? 0,
    });
  }

  async remove(userId: string, vehicleId: string): Promise<DeleteVehicleResult> {
    const client = await this.database.getClient();
    try {
      await client.query('BEGIN');

      const owned = await client.query<{ id: string }>(
        `SELECT id FROM vehicles WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [vehicleId, userId],
      );
      if (owned.rowCount === 0) {
        throw new NotFoundException('Vehicle not found');
      }

      const publicSetups = await client.query(
        `SELECT 1 FROM setups WHERE vehicle_id = $1 AND is_public = TRUE LIMIT 1`,
        [vehicleId],
      );

      if ((publicSetups.rowCount ?? 0) > 0) {
        await client.query(
          `UPDATE vehicles
           SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [vehicleId],
        );
      } else {
        await client.query(`DELETE FROM vehicles WHERE id = $1`, [vehicleId]);
      }

      await client.query('COMMIT');
      return { deleted: true, id: vehicleId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private toEntity(row: VehicleRow): VehicleEntity {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      make: row.make,
      model: row.model,
      scale: row.scale as VehicleScale,
      vehicleClass: row.vehicle_class as VehicleClass,
      isArchived: row.is_archived,
      setupCount: Number(row.setup_count ?? 0),
      createdAt: this.toIso(row.created_at),
      updatedAt: this.toIso(row.updated_at),
    };
  }

  private toSetupSummary(row: SetupSummaryRow): VehicleSetupSummary {
    return {
      id: row.id,
      vehicleId: row.vehicle_id,
      userId: row.user_id,
      title: row.title,
      isPublic: row.is_public,
      calculatedFdr: Number(row.calculated_fdr),
      frontBiasPercentage: Number(row.front_bias_percentage),
      surfaceType: row.surface_type,
      forkCount: Number(row.fork_count),
      likeCount: Number(row.like_count),
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
