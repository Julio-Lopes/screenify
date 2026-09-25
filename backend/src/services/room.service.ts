import { prisma } from '../database/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CreateRoomInput } from '../schemas/room.schemas.js';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../utils/password.js';
import { generateRoomCode } from '../utils/room-code.js';

const MAX_CODE_ATTEMPTS = 5;

export interface RoomSummary {
  code: string;
  host: { id: string; displayName: string } | null;
  hasPassword: boolean;
  participantCount: number;
  createdAt: Date;
}

const roomSummarySelect = {
  code: true,
  passwordHash: true,
  createdAt: true,
  host: { select: { id: true, displayName: true } },
  _count: { select: { participants: { where: { leftAt: null } } } },
} satisfies Prisma.RoomSelect;

type RoomWithSummary = Prisma.RoomGetPayload<{ select: typeof roomSummarySelect }>;

function toSummary(room: RoomWithSummary): RoomSummary {
  return {
    code: room.code,
    host: room.host,
    hasPassword: room.passwordHash !== null,
    participantCount: room._count.participants,
    createdAt: room.createdAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function createRoom(hostId: string, input: CreateRoomInput): Promise<RoomSummary> {
  const passwordHash = input.password ? await hashPassword(input.password) : null;

  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
    try {
      const room = await prisma.room.create({
        data: {
          code: generateRoomCode(),
          hostId,
          passwordHash,
          // A sala nasce vazia: o host só vira participante ao entrar pelo WebSocket
          emptySince: new Date(),
        },
        select: roomSummarySelect,
      });

      logger.info({ code: room.code, protected: passwordHash !== null }, '[ROOM] Created');
      return toSummary(room);
    } catch (error) {
      if (isUniqueViolation(error) && attempt < MAX_CODE_ATTEMPTS) {
        logger.warn({ attempt }, '[ROOM] Code collision, retrying');
        continue;
      }
      throw error;
    }
  }

  throw new Error('Não foi possível gerar um código de sala único');
}

export async function findRoomByCode(code: string): Promise<RoomSummary> {
  const room = await prisma.room.findUnique({
    where: { code },
    select: roomSummarySelect,
  });

  if (!room) {
    throw AppError.notFound('Sala não encontrada');
  }

  return toSummary(room);
}

export async function deleteRoom(code: string, requesterId: string): Promise<void> {
  const room = await prisma.room.findUnique({
    where: { code },
    select: { id: true, hostId: true },
  });

  if (!room) {
    throw AppError.notFound('Sala não encontrada');
  }

  if (room.hostId !== requesterId) {
    throw AppError.forbidden('Somente o criador da sala pode excluí-la');
  }

  await prisma.room.delete({ where: { id: room.id } });
  logger.info({ code }, '[ROOM] Deleted by host');
}