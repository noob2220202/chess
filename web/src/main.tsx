import { createRoot } from 'react-dom/client';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import App from './App.tsx';
import { OnlineProvider } from './lib/online.tsx';
import { RouterProvider } from './lib/router.tsx';
import { SettingsProvider } from './lib/settings.tsx';
import { ToastProvider } from './lib/toast.tsx';
import SettingsModal from './pages/SettingsModal.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <RouterProvider>
    <SettingsProvider renderModal={(close) => <SettingsModal onClose={close} />}>
      <ToastProvider>
        <OnlineProvider>
          <App />
        </OnlineProvider>
      </ToastProvider>
    </SettingsProvider>
  </RouterProvider>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
