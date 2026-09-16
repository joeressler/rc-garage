export interface SuccessEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
  timestamp: string;
}

export interface ErrorEnvelope {
  success: false;
  statusCode: number;
  error: string;
  message: string[];
  timestamp: string;
}

/**
 * Purpose: surface garage API validation and auth failures without leaking raw envelopes.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly messages: string[];

  constructor(statusCode: number, messages: string[], errorName = 'Request failed') {
    super(messages[0] ?? errorName);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.messages = messages;
  }
}

function isErrorEnvelope(payload: unknown): payload is ErrorEnvelope {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    (payload as { success: unknown }).success === false
  );
}

function isSuccessEnvelope<T>(payload: unknown): payload is SuccessEnvelope<T> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    (payload as { success: unknown }).success === true &&
    'data' in payload
  );
}

/**
 * Purpose: unwrap the NestJS REST envelope and attach Bearer tokens for session calls.
 */
export async function apiJson<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, body, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    body,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.status, ['Unexpected empty response from garage API']);
  }

  if (isErrorEnvelope(payload)) {
    throw new ApiError(payload.statusCode, payload.message, payload.error);
  }

  if (!response.ok) {
    throw new ApiError(response.status, [`Garage API request failed (${response.status})`]);
  }

  if (!isSuccessEnvelope<T>(payload)) {
    throw new ApiError(response.status, ['Malformed garage API envelope']);
  }

  return payload.data;
}
