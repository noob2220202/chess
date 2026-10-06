import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Play, Search } from 'lucide-react';
import type { CardCategory } from '@engine';
import { CARDS, CARD_ORDER, demoState } from '@engine';
import { CardView, rarity } from '../game/CardView.tsx';
import { CATEGORY_HINT, CATEGORY_LABEL } from '../game/cardMeta.ts';
import { api } from '../lib/api.ts';
import { Link, navigate } from '../lib/router.tsx';
import { getProgress, load, markProgress, save } from '../lib/storage.ts';
import { useIsMobile } from '../lib/ui.tsx';
import { DemoPlayer } from '../tutorial/DemoPlayer.tsx';

type Cat = CardCategory | 'ALL';
type Kind = 'ALL' | 'active' | 'passive';

export function CardsIndex() {
  const [cat, setCat] = useState<Cat>(() => load('aa.cards.cat', 'ALL' as Cat));
  const [kind, setKind] = useState<Kind>('ALL');
  const [q, setQ] = useState('');
  const prog = getProgress();
  useEffect(() => save('aa.cards.cat', cat), [cat]);
  const list = useMemo(() => CARD_ORDER.map((id) => CARDS[id]!).filter((c) =>
    (cat === 'ALL' || c.category === cat) && (kind === 'ALL' || c.kind === kind) &&
    (!q || c.name.includes(q) || c.description.includes(q))), [cat, kind, q]);
  const done = CARD_ORDER.filter((id) => prog.demos.includes(id)).length;

  return (
    <div className="page">
      <div className="head">
        <div className="row between top">
          <div>
            <div className="eyebrow">카드 백과 · 연습 {done}/60</div>
            <h1>증강 카드</h1>
          </div>
          <Link to="/cards/stats" className="btn sm"><BarChart3 />통계</Link>
        </div>
        <p>카드를 눌러 자세히 보고, 실제 보드에서 직접 써 보세요.</p>
      </div>
      <div className="search"><Search /><input className="input" placeholder="카드 이름이나 효과로 찾기" value={q} onChange={(e) => setQ(e.target.value)} aria-label="카드 검색" /></div>
      <div className="filters">
        {(['ALL', 'OPENING', 'MIDDLE', 'END'] as Cat[]).map((c) => (
          <button key={c} className={`fchip${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c === 'ALL' ? '전체' : CATEGORY_LABEL[c]}</button>
        ))}
        <span style={{ width: 6, flex: 'none' }} />
        {([['ALL', '모든 종류'], ['active', '액티브'], ['passive', '패시브']] as Array<[Kind, string]>).map(([k, l]) => (
          <button key={k} className={`fchip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      {cat !== 'ALL' && <p className="muted" style={{ marginBottom: 14, fontSize: 14 }}>{CATEGORY_HINT[cat]}</p>}
      <div className="card-grid">
        {list.map((c) => <CardView key={c.id} def={c} done={prog.demos.includes(c.id)} onClick={() => navigate(`/cards/${c.id}`)} />)}
      </div>
      {list.length === 0 && <p className="muted center" style={{ padding: 40 }}>조건에 맞는 카드가 없어요.</p>}
    </div>
  );
}

export function CardPage({ id }: { id: string }) {
  const def = CARDS[id];
  const [trying, setTrying] = useState(false);
  const [, setDone] = useState(false);
  const mobile = useIsMobile();
  useEffect(() => { setTrying(false); setDone(false); }, [id]);
  if (!def) return <div className="page"><h1>없는 카드예요</h1><Link to="/cards">카드 백과로</Link></div>;
  const idx = CARD_ORDER.indexOf(id);
  const prev = CARD_ORDER[(idx + CARD_ORDER.length - 1) % CARD_ORDER.length]!, next = CARD_ORDER[(idx + 1) % CARD_ORDER.length]!;
  const prog = getProgress();
  const r = rarity(def.stars);

  if (trying) {
    return (
      <div className="page wide tight">
        {!mobile && (
          <div className="row between" style={{ marginBottom: 14 }}>
            <button className="backlink" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setTrying(false)}><ChevronLeft />{def.name} 설명</button>
            <Link to={`/cards/${next}`} className="btn sm">다음 카드<ChevronRight /></Link>
          </div>
        )}
        <DemoPlayer
          key={id}
          spec={{ build: () => demoState(id), text: def.demo.text, done: def.demo.done, goal: def.demo.goal }}
          onComplete={() => { markProgress('demos', id); setDone(true); }}
          title={`${def.name} 연습`}
          onBack={() => setTrying(false)}
          footer={(done) => done ? (
            <div className="row wrap">
              <button className="btn sm" onClick={() => setTrying(false)}>설명으로</button>
              <Link to={`/cards/${next}`} className="btn sm primary guide">다음 카드 연습<ChevronRight /></Link>
            </div>
          ) : null}
        />
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="row between" style={{ marginBottom: 14 }}>
        <Link to="/cards" className="backlink"><ChevronLeft />카드 백과</Link>
        <div className="row" style={{ gap: 4 }}>
          <Link to={`/cards/${prev}`} className="icon-btn" aria-label="이전 카드"><ChevronLeft /></Link>
          <Link to={`/cards/${next}`} className="icon-btn" aria-label="다음 카드"><ChevronRight /></Link>
        </div>
      </div>
      <div className="row top wrap" style={{ gap: 28 }}>
        <div style={{ width: mobile ? '64%' : 280, margin: mobile ? '0 auto' : undefined, flex: 'none' }}><CardView def={def} done={prog.demos.includes(id)} /></div>
        <div className="grow stack" style={{ minWidth: 260, gap: 14 }}>
          <div>
            <div className="eyebrow">{CATEGORY_LABEL[def.category]} · {def.kind === 'active' ? '액티브' : '패시브'} · {r.label}</div>
            <h1 style={{ fontSize: 34, fontWeight: 850, marginTop: 4 }}>{def.name}</h1>
          </div>
          <p style={{ fontSize: 17.5, lineHeight: 1.65 }}>{def.description}</p>
          {def.detail && <p className="muted">{def.detail}</p>}
          <div className="list" style={{ marginTop: 4 }}>
            <div className="kv"><span className="muted">고르는 때</span><span>{CATEGORY_HINT[def.category]}</span></div>
            <div className="kv"><span className="muted">사용 방식</span><span style={{ textAlign: 'right' }}>{def.kind === 'active' ? '한 번 사용 · 차례를 쓰지 않음' : '얻은 순간부터 계속 적용'}</span></div>
            {def.targets && def.targets.length > 0 && <div className="kv"><span className="muted">고를 대상</span><span style={{ textAlign: 'right' }}>{def.targets.length}곳</span></div>}
            <div className="kv"><span className="muted">희귀도</span><span>{r.label} · ★{def.stars}</span></div>
          </div>
          <button className="btn primary lg block" onClick={() => setTrying(true)}><Play />보드에서 직접 해보기</button>
        </div>
      </div>
    </div>
  );
}

interface StatRow { id: string; name: string; stars: number; games: number; winRate: number | null }
export function CardStats() {
  const [rows, setRows] = useState<StatRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<{ cards: StatRow[] }>('/api/cards/stats').then((r) => setRows(r.cards)).catch((e) => setErr(e.message)); }, []);
  const sorted = rows ? [...rows].sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1)) : [];
  return (
    <div className="page narrow">
      <Link to="/cards" className="backlink"><ChevronLeft />카드 백과</Link>
      <div className="head" style={{ marginTop: 6 }}>
        <h1>카드 통계</h1>
        <p>이번 시즌 레이팅전에서 각 카드를 가진 쪽의 승률이에요. 밸런스를 조정하는 근거가 돼요.</p>
      </div>
      {err && <p className="error-text">{err}</p>}
      {!rows && !err && <div className="spinner" />}
      {rows && (
        <div className="list">
          {sorted.map((r) => (
            <button key={r.id} className="list-row" onClick={() => navigate(`/cards/${r.id}`)}>
              <span style={{ width: 44, flex: 'none' }}><CardView def={CARDS[r.id]!} mini /></span>
              <span className="grow"><b>{r.name}</b><small>{r.games}판</small></span>
              <b className="mono" style={{ color: r.winRate === null ? 'var(--muted)' : r.winRate >= 0.5 ? 'var(--good)' : 'var(--bad)' }}>
                {r.winRate === null ? '—' : `${(r.winRate * 100).toFixed(1)}%`}
              </b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
