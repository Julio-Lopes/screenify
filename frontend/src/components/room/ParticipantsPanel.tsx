import type { Participant } from '@screenify/shared';
import { Avatar } from '../Avatar';

interface ParticipantListProps {
  participants: Participant[];
  selfId: string;
  /** Quem está compartilhando a tela agora, se alguém */
  sharingUserId: string | null;
}

function statusLabel(participant: Participant, sharingUserId: string | null): string {
  if (participant.userId === sharingUserId) return 'Compartilhando a tela';
  return participant.role === 'HOST' ? 'Criou a sala' : 'Online';
}

/** A lista em si: usada no painel lateral do desktop e no painel sobreposto do tablet e do celular */
export function ParticipantList({ participants, selfId, sharingUserId }: ParticipantListProps) {
  // Você primeiro, depois quem criou a sala, depois por nome
  const sorted = [...participants].sort((a, b) => {
    if (a.userId === selfId) return -1;
    if (b.userId === selfId) return 1;
    if (a.role !== b.role) return a.role === 'HOST' ? -1 : 1;
    return a.displayName.localeCompare(b.displayName, 'pt-BR');
  });

  return (
    <ul className="flex flex-col gap-0.5">
      {sorted.map((p) => (
        <li key={p.userId} className="flex animate-enter items-center gap-3 rounded-md px-2 py-2">
          <Avatar name={p.displayName} color={p.color} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body-sm font-medium">
              {p.displayName}
              {p.userId === selfId && <span className="font-normal text-text-muted"> (você)</span>}
            </span>
            <span
              className={p.userId === sharingUserId ? 'text-caption text-primary-hover' : 'text-caption text-text-muted'}
            >
              {statusLabel(p, sharingUserId)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Painel lateral fixo de 300px: só no desktop (a partir de 1024px) */
export function ParticipantsPanel(props: ParticipantListProps) {
  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-border-subtle lg:flex">
      <div className="flex h-12 items-center justify-between border-b border-border-subtle px-4">
        <h2 className="text-body-sm font-semibold">Participantes</h2>
        <span className="font-mono text-caption text-text-muted tabular-nums">{props.participants.length}</span>
      </div>
      <div className="overflow-y-auto p-2">
        <ParticipantList {...props} />
      </div>
    </aside>
  );
}