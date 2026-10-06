import type { CardDef } from '@engine';
import { CATEGORY_LABEL, CARD_ICON, hash, kindLabel, starText } from './cardMeta.ts';
import { pieceSrc } from './PieceIcon.tsx';

const BASE = { P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K', A: 'B', C: 'R', M: 'Q', L: 'N', G: 'P' } as const;

/** Deterministic geometric art for a card. */
export function CardArt({ def }: { def: CardDef }) {
  const h = hash(def.id);
  const icon = BASE[CARD_ICON[def.id] ?? 'P'];
  const shapes = [];
  for (let i = 0; i < 6; i++) {
    const x = (h >>> (i * 3)) % 160, y = (h >>> (i * 2 + 5)) % 100, r = 10 + ((h >>> (i + 7)) % 34);
    const kind = (h >>> (i * 5)) % 3;
    if (kind === 0) shapes.push(<circle key={i} cx={x} cy={y} r={r} fill="rgba(255,255,255,0.13)" />);
    else if (kind === 1) shapes.push(<rect key={i} x={x - r / 2} y={y - r / 2} width={r} height={r} rx={4} transform={`rotate(${(h >>> i) % 90} ${x} ${y})`} fill="rgba(0,0,0,0.12)" />);
    else shapes.push(<path key={i} d={`M${x} ${y - r}L${x + r} ${y + r}L${x - r} ${y + r}Z`} fill="rgba(255,255,255,0.09)" />);
  }
  const grid = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) grid.push(<rect key={`${i}-${j}`} x={100 + i * 12} y={18 + j * 12} width={12} height={12} fill="rgba(0,0,0,0.1)" />);
  return (
    <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {shapes}
      {grid}
      <circle cx={80} cy={56} r={34} fill="rgba(255,255,255,0.88)" stroke="#17191b" strokeWidth={3} />
      <image href={pieceSrc('w', icon)} x={52} y={28} width={56} height={56} />
      {['A', 'C', 'M'].includes(CARD_ICON[def.id] ?? '') && (
        <g><circle cx={104} cy={78} r={12} fill="#fbfaf6" stroke="#17191b" strokeWidth={2.5} />
          <image href={pieceSrc('w', 'N')} x={94} y={68} width={20} height={20} /></g>
      )}
      {['L', 'G'].includes(CARD_ICON[def.id] ?? '') && (
        <g><circle cx={104} cy={78} r={12} fill="#fbfaf6" stroke="#17191b" strokeWidth={2.5} />
          <text x={104} y={83} textAnchor="middle" fontSize={13} fontWeight={900} fill="#17191b">{CARD_ICON[def.id] === 'L' ? '낙' : '근'}</text></g>
      )}
    </svg>
  );
}

export interface CardViewProps {
  def: CardDef;
  compact?: boolean;
  big?: boolean;
  used?: boolean;
  disabled?: boolean;
  selected?: boolean;
  done?: boolean;
  guide?: boolean;
  onClick?: () => void;
  footer?: React.ReactNode;
}

export function CardView({ def, compact, big, used, disabled, selected, done, guide, onClick, footer }: CardViewProps) {
  const cls = ['gcard', `cat-${def.category}`, compact ? 'compact' : '', big ? 'big' : '', onClick ? 'clickable' : '',
    used ? 'used' : '', disabled ? 'disabled' : '', selected ? 'selected' : '', guide ? 'guide' : ''].filter(Boolean).join(' ');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={cls} onClick={onClick} type={onClick ? 'button' : undefined} aria-label={onClick ? `${def.name}: ${def.description}` : undefined}>
      <div className="art">
        <CardArt def={def} />
        <span className="chip kind">{kindLabel(def)}</span>
        <span className="stars" title={`희귀도 ${def.stars}`}>{starText(def.stars)}</span>
      </div>
      <div className="body">
        <span className="cat-tag">{CATEGORY_LABEL[def.category]}</span>
        <span className="name">{def.name}</span>
        <span className="desc">{def.description}</span>
        {footer}
      </div>
      {done && <span className="done-mark" title="연습 완료">✓</span>}
    </Tag>
  );
}
