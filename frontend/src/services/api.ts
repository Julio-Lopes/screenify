import type { ApiErrorBody, ApiErrorCode } from '@screenify/shared';
import { env } from '../config/env';

export type ClientErrorCode = ApiErrorCode | 'NETWORK_ERROR';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly details: ApiErrorBody['details'];

  constructor(status: number, code: ClientErrorCode, message: string, details?: ApiErrorBody['details']) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal } = options;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar ao servidor.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(data)) {
      throw new ApiError(response.status, data.error, data.message, data.details);
    }
    throw new ApiError(response.status, 'INTERNAL_SERVER_ERROR', 'O servidor respondeu com um erro inesperado.');
  }

  return data as T;
}