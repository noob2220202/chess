import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BotLevel, CardId, Color, GameState, Move, Square } from '@engine';
import { applyMove, newGame, pickCard, playCard } from '@engine';
import { askBot } from '../bot/client.ts';
import { GameScreen, REASON_TEXT, ResultModal } from '../game/GameScreen.tsx';
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

  return (
    <div className="main narrow">
      <div className="page-head">
        <div>
          <div className="eyebrow">{kind === 'ai' ? '혼자 연습하기' : '한 기기에서 둘이서'}</div>
          <h1>{kind === 'ai' ? 'AI 대전' : '로컬 2인 대전'}</h1>
          <p>{kind === 'ai' ? '인터넷 없이도 둘 수 있어요. 레이팅에는 반영되지 않아요.' : '한 화면에서 번갈아 두는 친선전이에요.'}</p>
        </div>
      </div>
      {saved && (
        <div className="panel pad row" style={{ marginBottom: 16 }}>
          <div className="grow"><b>이어서 둘 대국이 있어요</b><div className="muted" style={{ fontSize: 13.5 }}>{saved.actions.length}개의 기록</div></div>
          <button className="btn ghost" onClick={() => { remove(KEY(kind)); setSaved(null); }}>지우기</button>
          <button className="btn primary" onClick={() => setGame(saved)}>이어하기</button>
        </div>
      )}
      <div className="panel pad stack" style={{ gap: 22 }}>
        {kind === 'ai' && (
          <>
            <div className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">난이도</span>
              <div className="quick-grid">
                {LEVELS.map(([lv, name, hint]) => (
                  <button key={lv} className={`quick${settings.level === lv ? ' feature' : ''}`} style={{ minHeight: 84 }} onClick={() => setSettings({ ...settings, level: lv })}>
                    <span className="tc" style={{ fontFamily: 'var(--font)', fontSize: 19 }}>{name}</span>
                    <span className="lbl">{hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">내 색</span>
              <div className="seg">
                {([['w', '백 (먼저 둠)'], ['b', '흑'], ['random', '무작위']] as const).map(([c, l]) => (
                  <button key={c} className={settings.color === c ? 'on' : ''} onClick={() => setSettings({ ...settings, color: c })}>{l}</button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">드래프트 방식</span>
          <div className="seg">
            <button className={settings.mirror ? 'on' : ''} onClick={() => setSettings({ ...settings, mirror: true })}>같은 카드 (레이팅전 방식)</button>
            <button className={!settings.mirror ? 'on' : ''} onClick={() => setSettings({ ...settings, mirror: false })}>각자 다른 카드</button>
          </div>
          <p className="muted" style={{ fontSize: 13.5 }}>{settings.mirror ? '두 사람이 매번 같은 카드 3장 중에서 골라요.' : '두 사람이 서로 다른 카드 3장을 제시받아요.'}</p>
        </div>
        <button className="btn primary lg block" onClick={() => start(settings)}>새 대국 시작</button>
      </div>
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

  let overlay = null;
  if (s.winner) {
    const title = s.winner === 'draw' ? '무승부' : g.kind === 'local' ? `${s.winner === 'w' ? '백' : '흑'} 승리` : s.winner === g.human ? '승리!' : '패배';
    overlay = (
      <ResultModal title={title} subtitle={REASON_TEXT[s.endReason ?? 'end'] ?? ''}>
        <button className="btn" onClick={onExit}>설정으로</button>
        <button className="btn primary" onClick={onRestart}>한 판 더</button>
      </ResultModal>
    );
  }

  const status = s.winner ? null : actor ? (
    <div className="status-line attn">{g.kind === 'local' ? `${s.turn === 'w' ? '백' : '흑'} 차례예요.` : '내 차례예요.'} 기물을 끌거나 눌러서 움직이세요.</div>
  ) : (
    <div className="status-line row"><span className="spinner" /> AI가 다음 수를 고민하고 있어요…</div>
  );

  return (
    <div className="main wide">
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
        overlay={overlay}
        controls={
          <>
            <button className="btn sm" onClick={onExit}>나가기</button>
            {!s.winner && <button className="btn sm danger" onClick={() => {
              if (!confirm('기권할까요?')) return;
              setHist((h) => {
                const last = h[h.length - 1]!;
                const st = { ...last.state, winner: (g.kind === 'local' ? (last.state.turn === 'w' ? 'b' : 'w') : botColor!) as Color, endReason: 'resign' as const };
                return [...h.slice(0, -1), { ...last, state: st }];
              });
            }}>기권</button>}
            <button className="btn sm ghost" onClick={() => navigate('/cards')}>카드 백과</button>
          </>
        }
      />
    </div>
  );
}
