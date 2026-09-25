import type {
  ConnectTransportPayload,
  ConsumePayload,
  ConsumerInfo,
  CreateTransportPayload,
  MediaResult,
  ProducePayload,
  ProducerInfo,
  RtpCapabilities,
  TransportInfo,
} from './media.js';
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
  'media:producer-added': (producer: ProducerInfo) => void;
  'media:producer-closed': (payload: { producerId: string }) => void;
}

/** Eventos que o navegador envia para o servidor */
export interface ClientToServerEvents {
  'room:join': (payload: JoinRoomPayload, ack: (result: JoinRoomResult) => void) => void;
  'room:leave': (ack: () => void) => void;
  'media:get-rtp-capabilities': (ack: (result: MediaResult<RtpCapabilities>) => void) => void;
  'media:create-transport': (payload: CreateTransportPayload, ack: (result: MediaResult<TransportInfo>) => void) => void;
  'media:connect-transport': (payload: ConnectTransportPayload, ack: (result: MediaResult<null>) => void) => void;
  'media:produce': (payload: ProducePayload, ack: (result: MediaResult<{ producerId: string }>) => void) => void;
  'media:close-producer': (payload: { producerId: string }, ack: (result: MediaResult<null>) => void) => void;
  'media:list-producers': (ack: (result: MediaResult<ProducerInfo[]>) => void) => void;
  'media:consume': (payload: ConsumePayload, ack: (result: MediaResult<ConsumerInfo>) => void) => void;
  'media:resume-consumer': (payload: { consumerId: string }, ack: (result: MediaResult<null>) => void) => void;
}

/** Mensagem do erro de conexão quando o token de sessão é inválido ou ausente */
export type SocketAuthErrorMessage = 'UNAUTHORIZED';