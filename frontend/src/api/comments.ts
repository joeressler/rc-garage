import { apiJson } from './http';

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

export function apiListComments(
  setupId: string,
  options: { cursor?: string; limit?: number } = {},
  token?: string | null,
): Promise<PaginatedComments> {
  const query = new URLSearchParams();
  if (options.cursor) query.set('cursor', options.cursor);
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  const qs = query.toString();
  return apiJson<PaginatedComments>(
    `/api/garage/setups/${setupId}/comments${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      token,
    },
  );
}

export function apiCreateComment(
  setupId: string,
  body: string,
  token: string,
): Promise<SetupComment> {
  return apiJson<SetupComment>(`/api/garage/setups/${setupId}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  });
}

export function apiDeleteComment(
  commentId: string,
  token: string,
): Promise<DeleteCommentResult> {
  return apiJson<DeleteCommentResult>(`/api/garage/comments/${commentId}`, {
    method: 'DELETE',
    token,
  });
}
