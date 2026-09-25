import type { MediaErrorCode } from '@screenify/shared';

export class MediaError extends Error {
  constructor(
    public readonly code: MediaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MediaError';
  }
}