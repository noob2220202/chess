import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Bot, ChevronRight, Circle, CircleCheck, Flag, Lightbulb, LogOut, Play, Trash2, Undo2 } from 'lucide-react';
import type { BotDecision, BotLevel, CardId, Color, GameState, Move, Square } from '@engine';
import { CARDS } from '@engine';
import { applyMove, newGame, pickCard, playCard } from '@engine';
import { askBot } from '../bot/client.ts';
import { GameScreen, REASON_TEXT, type GameResult, type MenuItem } from '../game/GameScreen.tsx';
import { applyAct, startEntry, type Act, type HistEntry } from '../game/history.ts';
import { navigate } from '../lib/router.tsx';
import { load, remove, save } from '../lib/storage.ts';
import { useToast } from '../lib/toast.tsx';

type Kind = 'ai' | 'local';
interface Settings { level: BotLevel; color: Color | 'random'; mirror: boolean }
interface Saved { kind: Kind; settings: Settings; human: Color; initial: GameState; actions: Act[]; /** Unique per game, so "one more game" always starts fresh. */ id?: number }

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
    // v2: AI games default to different cards per side (more variety); rated play keeps the mirror draft.
    const s = load(`aa.settings.v2.${kind}`, { level: 2 as BotLevel, color: 'w' as Color | 'random', mirror: false });
    const lv = Number(params.get('level'));
    return lv >= 1 && lv <= 3 ? { ...s, level: lv as BotLevel } : s;
  });
  const [game, setGame] = useState<Saved | null>(null);

  const start = useCallback((st: Settings) => {
    save(`aa.settings.v2.${kind}`, st);
    const human: Color = kind === 'local' ? 'w' : st.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : st.color;
    setGame({ kind, settings: st, human, initial: newGame({ mirror: st.mirror }), actions: [], id: Date.now() });
  }, [kind]);

  useEffect(() => {
    setGame(null);
    setSaved(load<Saved | null>(KEY(kind), null));
    if (params.get('start') === '1') { history.replaceState(null, '', location.pathname); start(settings); }
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (game) return <OfflineGame key={game.id ?? `${game.initial.board.map((p) => p?.id ?? 0).join('')}-${game.human}`} initial={game} onExit={() => { setGame(null); setSaved(load<Saved | null>(KEY(kind), null)); }} onRestart={() => start(settings)} />;

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
  /** Bumped on undo so a bot reply computed for the old position is dropped. */
  const gen = useRef(0);
  const [hint, setHint] = useState<{ move?: Move; card?: CardId } | null>(null);
  const [hinting, setHinting] = useState(false);
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
    // A played card keeps the move half of a hint; anything else clears it.
    setHint((h) => (h && list.every((a) => a.t === 'card') ? { move: h.move } : null));
  }, [toast]);

  const undo = () => {
    gen.current++;
    busy.current = false;
    setThinking(false);
    setHint(null);
    const acts = [...actions];
    // Against the AI, take back the AI's reply and your own last turn; locally, the last turn.
    if (botColor) while (acts.length && acts[acts.length - 1]!.c === botColor) acts.pop();
    const c = acts[acts.length - 1]?.c;
    if (!c) return;
    while (acts.length && acts[acts.length - 1]!.c === c) acts.pop();
    const h = replay({ ...g, actions: acts });
    histRef.current = h;
    setHist(h);
    setActions(acts);
  };

  const askHint = () => {
    if (hinting) return;
    setHinting(true);
    askBot(s, 3).then((d: BotDecision) => {
      setHinting(false);
      if (d.kind === 'pick') { toast(`추천 카드: ${CARDS[d.id]?.name ?? d.id}`); return; }
      setHint({ move: d.move, card: d.card?.id });
      if (d.card) toast(`추천: “${CARDS[d.card.id]?.name}” 카드를 쓴 뒤 표시된 수를 두세요.`);
    }).catch(() => setHinting(false));
  };

  const onPick = (id: CardId) => act([{ t: 'pick', c: s.turn, id }]);
  const onCard = (id: CardId, sel: Square[]) => act([{ t: 'card', c: s.turn, id, sel }]);
  const onMove = (move: Move) => act([{ t: 'move', c: s.turn, move }]);

  useEffect(() => {
    if (!botColor || s.winner || s.turn !== botColor || busy.current) return;
    busy.current = true;
    setThinking(true);
    const started = Date.now();
    const my = gen.current;
    askBot(s, g.settings.level).then((d) => {
      setTimeout(() => {
        if (gen.current !== my) return; // the position was taken back meanwhile
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
  const myTurn = !s.winner && actor !== null;
  const tools: MenuItem[] = [
    { label: '무르기', icon: <Undo2 />, onClick: undo, disabled: !actions.some((a) => g.kind === 'local' || a.c === g.human) },
    ...(s.winner ? [] : [{ label: hinting ? '생각 중' : '힌트', icon: <Lightbulb />, onClick: askHint, disabled: !myTurn || hinting }]),
  ];
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
        tools={tools}
        guide={hint?.move && !hint.card ? { squares: [hint.move.from, hint.move.to], label: '추천 수' } : null}
        guideCard={hint?.card ?? null}
        menu={menu}
        title={g.kind === 'ai' ? `AI ${levelName}` : '로컬 2인'}
        onBack={onExit}
      />
    </div>
  );
}
