import type { JoinRoomErrorCode, JoinRoomResult, Participant } from '@screenify/shared';
import { roomAnnotations } from '../annotations/room-annotations.js';
import type { MediaRegistry } from '../mediasoup/media-registry.js';
import { joinRoomSchema } from '../schemas/room.schemas.js';
import { closeParticipation, hasJoinedBefore, openParticipation } from '../services/participant.service.js';
import { findJoinableRoom, findRoomByCode } from '../services/room.service.js';
import { AttemptLimiter } from '../utils/attempt-limiter.js';
import { logger } from '../utils/logger.js';
import { verifyPassword } from '../utils/password.js';
import { roomPresence } from './room-presence.js';
import { roomChannel, type AppServer, type AppSocket } from './types.js';

// 5 senhas erradas por pessoa e por sala a cada 5 minutos
const passwordAttempts = new AttemptLimiter(5, 5 * 60 * 1000);
setInterval(() => passwordAttempts.prune(), 60 * 1000).unref();

// Durante o desligamento as saídas são registradas de uma vez, não uma a uma
let shuttingDown = false;

export function stopTrackingParticipations(): void {
  shuttingDown = true;
}

function fail(error: JoinRoomErrorCode, message: string): JoinRoomResult {
  return { ok: false, error, message };
}

export function registerRoomHandlers(io: AppServer, socket: AppSocket, media: MediaRegistry): void {
  socket.on('room:join', async (payload, ack) => {
    if (typeof ack !== 'function') return;

    const parsed = joinRoomSchema.safeParse(payload);
    if (!parsed.success) {
      ack(fail('INVALID_PAYLOAD', 'Dados de entrada inválidos'));
      return;
    }

    try {
      ack(await joinRoom(io, socket, media, parsed.data.code, parsed.data.password));
    } catch (error) {
      logger.error({ err: error, socketId: socket.id }, '[ROOM] Join failed');
      ack(fail('INTERNAL_ERROR', 'Não foi possível entrar na sala'));
    }
  });

  socket.on('room:leave', async (ack) => {
    try {
      await leaveCurrentRoom(io, socket, media);
    } catch (error) {
      logger.error({ err: error, socketId: socket.id }, '[ROOM] Leave failed');
    }
    if (typeof ack === 'function') ack();
  });

  socket.on('disconnect', async (reason) => {
    logger.info({ userId: socket.data.user.id, reason }, '[SOCKET] Disconnected');
    try {
      await leaveCurrentRoom(io, socket, media);
    } catch (error) {
      logger.error({ err: error, socketId: socket.id }, '[ROOM] Leave on disconnect failed');
    }
  });
}

async function joinRoom(
  io: AppServer,
  socket: AppSocket,
  media: MediaRegistry,
  code: string,
  password: string | undefined,
): Promise<JoinRoomResult> {
  const user = socket.data.user;
  const room = await findJoinableRoom(code);

  if (!room) {
    return fail('ROOM_NOT_FOUND', 'Sala não encontrada');
  }

  const isHost = room.hostId === user.id;
  const { passwordHash } = room;

  // O criador nunca digita a senha; quem já entrou antes também não (outra aba, recarregar a página)
  if (passwordHash && !isHost && !(await hasJoinedBefore(room.id, user.id))) {
    const attemptKey = `${user.id}:${room.id}`;

    if (passwordAttempts.isBlocked(attemptKey)) {
      return fail('TOO_MANY_ATTEMPTS', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
    }
    if (!password) {
      return fail('PASSWORD_REQUIRED', 'Esta sala é protegida por senha');
    }
    if (!(await verifyPassword(password, passwordHash))) {
      passwordAttempts.registerFailure(attemptKey);
      logger.warn({ code, userId: user.id }, '[ROOM] Wrong password');
      return fail('WRONG_PASSWORD', 'Senha incorreta');
    }
    passwordAttempts.reset(attemptKey);
  }

  // Uma conexão fica em uma sala por vez
  if (socket.data.roomId && socket.data.roomId !== room.id) {
    await leaveCurrentRoom(io, socket, media);
  }

  const previous = roomPresence.getEntry(room.id, user.id);

  // A mesma pessoa abriu a sala em outra aba: a conexão nova assume o lugar da antiga
  if (previous && previous.socketId !== socket.id) {
    const oldSocket = io.sockets.sockets.get(previous.socketId);
    if (oldSocket) {
      oldSocket.data.roomId = null;
      await oldSocket.leave(roomChannel(room.id));
      oldSocket.emit('room:session-replaced');
    }
    // A mídia da aba antiga (transports, transmissão) é encerrada; a aba nova cria a dela
    finishStrokesOf(io, room.id, user.id);
    (await media.get(room.id))?.removePeer(user.id);
  }

  const participant: Participant = previous?.participant ?? {
    userId: user.id,
    displayName: user.displayName,
    role: isHost ? 'HOST' : 'PARTICIPANT',
    color: roomPresence.nextColor(room.id),
  };

  if (!previous) {
    await openParticipation(room.id, user.id, participant.role);
  }

  roomPresence.set(room.id, { participant, socketId: socket.id });
  socket.data.roomId = room.id;
  await socket.join(roomChannel(room.id));

  if (!previous) {
    socket.to(roomChannel(room.id)).emit('room:participant-joined', participant);
    logger.info({ code, userId: user.id, role: participant.role }, '[ROOM] Participant joined');
  } else {
    logger.info({ code, userId: user.id }, '[ROOM] Session moved to a new connection');
  }

  return {
    ok: true,
    room: await findRoomByCode(code),
    self: participant,
    participants: roomPresence.participants(room.id),
  };
}

async function leaveCurrentRoom(io: AppServer, socket: AppSocket, media: MediaRegistry): Promise<void> {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const userId = socket.data.user.id;
  socket.data.roomId = null;
  await socket.leave(roomChannel(roomId));

  // Falso quando outra aba já assumiu o lugar: nada a anunciar
  if (!roomPresence.remove(roomId, userId, socket.id) || shuttingDown) return;

  // Encerra a mídia e os traços em andamento da pessoa; se a sala esvaziou, libera tudo
  finishStrokesOf(io, roomId, userId);
  (await media.get(roomId))?.removePeer(userId);
  if (roomPresence.size(roomId) === 0) {
    await media.close(roomId);
    roomAnnotations.deleteRoom(roomId);
  }

  await closeParticipation(roomId, userId, roomPresence.size(roomId) === 0);
  io.to(roomChannel(roomId)).emit('room:participant-left', { userId });
  logger.info({ roomId, userId }, '[ROOM] Participant left');
}

/** Chamado quando o criador exclui a sala: avisa e desconecta todo mundo dela */
export async function closeRoomForEveryone(io: AppServer, media: MediaRegistry, roomId: string): Promise<void> {
  for (const entry of roomPresence.removeRoom(roomId)) {
    const socket = io.sockets.sockets.get(entry.socketId);
    if (!socket) continue;

    socket.data.roomId = null;
    socket.emit('room:closed', { reason: 'DELETED_BY_HOST' });
    void socket.leave(roomChannel(roomId));
  }
  await media.close(roomId);
  roomAnnotations.deleteRoom(roomId);
}

/** Quem sai no meio de um traço deixa o que já desenhou: o traço é concluído para todos */
function finishStrokesOf(io: AppServer, roomId: string, userId: string): void {
  for (const id of roomAnnotations.endAllOf(roomId, userId)) {
    io.to(roomChannel(roomId)).emit('drawing:ended', { id });
  }
}