import type { CreateGuestRequest, GuestSessionResponse } from '@screenify/shared';
import { apiRequest } from './api';

export function createGuestSession(input: CreateGuestRequest): Promise<GuestSessionResponse> {
  return apiRequest<GuestSessionResponse>('/users/guest', { method: 'POST', body: input });
}