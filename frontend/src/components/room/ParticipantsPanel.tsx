import type { Participant } from '@screenify/shared';
import { Avatar } from '../Avatar';

interface ParticipantsPanelProps {
  participants: Participant[];
  selfId: string;
}

export function ParticipantsPanel({ participants, selfId }: ParticipantsPanelProps) {
  // Você primeiro, depois quem criou a sala, depois por nome
  const sorted = [...participants].sort((a, b) => {
    if (a.userId === selfId) return -1;
    if (b.userId === selfId) return 1;
    if (a.role !== b.role) return a.role === 'HOST' ? -1 : 1;
    return a.displayName.localeCompare(b.displayName, 'pt-BR');
  });

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-border-subtle lg:flex">
      <div className="flex h-12 items-center justify-between border-b border-border-subtle px-4">
        <h2 className="text-body-sm font-semibold">Participantes</h2>
        <span className="font-mono text-caption text-text-muted tabular-nums">{participants.length}</span>
      </div>
      <ul className="flex flex-col gap-0.5 overflow-y-auto p-2">
        {sorted.map((p) => (
          <li key={p.userId} className="flex animate-enter items-center gap-3 rounded-md px-2 py-2">
            <Avatar name={p.displayName} color={p.color} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body-sm font-medium">
                {p.displayName}
                {p.userId === selfId && <span className="font-normal text-text-muted"> (você)</span>}
              </span>
              <span className="text-caption text-text-muted">
                {p.role === 'HOST' ? 'Criou a sala' : 'Online'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}