import type { RoomSummary } from '@screenify/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { PasswordField } from '../ui/PasswordField';
import { TextField } from '../ui/TextField';

export interface JoinFormValues {
  displayName: string;
  password: string;
}

interface JoinFormProps {
  room: RoomSummary;
  askName: boolean;
  askPassword: boolean;
  submitting: boolean;
  error: string | null;
  fieldErrors?: Partial<Record<keyof JoinFormValues, string>>;
  onSubmit: (values: JoinFormValues) => void;
}

export function JoinForm({ room, askName, askPassword, submitting, error, fieldErrors, onSubmit }: JoinFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ displayName, password });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full max-w-[400px] flex-col rounded-xl border border-border bg-surface-elevated"
    >
      <div className="flex flex-col gap-1 px-5 pt-5">
        <h1 className="text-[18px] leading-7 font-semibold">Entrar na sala</h1>
        <p className="flex min-w-0 items-center gap-2 text-body-sm text-text-secondary">
          <span className="truncate">{room.name}</span>
          <span className="font-mono text-caption text-text-muted">{room.code}</span>
        </p>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {askName && (
          <TextField
            label="Seu nome"
            hint="Visível para todos os participantes."
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={fieldErrors?.displayName}
            maxLength={40}
            autoComplete="nickname"
            autoFocus
          />
        )}
        {askPassword && (
          <PasswordField
            label="Senha da sala"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors?.password}
            maxLength={64}
            autoFocus={!askName}
          />
        )}
        {error && (
          <p role="alert" className="text-body-sm text-error-text">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-end border-t border-border px-5 py-4">
        <Button type="submit" loading={submitting} loadingText="Entrando…">
          Entrar
        </Button>
      </div>
    </form>
  );
}