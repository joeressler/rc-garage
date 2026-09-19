import { z } from 'zod';

export const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(100)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const UserRegistrationSchema = z.object({
  email: z.string().email(),
  password: PasswordSchema,
  callsign: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Callsign must be alphanumeric'),
  ageAttested: z.literal(true),
  acceptedLegal: z.literal(true),
  recaptchaToken: z.string().min(1),
});

export const UserLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(100),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  nextPassword: PasswordSchema,
});

export const ChangeEmailSchema = z.object({
  password: z.string().min(1).max(100),
  nextEmail: z.string().email(),
});

export const UpdateProfileSchema = z.object({
  bio: z.string().max(250).nullable().optional(),
  avatarUrl: z
    .string()
    .url()
    .max(2048)
    .refine((value) => /^https:\/\//i.test(value), 'avatarUrl must be https')
    .nullable()
    .optional(),
});

export const DeleteAccountSchema = z.object({
  password: z.string().min(1).max(100),
  confirmation: z.literal('DELETE'),
});

export type UserRegistrationDto = z.infer<typeof UserRegistrationSchema>;
export type UserLoginDto = z.infer<typeof UserLoginSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type ChangeEmailDto = z.infer<typeof ChangeEmailSchema>;
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
export type DeleteAccountDto = z.infer<typeof DeleteAccountSchema>;

export type UserRole = 'driver' | 'moderator' | 'admin';

export interface UserProfile {
  id: string;
  callsign: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  role: UserRole;
  isSuspended: boolean;
  createdAt: string;
}

export interface AuthTokenResponse {
  token: string;
  user: UserProfile;
}

export interface AuthMeResponse extends UserProfile {
  vehicleCount: number;
  setupCount: number;
}

export interface PasswordChangedResult {
  changed: true;
}

export interface AccountDeletedResult {
  deleted: true;
}

export interface JwtPayload {
  sub: string;
  callsign: string;
  role?: UserRole;
}

export interface AuthenticatedUser {
  id: string;
  callsign: string;
  email: string;
  role: UserRole;
  isSuspended?: boolean;
}
