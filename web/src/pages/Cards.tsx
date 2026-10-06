import { useEffect, useMemo, useState } from 'react';
import type { CardCategory } from '@engine';
import { CARDS, CARD_ORDER, demoState } from '@engine';
import { CardView } from '../game/CardView.tsx';
import { CATEGORY_HINT, CATEGORY_LABEL, kindLabel, starText } from '../game/cardMeta.ts';
import { api } from '../lib/api.ts';
import { Link, navigate } from '../lib/router.tsx';
import { getProgress, load, markProgress, save } from '../lib/storage.ts';
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
    <div className="main">
      <div className="page-head">
        <div>
          <div className="eyebrow">카드 백과</div>
          <h1>증강 카드 60장</h1>
          <p>카드를 눌러 설명을 읽고, 실제 보드에서 직접 써 보세요. 연습 완료 {done}/60</p>
        </div>
        <Link to="/cards/stats" className="btn sm">카드 통계</Link>
      </div>
      <div className="filters">
        <div className="seg">
          {(['ALL', 'OPENING', 'MIDDLE', 'END'] as Cat[]).map((c) => (
            <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c === 'ALL' ? '전체' : CATEGORY_LABEL[c]}</button>
          ))}
        </div>
        <div className="seg">
          {([['ALL', '모두'], ['active', '액티브'], ['passive', '패시브']] as Array<[Kind, string]>).map(([k, l]) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>
          ))}
        </div>
        <input className="input" style={{ minHeight: 40, flex: '1 1 180px' }} placeholder="카드 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="카드 검색" />
      </div>
      {cat !== 'ALL' && <p className="muted" style={{ marginBottom: 14 }}>{CATEGORY_LABEL[cat]} 카드 · {CATEGORY_HINT[cat]}</p>}
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
  const [doneNow, setDoneNow] = useState(false);
  useEffect(() => { setTrying(false); setDoneNow(false); }, [id]);
  if (!def) return <div className="main"><h1>없는 카드예요</h1><Link to="/cards">카드 백과로</Link></div>;
  const idx = CARD_ORDER.indexOf(id);
  const prev = CARD_ORDER[(idx + CARD_ORDER.length - 1) % CARD_ORDER.length]!, next = CARD_ORDER[(idx + 1) % CARD_ORDER.length]!;
  const prog = getProgress();

  const header = (
    <div className="row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
      <Link to="/cards" className="btn sm ghost">← 카드 백과</Link>
      <div className="grow" />
      <Link to={`/cards/${prev}`} className="btn sm">이전 카드</Link>
      <Link to={`/cards/${next}`} className="btn sm">다음 카드</Link>
    </div>
  );

  if (trying) {
    return (
      <div className="main wide tight">
        {header}
        <DemoPlayer
          key={id}
          spec={{ build: () => demoState(id), text: def.demo.text, done: def.demo.done, goal: def.demo.goal }}
          onComplete={() => { markProgress('demos', id); setDoneNow(true); }}
          footer={(done) => done ? (
            <div className="row wrap">
              <button className="btn sm" onClick={() => setTrying(false)}>설명으로</button>
              <Link to={`/cards/${next}`} className="btn sm primary guide">다음 카드 연습 →</Link>
            </div>
          ) : null}
        />
        {doneNow && <span className="hidden" />}
      </div>
    );
  }

  return (
    <div className="main" style={{ maxWidth: 900 }}>
      {header}
      <div className="row" style={{ alignItems: 'flex-start', gap: 28, flexWrap: 'wrap' }}>
        <div style={{ width: 280, flex: 'none' }}><CardView def={def} big done={prog.demos.includes(id)} /></div>
        <div className="grow stack" style={{ minWidth: 260, gap: 16 }}>
          <div>
            <div className="eyebrow">{CATEGORY_LABEL[def.category]} · {kindLabel(def)} · {starText(def.stars)}</div>
            <h1 style={{ fontSize: 36, marginTop: 6 }}>{def.name}</h1>
          </div>
          <p style={{ fontSize: 18 }}>{def.description}</p>
          {def.detail && <p className="status-line">{def.detail}</p>}
          <div className="feature-list">
            <div className="feature"><b>언제 고르나요?</b><span>{CATEGORY_HINT[def.category]}</span></div>
            <div className="feature"><b>{def.kind === 'active' ? '어떻게 쓰나요?' : '언제 적용되나요?'}</b>
              <span>{def.kind === 'active' ? '내 카드에서 눌러 써요. 차례를 쓰지 않고, 한 게임에 한 번만 쓸 수 있어요.' : '얻은 순간부터 게임이 끝날 때까지 자동으로 적용돼요.'}</span></div>
            <div className="feature"><b>희귀도 {def.stars}</b><span>★이 높을수록 강하고, 드래프트에 드물게 나와요.</span></div>
          </div>
          <div><button className="btn primary lg" onClick={() => setTrying(true)}>직접 해보기</button></div>
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
    <div className="main" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">밸런스</div>
          <h1>카드 통계</h1>
          <p>이번 시즌 레이팅전에서 각 카드를 가진 쪽의 승률이에요. 밸런스를 조정할 때 근거로 써요.</p>
        </div>
        <Link to="/cards" className="btn sm">카드 백과</Link>
      </div>
      {err && <p className="error-text">{err}</p>}
      {!rows && !err && <div className="spinner" />}
      {rows && (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>카드</th><th className="num">★</th><th className="num">판수</th><th className="num">승률</th></tr></thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/cards/${r.id}`}>{r.name}</Link></td>
                  <td className="num">{r.stars}</td>
                  <td className="num">{r.games}</td>
                  <td className="num">{r.winRate === null ? '—' : `${(r.winRate * 100).toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
