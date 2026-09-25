import type { Participant } from '@screenify/shared';
import { Avatar } from '../Avatar';

const MAX_VISIBLE = 3;

export function AvatarGroup({ participants }: { participants: Participant[] }) {
  const visible = participants.slice(0, MAX_VISIBLE);
  const hidden = participants.length - visible.length;
  const label = `${participants.length} ${participants.length === 1 ? 'participante' : 'participantes'} na sala`;

  return (
    <div className="flex items-center" role="img" aria-label={label} title={label}>
      {visible.map((p, index) => (
        <Avatar
          key={p.userId}
          name={p.displayName}
          color={p.color}
          size="sm"
          className={index > 0 ? '-ml-2 ring-2 ring-background' : 'ring-2 ring-background'}
        />
      ))}
      {hidden > 0 && (
        <span className="-ml-2 flex size-6 items-center justify-center rounded-full bg-surface-active text-[10px] font-semibold text-text-secondary ring-2 ring-background">
          +{hidden}
        </span>
      )}
    </div>
  );
}