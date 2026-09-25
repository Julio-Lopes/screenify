import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface EndRoomModalProps {
  open: boolean;
  ending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EndRoomModal({ open, ending, onCancel, onConfirm }: EndRoomModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      dismissible={!ending}
      title="Encerrar sala?"
      description="Todos os participantes serão desconectados e o link deixará de funcionar."
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={ending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={ending} loadingText="Encerrando…">
            Encerrar sala
          </Button>
        </>
      }
    >
      <p className="text-body-sm text-text-secondary">Essa ação não pode ser desfeita.</p>
    </Modal>
  );
}