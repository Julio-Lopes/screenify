import type { PublicUser } from './user.js';

export interface RoomSummary {
  code: string;
  name: string;
  host: PublicUser | null;
  hasPassword: boolean;
  participantCount: number;
  /** Data em ISO 8601, como trafega no JSON */
  createdAt: string;
}

export interface CreateRoomRequest {
  name?: string;
  password?: string;
}

export interface RoomResponse {
  room: RoomSummary;
}