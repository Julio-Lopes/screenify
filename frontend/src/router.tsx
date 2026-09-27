import { LoaderCircle } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router';
import { RoomShell } from './components/room/RoomShell';
import { AppLayout } from './layouts/AppLayout';
import { HomePage } from './pages/HomePage';
import { loadRoomPage } from './pages/load-room-page';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * A sala carrega à parte: mediasoup-client, Socket.IO e a camada de anotação só fazem sentido
 * dentro dela. Quem abre a Home baixa bem menos, e a sala é pré-carregada em segundo plano.
 */
const RoomPage = lazy(() => loadRoomPage().then((module) => ({ default: module.RoomPage })));

function RoomLoading() {
  return (
    <RoomShell>
      <div role="status" className="flex items-center gap-2.5 text-body-sm text-text-secondary">
        <LoaderCircle size={16} className="animate-spin" aria-hidden />
        Carregando a sala…
      </div>
    </RoomShell>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/room/:code',
    element: (
      <Suspense fallback={<RoomLoading />}>
        <RoomPage />
      </Suspense>
    ),
  },
]);