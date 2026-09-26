export type { ApiErrorBody, ApiErrorCode } from './types/api.js';
export type {
  ConnectTransportPayload,
  ConsumePayload,
  ConsumerInfo,
  CreateTransportPayload,
  DtlsParameters,
  MediaErrorCode,
  MediaKind,
  MediaResult,
  MediaSource,
  ProducePayload,
  ProducerInfo,
  RtpCapabilities,
  RtpParameters,
  SetPreferredLayersPayload,
  TransportDirection,
  TransportInfo,
} from './types/media.js';
export type {
  ClientToServerEvents,
  JoinRoomErrorCode,
  JoinRoomPayload,
  JoinRoomResult,
  Participant,
  ParticipantRole,
  RoomClosedReason,
  ServerToClientEvents,
  SocketAuthErrorMessage,
} from './types/realtime.js';
export type { CreateRoomRequest, RoomResponse, RoomSummary } from './types/room.js';
export type { CreateGuestRequest, GuestSessionResponse, PublicUser } from './types/user.js';