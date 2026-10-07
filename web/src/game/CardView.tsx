import { Check, Infinity as InfinityIcon, Zap } from 'lucide-react';
import type { CardDef } from '@engine';
import { CARD_EMBLEMS } from '../assets/cardEmblems.ts';
import { CATEGORY_LABEL } from './cardMeta.ts';

/** Rarity tier from the design star rating. */
export function rarity(stars: number): { tier: 1 | 2 | 3 | 4; label: string } {
  if (stars >= 4.5) return { tier: 4, label: '전설' };
  if (stars >= 3.5) return { tier: 3, label: '영웅' };
  if (stars >= 3) return { tier: 2, label: '희귀' };
  return { tier: 1, label: '일반' };
}

export function Emblem({ id, className }: { id: string; className?: string }) {
  const body = CARD_EMBLEMS[id];
  if (!body) return null;
  return <svg className={className} viewBox="0 0 512 512" fill="currentColor" aria-hidden dangerouslySetInnerHTML={{ __html: body }} />;
}

export interface CardViewProps {
  def: CardDef;
  /** mini: art + name only (hand row). */
  mini?: boolean;
  used?: boolean;
  disabled?: boolean;
  selected?: boolean;
  done?: boolean;
  guide?: boolean;
  /** Small green dot: an active card that can be played now. */
  ready?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function CardView({ def, mini, used, disabled, selected, done, guide, ready, onClick, style }: CardViewProps) {
  const r = rarity(def.stars);
  const cls = ['tcg', `cat-${def.category}`, mini ? 'mini' : '', onClick ? 'clickable' : '', used ? 'used' : '',
    disabled ? 'disabled' : '', selected ? 'selected' : '', guide ? 'guide' : ''].filter(Boolean).join(' ');
  const Tag = onClick ? 'button' : 'div';
  const stars = Number.isInteger(def.stars) ? String(def.stars) : `${Math.floor(def.stars)}½`;
  return (
    <Tag className={cls} onClick={onClick} style={style} type={onClick ? 'button' : undefined}
      aria-label={`${def.name} · ${CATEGORY_LABEL[def.category]} ${def.kind === 'active' ? '액티브' : '패시브'} · ${def.description}`}>
      <div className="t-frame">
      <div className="t-head">
        <span className="t-name">{def.name}</span>
        <span className={`gem r${r.tier}`} title={`${r.label} · ★${def.stars}`}><b>{stars}</b></span>
      </div>
      <div className="t-art"><Emblem id={def.id} className="emblem" /></div>
      <div className="t-type">
        <span>{CATEGORY_LABEL[def.category]}</span>
        <span>{def.kind === 'active' ? <><Zap />액티브</> : <><InfinityIcon />패시브</>}</span>
      </div>
      <div className="t-text"><p>{def.description}</p></div>
      </div>
      {done && <span className="done"><Check strokeWidth={3.5} /></span>}
      {ready && !used && <span className="ready-dot" title="지금 쓸 수 있습니다" />}
    </Tag>
  );
}

/** Compact pill for the in-game hand on phones: emblem + name. */
export function CardChip({ def, used, ready, guide, selected, onClick }: { def: CardDef; used?: boolean; ready?: boolean; guide?: boolean; selected?: boolean; onClick?: () => void }) {
  const cls = ['hchip', `cat-${def.category}`, used ? 'used' : '', ready ? 'ready' : '', guide ? 'guide' : '', selected ? 'selected' : ''].filter(Boolean).join(' ');
  return (
    <button className={cls} onClick={onClick} type="button" title={`${def.name}: ${def.description}`} aria-label={`${def.name}${used ? ' (사용함)' : ready ? ' (지금 쓸 수 있음)' : ''}`}>
      <span className="em"><Emblem id={def.id} /></span>
      <span className="nm">{def.name}</span>
      {def.kind === 'active' ? <Zap className="k" /> : <InfinityIcon className="k" />}
    </button>
  );
}
