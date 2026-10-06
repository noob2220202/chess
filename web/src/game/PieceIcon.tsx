import type { Color, Piece, PieceType } from '@engine';

const BASE: Record<PieceType, 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'> = { P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K', A: 'B', C: 'R', M: 'Q', L: 'N', G: 'P' };
const BADGE_PIECE: Partial<Record<PieceType, 'N'>> = { A: 'N', C: 'N', M: 'N' };
const BADGE_TEXT: Partial<Record<PieceType, string>> = { L: '낙', G: '근' };

export const pieceSrc = (c: Color, t: 'P' | 'N' | 'B' | 'R' | 'Q' | 'K') => `/pieces/${c}${t}.svg`;

export function PieceIcon({ type, color, title }: { type: PieceType; color: Color; title?: string }) {
  const badge = BADGE_PIECE[type], text = BADGE_TEXT[type];
  return (
    <>
      <img src={pieceSrc(color, BASE[type])} alt={title ?? type} draggable={false} />
      {badge && <span className="badge"><img src={pieceSrc(color, badge)} alt="" draggable={false} /></span>}
      {text && <span className="badge txt">{text}</span>}
    </>
  );
}

export function statusClasses(p: Piece, ply: number): string {
  const c: string[] = [];
  if ((p.status.shield ?? 0) > ply) c.push('st-shield');
  if ((p.status.frozen ?? 0) > ply) c.push('st-frozen');
  if ((p.status.disarmed ?? 0) > ply) c.push('st-disarmed');
  return c.join(' ');
}
