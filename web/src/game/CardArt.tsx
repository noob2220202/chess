import { CARD_ART, type CardArt as Art } from '../assets/cardArt.ts';

const BASE: Record<string, string> = { P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K', A: 'B', C: 'R', M: 'Q', L: 'N', G: 'P' };
const BADGE: Record<string, string> = { A: 'N', C: 'N', M: 'N' };
const LETTER: Record<string, string> = { L: '낙', G: '근' };

export const hasCardArt = (id: string): boolean => !!CARD_ART[id];

/** Mini board diagram of what a card does (generated from its demo). */
export function CardArt({ id }: { id: string }) {
  const a: Art | undefined = CARD_ART[id];
  if (!a) return null;
  const n = a.n;
  // SVG y grows downwards; rank 0 is the bottom row.
  const Y = (rank: number) => n - 1 - rank;
  const c = (v: number) => v + 0.5;
  const uid = `ca-${id}`;
  return (
    <svg className="card-art" viewBox={`-0.06 -0.06 ${n + 0.12} ${n + 0.12}`} aria-hidden>
      <defs>
        <marker id={`${uid}-h`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--art-arrow)" />
        </marker>
        <marker id={`${uid}-hc`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--art-card)" />
        </marker>
      </defs>
      <rect x="-0.06" y="-0.06" width={n + 0.12} height={n + 0.12} rx="0.22" className="ca-frame" />
      {Array.from({ length: n * n }, (_, i) => {
        const x = i % n, y = Math.floor(i / n);
        const light = ((x + (n - 1 - y)) % 2 === 0) === a.light;
        return <rect key={i} x={x} y={y} width="1" height="1" className={light ? 'ca-l' : 'ca-d'} />;
      })}
      {a.marks.map(([x, r, k], i) => {
        const y = Y(r);
        if (k === 'zone') return <rect key={i} x={x + 0.08} y={y + 0.08} width="0.84" height="0.84" rx="0.12" className="ca-zone" />;
        if (k === 'frozen') return <rect key={i} x={x} y={y} width="1" height="1" className="ca-frozen" />;
        if (k === 'target') return <circle key={i} cx={c(x)} cy={c(y)} r="0.44" className="ca-target" />;
        if (k === 'shield') return <circle key={i} cx={c(x)} cy={c(y)} r="0.46" className="ca-shield" />;
        if (k === 'new' || k === 'promote') return <circle key={i} cx={c(x)} cy={c(y)} r="0.46" className="ca-new" />;
        return null;
      })}
      {a.pieces.map(([x, r, t, flag], i) => {
        const y = Y(r), color = t[0]!, type = t[1]!;
        return (
          <g key={i} className={flag === 'gone' ? 'ca-gone' : flag ? `ca-${flag}` : undefined}>
            <image href={`/pieces/${color}${BASE[type]}.svg`} x={x + 0.04} y={y + 0.04} width="0.92" height="0.92" />
            {BADGE[type] && <image href={`/pieces/${color}${BADGE[type]}.svg`} x={x + 0.52} y={y + 0.52} width="0.46" height="0.46" className="ca-badge" />}
            {LETTER[type] && (
              <g>
                <circle cx={x + 0.78} cy={y + 0.78} r="0.2" className="ca-letter-bg" />
                <text x={x + 0.78} y={y + 0.86} className="ca-letter">{LETTER[type]}</text>
              </g>
            )}
          </g>
        );
      })}
      {a.marks.map(([x, r, k], i) => {
        const y = Y(r);
        if (k === 'gone') return <path key={i} d={`M${x + 0.22} ${y + 0.22} L${x + 0.78} ${y + 0.78} M${x + 0.78} ${y + 0.22} L${x + 0.22} ${y + 0.78}`} className="ca-x" />;
        if (k === 'disarmed') return <path key={i} d={`M${x + 0.15} ${y + 0.85} L${x + 0.85} ${y + 0.15}`} className="ca-x" />;
        return null;
      })}
      {a.arrows.map(([x1, r1, x2, r2, kind], i) => {
        const ax = c(x1), ay = c(Y(r1)), bx = c(x2), by = c(Y(r2));
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const ex = bx - ((bx - ax) / len) * 0.32, ey = by - ((by - ay) / len) * 0.32;
        return (
          <line key={i} x1={ax} y1={ay} x2={ex} y2={ey} className={kind === 'card' ? 'ca-arrow card' : 'ca-arrow'}
            markerEnd={`url(#${uid}-${kind === 'card' ? 'hc' : 'h'})`} />
        );
      })}
    </svg>
  );
}
