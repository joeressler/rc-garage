import { z } from 'zod';
import { UserRole } from './auth.contract';

export const AdminUserQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().min(1).max(80).optional(), // matches callsign OR email (ILIKE)
  role: z.enum(['driver', 'moderator', 'admin']).optional(),
  suspended: z.coerce.boolean().optional(),
});

export type AdminUserQueryDto = z.infer<typeof AdminUserQuerySchema>;

export const ModerateUserSuspensionSchema = z
  .object({
    suspend: z.boolean(),
    reason: z.string().min(3).max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.suspend && !val.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reason is required when suspending',
        path: ['reason'],
      });
    }
  });

export type ModerateUserSuspensionDto = z.infer<
  typeof ModerateUserSuspensionSchema
>;

export const ModerateUserRoleSchema = z.object({
  role: z.enum(['driver', 'moderator', 'admin']),
  reason: z.string().max(500).optional(),
});

export type ModerateUserRoleDto = z.infer<typeof ModerateUserRoleSchema>;

export const AdminSetupQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().min(1).max(100).optional(),
  hidden: z.coerce.boolean().optional(),
  isPublic: z.coerce.boolean().optional(),
  authorCallsign: z.string().optional(),
});

export type AdminSetupQueryDto = z.infer<typeof AdminSetupQuerySchema>;

export const ModerateSetupVisibilitySchema = z
  .object({
    hide: z.boolean(),
    reason: z.string().min(3).max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.hide && !val.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reason is required when hiding',
        path: ['reason'],
      });
    }
  });

export type ModerateSetupVisibilityDto = z.infer<
  typeof ModerateSetupVisibilitySchema
>;

export const AdminDeleteSetupSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type AdminDeleteSetupDto = z.infer<typeof AdminDeleteSetupSchema>;

export const AdminAuditLogQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AdminAuditLogQueryDto = z.infer<typeof AdminAuditLogQuerySchema>;

export interface AdminOverview {
  userCount: number;
  setupCount: number;
  publicSetupCount: number;
  hiddenSetupCount: number;
  suspendedUserCount: number;
  likes24h: number;
}

export interface AdminUserSummary {
  id: string;
  callsign: string;
  email: string;
  role: UserRole;
  isSuspended: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  avatarUrl: string | null;
  bio: string | null;
  vehicleCount: number;
  setupCount: number;
  createdAt: string;
}

export interface PaginatedAdminUsers {
  items: AdminUserSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AdminSetupSummary {
  id: string;
  title: string;
  vehicleId: string;
  userId: string;
  authorCallsign: string;
  authorEmail: string;
  vehicleName: string;
  vehicleMake: string;
  vehicleModel: string;
  isPublic: boolean;
  isHidden: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  forkCount: number;
  likeCount: number;
  qrSlug: string;
  surfaceType: string;
  calculatedFdr: number;
  frontBiasPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedAdminSetups {
  items: AdminSetupSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ModerationAuditLogEntry {
  id: string;
  actorUserId: string;
  actorCallsign: string;
  actorRole: UserRole;
  action: string;
  targetType: 'user' | 'setup';
  targetId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedAuditLog {
  items: ModerationAuditLogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
}
