import { isNative } from './server.ts';

/** Android/iOS shell integration: hardware back button and status bar colours. */
export async function setupNative(): Promise<void> {
  if (!isNative()) return;
  document.documentElement.classList.add('native');
  const [{ App }, { StatusBar, Style }] = await Promise.all([import('@capacitor/app'), import('@capacitor/status-bar')]);
  App.addListener('backButton', ({ canGoBack }) => {
    // Close an open sheet first, like the web Escape key.
    const backdrop = document.querySelector<HTMLElement>('.backdrop');
    if (backdrop) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return; }
    if (canGoBack && location.pathname !== '/') history.back();
    else App.exitApp();
  });
  const sync = () => {
    const light = document.documentElement.dataset.theme === 'light';
    StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: getComputedStyle(document.body).backgroundColor.startsWith('rgb') ? toHex(getComputedStyle(document.body).backgroundColor) : '#131416' }).catch(() => {});
  };
  sync();
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

function toHex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m) return '#131416';
  return '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}
