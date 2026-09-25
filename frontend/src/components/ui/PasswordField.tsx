import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { TextField } from './TextField';

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'icon' | 'trailing'>;

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      icon={Lock}
      autoComplete="new-password"
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="flex size-8 cursor-pointer items-center justify-center rounded-sm text-text-secondary transition-colors duration-120 hover:bg-surface-hover hover:text-text-primary focus-visible:ring-3 focus-visible:ring-primary/25 focus-visible:outline-none"
        >
          <Icon size={15} aria-hidden />
        </button>
      }
    />
  );
}