import { apiJson } from './http';
import type { SetupEntity, SetupSettings } from './setups';

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface ForkSetupPayload {
  targetVehicleId: string;
  title?: string;
  description?: string;
  settingOverrides?: DeepPartial<SetupSettings>;
}

/**
 * Purpose: clone a public or owned setup into target vehicle with immutable lineage pointers.
 */
export function apiForkSetup(
  sourceSetupId: string,
  payload: ForkSetupPayload,
  token: string,
): Promise<SetupEntity> {
  return apiJson<SetupEntity>(
    `/api/garage/setups/${encodeURIComponent(sourceSetupId)}/fork`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    },
  );
}
