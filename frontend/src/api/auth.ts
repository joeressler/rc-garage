import { apiJson } from './http';

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

export interface SessionProfile extends UserProfile {
  vehicleCount: number;
  setupCount: number;
}

export interface AuthTokenResponse {
  token: string;
  user: UserProfile;
}

export function asSessionProfile(
  user: UserProfile,
  fleet: Pick<SessionProfile, 'vehicleCount' | 'setupCount'> = {
    vehicleCount: 0,
    setupCount: 0,
  },
): SessionProfile {
  return {
    ...user,
    vehicleCount: fleet.vehicleCount,
    setupCount: fleet.setupCount,
  };
}

export function apiLogin(credentials: {
  email: string;
  password: string;
}): Promise<AuthTokenResponse> {
  return apiJson<AuthTokenResponse>('/api/garage/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function apiRegister(payload: {
  email: string;
  password: string;
  callsign: string;
  ageAttested: true;
}): Promise<AuthTokenResponse> {
  return apiJson<AuthTokenResponse>('/api/garage/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function apiGetMe(token: string): Promise<SessionProfile> {
  return apiJson<SessionProfile>('/api/garage/auth/me', {
    method: 'GET',
    token,
  });
}

export function apiChangePassword(
  token: string,
  payload: { currentPassword: string; nextPassword: string },
): Promise<{ changed: true }> {
  return apiJson<{ changed: true }>('/api/garage/auth/change-password', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function apiChangeEmail(
  token: string,
  payload: { password: string; nextEmail: string },
): Promise<UserProfile> {
  return apiJson<UserProfile>('/api/garage/auth/change-email', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function apiUpdateProfile(
  token: string,
  payload: { bio?: string | null; avatarUrl?: string | null },
): Promise<UserProfile> {
  return apiJson<UserProfile>('/api/garage/auth/profile', {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  });
}

export function apiDeleteAccount(
  token: string,
  payload: { password: string; confirmation: 'DELETE' },
): Promise<{ deleted: true }> {
  return apiJson<{ deleted: true }>('/api/garage/auth/me', {
    method: 'DELETE',
    token,
    body: JSON.stringify(payload),
  });
}
