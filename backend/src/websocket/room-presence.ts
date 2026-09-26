import type { Participant } from '@screenify/shared';

// Cores do design system para identificar participantes
const PARTICIPANT_COLORS = [
  '#818CF8',
  '#34D399',
  '#FBBF24',
  '#FB7185',
  '#38BDF8',
  '#F472B6',
  '#A78BFA',
  '#FB923C',
] as const;

interface PresenceEntry {
  participant: Participant;
  socketId: string;
}

/**
 * Quem está conectado em cada sala agora. É estado temporário:
 * vive em memória e some quando o servidor reinicia.
 * O banco guarda só o histórico de entradas e saídas.
 */
export class RoomPresence {
  private readonly rooms = new Map<string, Map<string, PresenceEntry>>();

  getEntry(roomId: string, userId: string): PresenceEntry | undefined {
    return this.rooms.get(roomId)?.get(userId);
  }

  set(roomId: string, entry: PresenceEntry): void {
    let members = this.rooms.get(roomId);
    if (!members) {
      members = new Map();
      this.rooms.set(roomId, members);
    }
    members.set(entry.participant.userId, entry);
  }

  /**
   * Remove a pessoa só se a conexão que saiu for a atual dela.
   * Evita que a desconexão de uma aba antiga derrube a aba nova que assumiu o lugar.
   */
  remove(roomId: string, userId: string, socketId: string): boolean {
    const members = this.rooms.get(roomId);
    const entry = members?.get(userId);
    if (!members || !entry || entry.socketId !== socketId) {
      return false;
    }

    members.delete(userId);
    if (members.size === 0) {
      this.rooms.delete(roomId);
    }
    return true;
  }

  /** Remove a sala inteira e devolve quem estava nela */
  removeRoom(roomId: string): PresenceEntry[] {
    const entries = [...(this.rooms.get(roomId)?.values() ?? [])];
    this.rooms.delete(roomId);
    return entries;
  }

  participants(roomId: string): Participant[] {
    return [...(this.rooms.get(roomId)?.values() ?? [])].map((entry) => entry.participant);
  }

  size(roomId: string): number {
    return this.rooms.get(roomId)?.size ?? 0;
  }

  /** Salas com alguém conectado e total de pessoas conectadas */
  stats(): { active: number; participants: number } {
    let participants = 0;
    for (const members of this.rooms.values()) participants += members.size;
    return { active: this.rooms.size, participants };
  }

  /** Primeira cor livre na sala; se todas estiverem em uso, repete em ciclo */
  nextColor(roomId: string): string {
    const inUse = new Set(this.participants(roomId).map((p) => p.color));
    const free = PARTICIPANT_COLORS.find((color) => !inUse.has(color));
    return free ?? PARTICIPANT_COLORS[this.size(roomId) % PARTICIPANT_COLORS.length] ?? PARTICIPANT_COLORS[0];
  }
}

export const roomPresence = new RoomPresence();