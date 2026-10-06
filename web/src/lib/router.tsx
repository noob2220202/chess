import { createContext, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

const RouteCtx = createContext<string>('/');

export function navigate(to: string, replace = false): void {
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0 });
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  return <RouteCtx.Provider value={path}>{children}</RouteCtx.Provider>;
}

export const usePath = () => useContext(RouteCtx);

/** Match "/cards/:id" style patterns. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean), b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(':')) out[a[i]!.slice(1)] = decodeURIComponent(b[i]!);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}

export function Link({ to, children, className, activeClass, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; activeClass?: string }) {
  const path = usePath();
  const active = activeClass && (to === '/' ? path === '/' : path.startsWith(to));
  return (
    <a
      href={to}
      className={[className, active ? activeClass : ''].filter(Boolean).join(' ') || undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
