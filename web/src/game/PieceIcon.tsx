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

export interface StatusBadge { kind: 'shield' | 'frozen' | 'disarmed'; turns: number; label: string }
const ST_LABEL = { shield: '방패', frozen: '빙결', disarmed: '무장해제' } as const;

/** Active statuses with the number of turns (rounded up) left. */
export function statusBadges(p: Piece, ply: number): StatusBadge[] {
  const out: StatusBadge[] = [];
  for (const kind of ['frozen', 'disarmed', 'shield'] as const) {
    const exp = p.status[kind] ?? 0;
    if (exp > ply) {
      const turns = Math.ceil((exp - ply) / 2);
      out.push({ kind, turns, label: `${ST_LABEL[kind]} ${turns}턴 남음` });
    }
  }
  return out;
}
