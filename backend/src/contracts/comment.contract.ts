import { z } from 'zod';

export const CommentIdSchema = z.string().uuid();

export const CommentBodySchema = z.string().trim().min(1).max(2000);

export const CreateCommentSchema = z.object({
  body: CommentBodySchema,
});

export const ListCommentsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;
export type ListCommentsQuery = z.infer<typeof ListCommentsQuerySchema>;

export interface SetupComment {
  id: string;
  setupId: string;
  body: string;
  createdAt: string;
  author: { callsign: string; avatarUrl: string | null };
  isAuthor: boolean;
}

export interface PaginatedComments {
  items: SetupComment[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface DeleteCommentResult {
  deleted: true;
  id: string;
}
