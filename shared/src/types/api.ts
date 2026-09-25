export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_SERVER_ERROR';

export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
  details?: Record<string, string[] | undefined>;
}