import { apiJson } from './http';

export interface UserProfile {
  id: string;
  callsign: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
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
