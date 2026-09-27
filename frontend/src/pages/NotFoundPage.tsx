import { MapPinOff } from 'lucide-react';
import { useNavigate } from 'react-router';
import { StateMessage } from '../components/StateMessage';
import { Button } from '../components/ui/Button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-14">
      <StateMessage
        icon={MapPinOff}
        title="Página não encontrada"
        description="Este endereço não existe. Confira o link ou volte ao início."
        actions={
          <Button variant="secondary" onClick={() => navigate('/')}>
            Voltar ao início
          </Button>
        }
      />
    </div>
  );
}