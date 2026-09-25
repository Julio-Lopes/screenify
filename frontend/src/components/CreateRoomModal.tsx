import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '../services/api';
import { createRoom } from '../services/rooms';
import { createGuestSession } from '../services/users';
import { useSessionStore } from '../stores/session.store';
import { toast } from '../stores/toast.store';
import { useUiStore } from '../stores/ui.store';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { PasswordField } from './ui/PasswordField';
import { TextField } from './ui/TextField';

type Field = 'displayName' | 'name' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

const FORM_ID = 'create-room-form';
const FIELDS: Field[] = ['displayName', 'name', 'password'];

export function CreateRoomModal() {
  const open = useUiStore((s) => s.createRoomOpen);
  const close = useUiStore((s) => s.closeCreateRoom);
  const { token, user, setSession, clearSession } = useSessionStore();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRoomName('');
      setPassword('');
      setFieldErrors({});
      setFormError(null);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      let sessionToken = token;
      if (!sessionToken) {
        const session = await createGuestSession({ displayName });
        setSession(session);
        sessionToken = session.token;
      }

      const room = await createRoom(
        { name: roomName.trim() || undefined, password: password || undefined },
        sessionToken,
      );

      close();
      toast('success', 'Sala criada');
      navigate(`/room/${room.code}`);
    } catch (error) {
      handleError(error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleError(error: unknown) {
    if (!(error instanceof ApiError)) {
      setFormError('Algo deu errado. Tente novamente.');
      return;
    }

    if (error.code === 'UNAUTHORIZED') {
      clearSession();
      setFormError('Sua sessão expirou. Informe seu nome para continuar.');
      return;
    }

    if (error.code === 'VALIDATION_ERROR' && error.details) {
      const next: FieldErrors = {};
      for (const field of FIELDS) {
        const message = error.details[field]?.[0];
        if (message) next[field] = message;
      }
      setFieldErrors(next);
      return;
    }

    setFormError(error.message);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!submitting}
      title="Criar sala"
      description="Você receberá um código e um link para convidar."
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} loading={submitting} loadingText="Criando…">
            Criar
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {user ? (
          <p className="text-body-sm text-text-secondary">
            Você vai entrar como <span className="font-medium text-text-primary">{user.displayName}</span>.{' '}
            <button
              type="button"
              onClick={clearSession}
              className="cursor-pointer text-primary-hover underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
            >
              Usar outro nome
            </button>
          </p>
        ) : (
          <TextField
            label="Seu nome"
            hint="Visível para todos os participantes."
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={fieldErrors.displayName}
            maxLength={40}
            autoComplete="nickname"
            required
            autoFocus
          />
        )}

        <TextField
          label="Nome da sala"
          placeholder={user ? `Sala de ${user.displayName}` : 'Minha sala'}
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          error={fieldErrors.name}
          maxLength={60}
          autoFocus={Boolean(user)}
        />

        <PasswordField
          label="Senha"
          hint="Opcional. Quem entrar pelo link precisará dela."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          maxLength={64}
        />

        {formError && (
          <p role="alert" className="text-body-sm text-error-text">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  );
}