import type { RoomSummary } from './room.js';

export type ParticipantRole = 'HOST' | 'PARTICIPANT';

export interface Participant {
  userId: string;
  displayName: string;
  role: ParticipantRole;
  /** Cor que identifica a pessoa no avatar e, nas próximas fases, no cursor e nas anotações */
  color: string;
}

export interface JoinRoomPayload {
  code: string;
  password?: string;
}

export type JoinRoomErrorCode =
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'PASSWORD_REQUIRED'
  | 'WRONG_PASSWORD'
  | 'TOO_MANY_ATTEMPTS'
  | 'INTERNAL_ERROR';

export type JoinRoomResult =
  | { ok: true; room: RoomSummary; self: Participant; participants: Participant[] }
  | { ok: false; error: JoinRoomErrorCode; message: string };

export type RoomClosedReason = 'DELETED_BY_HOST';

/** Eventos que o servidor envia para o navegador */
export interface ServerToClientEvents {
  'room:participant-joined': (participant: Participant) => void;
  'room:participant-left': (payload: { userId: string }) => void;
  'room:closed': (payload: { reason: RoomClosedReason }) => void;
  'room:session-replaced': () => void;
}

/** Eventos que o navegador envia para o servidor */
export interface ClientToServerEvents {
  'room:join': (payload: JoinRoomPayload, ack: (result: JoinRoomResult) => void) => void;
  'room:leave': (ack: () => void) => void;
}

/** Mensagem do erro de conexão quando o token de sessão é inválido ou ausente */
export type SocketAuthErrorMessage = 'UNAUTHORIZED';