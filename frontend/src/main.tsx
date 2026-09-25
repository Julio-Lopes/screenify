import { LucideProvider } from 'lucide-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { Toaster } from './components/ui/Toaster';
import './index.css';
import { router } from './router';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root não encontrado no index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <LucideProvider size={16} strokeWidth={1.75}>
      <RouterProvider router={router} />
      <Toaster />
    </LucideProvider>
  </StrictMode>,
);