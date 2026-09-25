import type { ParticipantRole } from '@screenify/shared';
import { prisma } from '../database/prisma.js';

/** Quem já entrou uma vez numa sala com senha não precisa digitá-la de novo (outra aba, recarregar a página) */
export async function hasJoinedBefore(roomId: string, userId: string): Promise<boolean> {
  const participation = await prisma.roomParticipant.findFirst({
    where: { roomId, userId },
    select: { id: true },
  });
  return participation !== null;
}

/** Registra a entrada e marca a sala como ocupada (cancela a contagem de expiração) */
export async function openParticipation(roomId: string, userId: string, role: ParticipantRole): Promise<void> {
  await prisma.$transaction([
    prisma.roomParticipant.create({ data: { roomId, userId, role } }),
    prisma.room.updateMany({ where: { id: roomId }, data: { emptySince: null } }),
  ]);
}

/** Registra a saída e, se foi o último a sair, marca desde quando a sala está vazia */
export async function closeParticipation(roomId: string, userId: string, roomIsNowEmpty: boolean): Promise<void> {
  const now = new Date();

  await prisma.$transaction([
    prisma.roomParticipant.updateMany({
      where: { roomId, userId, leftAt: null },
      data: { leftAt: now },
    }),
    ...(roomIsNowEmpty
      ? [prisma.room.updateMany({ where: { id: roomId }, data: { emptySince: now } })]
      : []),
  ]);
}

/**
 * Fecha todas as participações abertas e marca todas as salas como vazias.
 * Usado no desligamento (todos estão saindo) e na subida do servidor, quando qualquer
 * participação aberta é resto de uma queda: ninguém está conectado ainda.
 */
export async function closeAllOpenParticipations(): Promise<number> {
  const now = new Date();

  const [participations] = await prisma.$transaction([
    prisma.roomParticipant.updateMany({ where: { leftAt: null }, data: { leftAt: now } }),
    prisma.room.updateMany({ where: { emptySince: null }, data: { emptySince: now } }),
  ]);

  return participations.count;
}