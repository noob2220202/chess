import type { CardCategory, CardDef, PieceType } from '@engine';

/** Representative piece drawn on each card's art. */
export const CARD_ICON: Record<string, PieceType> = {
  sprint: 'P', 'knight-king': 'K', trench: 'P', 'royal-guard': 'K', archbishop: 'A', chancellor: 'C', outriders: 'G',
  'phase-bishop': 'B', lancers: 'P', 'wazir-knights': 'N', 'reserve-knight': 'N', 'pawn-shield': 'P', 'iron-rooks': 'R',
  vanguard: 'P', 'guardian-pawns': 'P', 'camel-knights': 'L', 'queen-guard': 'Q', 'bishop-pair': 'B', 'flank-march': 'P',
  'fortified-center': 'R', conscript: 'N', snipe: 'P', aegis: 'R', freeze: 'Q', swap: 'N', retreat: 'Q', ordain: 'A',
  commission: 'C', reinforce: 'P', provoke: 'K', rally: 'P', exchange: 'B', 'cold-snap': 'N', bastion: 'R',
  'royal-escape': 'K', 'fork-master': 'N', 'rook-cannon': 'R', mine: 'P', blink: 'B', disarm: 'Q', 'promotion-drill': 'Q',
  'swift-king': 'K', revive: 'R', push: 'P', intercept: 'P', 'rook-lift': 'R', bodyguard: 'K', 'second-wind': 'K',
  amazon: 'M', 'pawn-storm': 'P', summit: 'K', sanctuary: 'K', 'queen-call': 'Q', stalwart: 'P', haste: 'K',
  liquidate: 'R', 'long-reach': 'K', stasis: 'P', shadow: 'K', 'last-push': 'P',
};

export const CATEGORY_LABEL: Record<CardCategory, string> = { OPENING: '오프닝', MIDDLE: '미들게임', END: '엔드게임' };
export const CATEGORY_HINT: Record<CardCategory, string> = {
  OPENING: '첫 수 전에 고르는 카드',
  MIDDLE: '내 10번째 수에 고르는 카드',
  END: '내 20번째 수에 고르는 카드',
};
export const kindLabel = (d: CardDef) => (d.kind === 'active' ? '액티브' : '패시브');

export function starText(stars: number): string {
  const full = Math.floor(stars), half = stars - full >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '');
}

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
