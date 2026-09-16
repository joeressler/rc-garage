import { z } from 'zod';

export const UserRegistrationSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100),
  callsign: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Callsign must be alphanumeric'),
});

export const UserLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(100),
});

export type UserRegistrationDto = z.infer<typeof UserRegistrationSchema>;
export type UserLoginDto = z.infer<typeof UserLoginSchema>;

export interface UserProfile {
  id: string;
  callsign: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
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

export interface JwtPayload {
  sub: string;
  callsign: string;
}

export interface AuthenticatedUser {
  id: string;
  callsign: string;
  email: string;
}
