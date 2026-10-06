import type { CardId, Color, GameState, Move, Square } from '@engine';
import { CARDS, PIECE_NAME, captureSquare, squareName } from '@engine';

const side = (c: Color) => (c === 'w' ? '백' : '흑');

export function describeMove(s: GameState, m: Move): string {
  const p = s.board[m.from];
  const cs = captureSquare(s, m);
  const cap = cs >= 0 ? s.board[cs] : null;
  const name = p ? PIECE_NAME[p.type] : '';
  if (m.castle) return `${side(s.turn)}: 캐슬링 (${m.castle === 'K' ? '킹 쪽' : '퀸 쪽'})`;
  let t = `${side(s.turn)}: ${name} ${squareName(m.from)}→${squareName(m.to)}`;
  if (cap) t += ` · ${PIECE_NAME[cap.type]} 포획`;
  if (m.promotion) t += ` · ${PIECE_NAME[m.promotion]} 승진`;
  return t;
}
export const describePick = (c: Color, id: CardId) => `${side(c)}: 카드 선택 — ${CARDS[id]?.name ?? id}`;
export const describeCard = (c: Color, id: CardId, sel: Square[]) =>
  `${side(c)}: ${CARDS[id]?.name ?? id} 사용${sel.length ? ` (${sel.map(squareName).join(', ')})` : ''}`;
