import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { OnlineProvider } from './lib/online.tsx';
import { RouterProvider } from './lib/router.tsx';
import { ToastProvider } from './lib/toast.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <RouterProvider>
    <ToastProvider>
      <OnlineProvider>
        <App />
      </OnlineProvider>
    </ToastProvider>
  </RouterProvider>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
