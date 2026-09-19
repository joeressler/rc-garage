import { apiJson } from './http';

export type ReportReasonCode =
  | 'spam'
  | 'abuse'
  | 'stolen_setup'
  | 'malware_link'
  | 'other';

export type ReportTargetType = 'setup' | 'user' | 'comment';

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: ReportReasonCode;
  details?: string;
}

export interface CreatedReport {
  id: string;
  status: 'open';
}

export function apiCreateReport(
  payload: CreateReportPayload,
  token: string,
): Promise<CreatedReport> {
  return apiJson<CreatedReport>('/api/garage/reports', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}
