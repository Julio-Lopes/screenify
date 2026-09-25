import type { CreateRoomRequest, RoomResponse, RoomSummary } from '@screenify/shared';
import { apiRequest } from './api';

export async function createRoom(input: CreateRoomRequest, token: string): Promise<RoomSummary> {
  const { room } = await apiRequest<RoomResponse>('/rooms', { method: 'POST', body: input, token });
  return room;
}

export async function getRoom(code: string, signal?: AbortSignal): Promise<RoomSummary> {
  const { room } = await apiRequest<RoomResponse>(`/rooms/${encodeURIComponent(code)}`, { signal });
  return room;
}