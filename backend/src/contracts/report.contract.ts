import { z } from 'zod';

export const ReportReasonCodeSchema = z.enum([
  'spam',
  'abuse',
  'stolen_setup',
  'malware_link',
  'other',
]);

export const CreateReportSchema = z
  .object({
    targetType: z.enum(['setup', 'user']),
    targetId: z.string().uuid(),
    reasonCode: ReportReasonCodeSchema,
    details: z.string().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.reasonCode === 'other' && !val.details?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'details are required when reasonCode is other',
        path: ['details'],
      });
    }
  });

export type ReportReasonCode = z.infer<typeof ReportReasonCodeSchema>;
export type CreateReportDto = z.infer<typeof CreateReportSchema>;

export interface CreatedReport {
  id: string;
  status: 'open';
}
