import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bot, ChevronRight, Circle, CircleCheck, Flag, LogOut, Play, Trash2 } from 'lucide-react';
import type { BotLevel, CardId, Color, GameState, Move, Square } from '@engine';
import { applyMove, newGame, pickCard, playCard } from '@engine';
import { askBot } from '../bot/client.ts';
import { GameScreen, REASON_TEXT, type GameResult, type MenuItem } from '../game/GameScreen.tsx';
import { applyAct, startEntry, type Act, type HistEntry } from '../game/history.ts';
import { navigate } from '../lib/router.tsx';
import { load, remove, save } from '../lib/storage.ts';
import { useToast } from '../lib/toast.tsx';

type Kind = 'ai' | 'local';
interface Settings { level: BotLevel; color: Color | 'random'; mirror: boolean }
interface Saved { kind: Kind; settings: Settings; human: Color; initial: GameState; actions: Act[] }

const ENGINE = { pickCard, playCard, applyMove };
export const LEVELS: Array<[BotLevel, string, string]> = [[1, '입문', '실수가 잦은 상대'], [2, '보통', '기본 전술을 아는 상대'], [3, '고수', '세 수 앞을 읽는 상대']];
const KEY = (k: Kind) => `aa.offline.v2.${k}`;

function replay(saved: Saved): HistEntry[] {
  let h = [startEntry(saved.initial)];
  for (const a of saved.actions) {
    try { h = applyAct(h, a, ENGINE); } catch { break; }
  }
  return h;
}

export default function PlayOffline({ kind }: { kind: Kind }) {
  const params = new URLSearchParams(location.search);
  const [saved, setSaved] = useState<Saved | null>(() => load<Saved | null>(KEY(kind), null));
  const [settings, setSettings] = useState<Settings>(() => {
    const s = load(`aa.settings.${kind}`, { level: 2 as BotLevel, color: 'w' as Color | 'random', mirror: true });
    const lv = Number(params.get('level'));
    return lv >= 1 && lv <= 3 ? { ...s, level: lv as BotLevel } : s;
  });
  const [game, setGame] = useState<Saved | null>(null);

  const start = useCallback((st: Settings) => {
    save(`aa.settings.${kind}`, st);
    const human: Color = kind === 'local' ? 'w' : st.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : st.color;
    setGame({ kind, settings: st, human, initial: newGame({ mirror: st.mirror }), actions: [] });
  }, [kind]);

  useEffect(() => {
    setGame(null);
    setSaved(load<Saved | null>(KEY(kind), null));
    if (params.get('start') === '1') { history.replaceState(null, '', location.pathname); start(settings); }
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (game) return <OfflineGame key={`${game.initial.board.map((p) => p?.id ?? 0).join('')}-${game.human}`} initial={game} onExit={() => { setGame(null); setSaved(load<Saved | null>(KEY(kind), null)); }} onRestart={() => start(settings)} />;

  const LV_IC = ['teal', 'blue', 'violet'];
  return (
    <div className="page narrow">
      <div className="head">
        <div className="eyebrow">{kind === 'ai' ? '혼자 연습하기' : '한 기기에서 둘이서'}</div>
        <h1>{kind === 'ai' ? 'AI 대전' : '로컬 2인 대전'}</h1>
        <p>{kind === 'ai' ? '인터넷 없이도 둘 수 있습니다. 레이팅에는 반영되지 않습니다.' : '한 화면에서 번갈아 두는 친선전입니다.'}</p>
      </div>
      {saved && (
        <div className="list" style={{ marginBottom: 22 }}>
          <button className="list-row" onClick={() => setGame(saved)}>
            <span className="ic amber"><Play /></span>
            <span className="grow"><b>이어서 두기</b><small>{saved.actions.length}개의 기록이 저장돼 있습니다</small></span>
            <ChevronRight className="chev" />
          </button>
          <button className="list-row" onClick={() => { remove(KEY(kind)); setSaved(null); }}>
            <span className="ic slate"><Trash2 /></span>
            <span className="grow"><b>저장된 대국 지우기</b></span>
          </button>
        </div>
      )}
      {kind === 'ai' && (
        <>
          <div className="section-h" style={{ marginTop: 0 }}><h2>난이도</h2></div>
          <div className="list">
            {LEVELS.map(([lv, name, hint], i) => (
              <button key={lv} className="list-row" onClick={() => setSettings({ ...settings, level: lv })} aria-pressed={settings.level === lv}>
                <span className={`ic ${LV_IC[i]}`}><Bot /></span>
                <span className="grow"><b>{name}</b><small>{hint}</small></span>
                {settings.level === lv ? <CircleCheck className="chev" style={{ color: 'var(--accent)' }} /> : <Circle className="chev" />}
              </button>
            ))}
          </div>
          <div className="section-h"><h2>내 색</h2></div>
          <div className="seg">
            {([['w', '백 (먼저 둠)'], ['b', '흑'], ['random', '무작위']] as const).map(([c, l]) => (
              <button key={c} className={settings.color === c ? 'on' : ''} onClick={() => setSettings({ ...settings, color: c })}>{l}</button>
            ))}
          </div>
        </>
      )}
      <div className="section-h" style={kind === 'ai' ? undefined : { marginTop: 0 }}><h2>드래프트 방식</h2></div>
      <div className="seg">
        <button className={settings.mirror ? 'on' : ''} onClick={() => setSettings({ ...settings, mirror: true })}>같은 카드 (레이팅전 방식)</button>
        <button className={!settings.mirror ? 'on' : ''} onClick={() => setSettings({ ...settings, mirror: false })}>각자 다른 카드</button>
      </div>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{settings.mirror ? '두 사람이 매번 같은 카드 3장 중에서 고릅니다.' : '두 사람이 서로 다른 카드 3장을 제시받습니다.'}</p>
      <div style={{ marginTop: 28 }}><button className="btn primary lg block" onClick={() => start(settings)}>새 대국 시작</button></div>
    </div>
  );
}

function OfflineGame({ initial, onExit, onRestart }: { initial: Saved; onExit: () => void; onRestart: () => void }) {
  const [actions, setActions] = useState<Act[]>(initial.actions);
  const [hist, setHist] = useState<HistEntry[]>(() => replay(initial));
  const [thinking, setThinking] = useState(false);
  const toast = useToast();
  const g = initial;
  const botColor: Color | null = g.kind === 'ai' ? (g.human === 'w' ? 'b' : 'w') : null;
  const busy = useRef(false);
  const s = hist[hist.length - 1]!.state;

  useEffect(() => {
    if (s.winner) remove(KEY(g.kind));
    else save(KEY(g.kind), { ...g, actions });
  }, [actions, s.winner]); // eslint-disable-line react-hooks/exhaustive-deps

  const histRef = useRef(hist);
  histRef.current = hist;
  const act = useCallback((list: Act[]) => {
    let next = histRef.current;
    try { for (const a of list) next = applyAct(next, a, ENGINE); } catch (e) { toast((e as Error).message, 'error'); return; }
    histRef.current = next;
    setHist(next);
    setActions((xs) => [...xs, ...list]);
  }, [toast]);

  const onPick = (id: CardId) => act([{ t: 'pick', c: s.turn, id }]);
  const onCard = (id: CardId, sel: Square[]) => act([{ t: 'card', c: s.turn, id, sel }]);
  const onMove = (move: Move) => act([{ t: 'move', c: s.turn, move }]);

  useEffect(() => {
    if (!botColor || s.winner || s.turn !== botColor || busy.current) return;
    busy.current = true;
    setThinking(true);
    const started = Date.now();
    askBot(s, g.settings.level).then((d) => {
      setTimeout(() => {
        busy.current = false;
        setThinking(false);
        if (d.kind === 'pick') act([{ t: 'pick', c: botColor, id: d.id }]);
        else act([...(d.card ? [{ t: 'card', c: botColor, id: d.card.id, sel: d.card.sel } as Act] : []), { t: 'move', c: botColor, move: d.move }]);
      }, Math.max(0, 420 - (Date.now() - started)));
    }).catch((e) => { busy.current = false; setThinking(false); toast(`AI 오류: ${e.message}`, 'error'); });
  }, [hist, botColor]); // eslint-disable-line react-hooks/exhaustive-deps

  const actor: Color | null = s.winner ? null : g.kind === 'local' ? s.turn : s.turn === g.human ? g.human : null;
  const levelName = LEVELS[g.settings.level - 1]![1];
  const players = useMemo(() => (g.kind === 'ai'
    ? { [g.human]: { name: '나' }, [botColor!]: { name: `AI ${levelName}`, sub: thinking ? '생각 중…' : undefined } } as Record<Color, { name: string; sub?: string }>
    : { w: { name: '백' }, b: { name: '흑' } }), [g, botColor, levelName, thinking]);

  let result: GameResult | null = null;
  if (s.winner) {
    const outcome = s.winner === 'draw' ? 'draw' : g.kind === 'local' || s.winner === g.human ? 'win' : 'lose';
    const title = s.winner === 'draw' ? '무승부' : g.kind === 'local' ? `${s.winner === 'w' ? '백' : '흑'} 승리` : s.winner === g.human ? '승리' : '패배';
    result = {
      outcome, title, reason: REASON_TEXT[s.endReason ?? 'end'] ?? '',
      actions: <>
        <button className="btn lg" onClick={onExit}>설정 바꾸기</button>
        <button className="btn lg primary" onClick={onRestart}>한 판 더</button>
      </>,
    };
  }

  const resign = () => {
    if (!confirm('기권하시겠습니까?')) return;
    setHist((h) => {
      const last = h[h.length - 1]!;
      const st = { ...last.state, winner: (g.kind === 'local' ? (last.state.turn === 'w' ? 'b' : 'w') : botColor!) as Color, endReason: 'resign' as const };
      return [...h.slice(0, -1), { ...last, state: st }];
    });
  };
  const menu: MenuItem[] = [
    ...(s.winner ? [] : [{ label: '기권', icon: <Flag />, onClick: resign, danger: true }]),
    { label: '카드 백과', icon: <BookOpen />, onClick: () => navigate('/cards') },
    { label: '나가기', icon: <LogOut />, onClick: onExit },
  ];

  const status = s.winner ? null : actor ? (g.kind === 'local' ? <div className="notice attn">{`${s.turn === 'w' ? '백' : '흑'} 차례입니다.`}</div> : null) : (
    <div className="notice"><span className="spinner" /> AI 생각 중…</div>
  );

  return (
    <div className="page wide">
      <GameScreen
        history={hist}
        orientation={g.kind === 'local' ? 'w' : g.human}
        actor={actor}
        self={g.kind === 'ai' ? g.human : null}
        players={players}
        onPick={onPick}
        onCard={onCard}
        onMove={onMove}
        status={status}
        result={result}
        menu={menu}
        title={g.kind === 'ai' ? `AI ${levelName}` : '로컬 2인'}
        onBack={onExit}
      />
    </div>
  );
}
