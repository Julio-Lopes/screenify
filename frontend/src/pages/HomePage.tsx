import { ArrowRight, Hash, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { useUiStore } from '../stores/ui.store';
import { isValidRoomCode, normalizeRoomCodeInput } from '../utils/room-code';

export function HomePage() {
  const openCreateRoom = useUiStore((s) => s.openCreateRoom);
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const canJoin = isValidRoomCode(code);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canJoin) navigate(`/room/${code}`);
  }

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-7">
      <div className="flex flex-col gap-3.5">
        <h1 className="text-[36px] leading-[44px] font-semibold tracking-[-0.025em] text-balance sm:text-[44px] sm:leading-[52px]">
          Compartilhe sua tela.
          <br />
          <span className="text-text-secondary">Colabore em tempo real.</span>
        </h1>
        <p className="text-body text-text-secondary">
          Transmissão direto do navegador, com anotações ao vivo sobre a tela. Sem instalação.
        </p>
      </div>

      <Button size="lg" onClick={openCreateRoom}>
        <Plus size={18} aria-hidden />
        Criar uma sala
      </Button>

      <div className="flex items-center gap-3 text-caption text-text-disabled" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleJoin} className="flex items-end gap-2">
        <TextField
          label="Código da sala"
          placeholder="A7K9-X2P4"
          icon={Hash}
          size="lg"
          mono
          value={code}
          onChange={(e) => setCode(normalizeRoomCodeInput(e.target.value))}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="flex-1"
        />
        <Button type="submit" variant="secondary" size="lg" disabled={!canJoin}>
          Entrar
          <ArrowRight size={16} aria-hidden />
        </Button>
      </form>
    </div>
  );
}