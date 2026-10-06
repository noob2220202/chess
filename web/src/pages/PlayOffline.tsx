import { useCallback, useEffect, useRef, useState } from 'react';
import type { BotLevel, CardId, Color, GameState, Move, Square } from '@engine';
import { applyMove, cloneState, newGame, pickCard, playCard } from '@engine';
import { askBot } from '../bot/client.ts';
import { describeCard, describeMove, describePick } from '../game/describe.ts';
import { GameScreen, REASON_TEXT, ResultModal } from '../game/GameScreen.tsx';
import { Link } from '../lib/router.tsx';
import { load, remove, save } from '../lib/storage.ts';
import { useToast } from '../lib/toast.tsx';

type Kind = 'ai' | 'local';
interface Settings { level: BotLevel; color: Color | 'random'; mirror: boolean }
interface Saved { kind: Kind; settings: Settings; human: Color; state: GameState; log: string[]; last: { from: Square; to: Square } | null }

const LEVELS: Array<[BotLevel, string, string]> = [[1, '입문', '실수가 잦은 상대'], [2, '보통', '기본 전술을 아는 상대'], [3, '고수', '3수 앞을 읽는 상대']];
const KEY = (k: Kind) => `aa.offline.${k}`;

export default function PlayOffline({ kind }: { kind: Kind }) {
  const [saved, setSaved] = useState<Saved | null>(() => load<Saved | null>(KEY(kind), null));
  const [settings, setSettings] = useState<Settings>(() => load(`aa.settings.${kind}`, { level: 2 as BotLevel, color: 'w' as Color | 'random', mirror: true }));
  const [game, setGame] = useState<Saved | null>(null);

  useEffect(() => { setGame(null); setSaved(load<Saved | null>(KEY(kind), null)); }, [kind]);

  function start() {
    save(`aa.settings.${kind}`, settings);
    const human: Color = kind === 'local' ? 'w' : settings.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : settings.color;
    setGame({ kind, settings, human, state: newGame({ mirror: settings.mirror }), log: [], last: null });
  }

  if (game) return <OfflineGame key={game.state.board.length + game.human + (game.log.length ? 'r' : 'n')} initial={game} onExit={() => { setGame(null); setSaved(load<Saved | null>(KEY(kind), null)); }} onRestart={start} />;

  return (
    <div className="main" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">{kind === 'ai' ? '싱글 플레이' : '같은 기기에서 둘이서'}</div>
          <h1>{kind === 'ai' ? 'AI 대전' : '로컬 2인 대전'}</h1>
          <p>{kind === 'ai' ? '오프라인에서도 플레이할 수 있어요. 레이팅에는 반영되지 않아요.' : '한 화면에서 번갈아 두는 친선전이에요.'}</p>
        </div>
      </div>
      {saved && !saved.state.winner && (
        <div className="panel pad row" style={{ marginBottom: 18 }}>
          <div className="grow"><b>진행 중인 대국이 있어요</b><div className="muted" style={{ fontSize: 14 }}>{saved.log.length}개의 기록 · {saved.state.ply}수</div></div>
          <button className="btn ghost" onClick={() => { remove(KEY(kind)); setSaved(null); }}>삭제</button>
          <button className="btn teal" onClick={() => setGame(saved)}>이어하기</button>
        </div>
      )}
      <div className="panel pad stack" style={{ gap: 20 }}>
        {kind === 'ai' && (
          <>
            <div className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">난이도</span>
              <div className="feature-list">
                {LEVELS.map(([lv, name, hint]) => (
                  <button key={lv} className={`btn${settings.level === lv ? ' dark' : ''}`} style={{ flexDirection: 'column', height: 72, gap: 0 }} onClick={() => setSettings({ ...settings, level: lv })}>
                    <span>{name}</span><span style={{ fontSize: 12, opacity: 0.75, fontWeight: 600 }}>{hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">내 색</span>
              <div className="seg">
                {([['w', '백 (선공)'], ['b', '흑'], ['random', '무작위']] as const).map(([c, l]) => (
                  <button key={c} className={settings.color === c ? 'on' : ''} onClick={() => setSettings({ ...settings, color: c })}>{l}</button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">드래프트 방식</span>
          <div className="seg">
            <button className={settings.mirror ? 'on' : ''} onClick={() => setSettings({ ...settings, mirror: true })}>미러 (레이팅전 방식)</button>
            <button className={!settings.mirror ? 'on' : ''} onClick={() => setSettings({ ...settings, mirror: false })}>개별 무작위</button>
          </div>
          <p className="muted" style={{ fontSize: 14 }}>{settings.mirror ? '두 플레이어가 매 라운드 같은 3장 중에서 고릅니다.' : '각자 다른 3장을 제시받습니다.'}</p>
        </div>
        <button className="btn primary lg block" onClick={start}>새 대국 시작</button>
      </div>
    </div>
  );
}

function OfflineGame({ initial, onExit, onRestart }: { initial: Saved; onExit: () => void; onRestart: () => void }) {
  const [g, setG] = useState<Saved>(initial);
  const [thinking, setThinking] = useState(false);
  const toast = useToast();
  const botColor: Color | null = g.kind === 'ai' ? (g.human === 'w' ? 'b' : 'w') : null;
  const busy = useRef(false);

  useEffect(() => { save(KEY(g.kind), g); }, [g]);

  const update = useCallback((fn: (s: GameState) => { log: string; last?: { from: Square; to: Square } }) => {
    setG((prev) => {
      const s = cloneState(prev.state);
      try {
        const r = fn(s);
        return { ...prev, state: s, log: [...prev.log, r.log], last: r.last ?? prev.last };
      } catch (e) {
        toast((e as Error).message, 'error');
        return prev;
      }
    });
  }, [toast]);

  const onPick = (id: CardId) => update((s) => { const c = s.turn; pickCard(s, c, id); return { log: describePick(c, id) }; });
  const onCard = (id: CardId, sel: Square[]) => update((s) => { const c = s.turn; playCard(s, c, id, sel); return { log: describeCard(c, id, sel) }; });
  const onMove = (m: Move) => update((s) => { const t = describeMove(s, m); applyMove(s, m); return { log: t, last: { from: m.from, to: m.to } }; });

  // Bot turn.
  useEffect(() => {
    const s = g.state;
    if (!botColor || s.winner || s.turn !== botColor || busy.current) return;
    busy.current = true;
    setThinking(true);
    const started = Date.now();
    askBot(s, g.settings.level).then((d) => {
      const wait = Math.max(0, 450 - (Date.now() - started));
      setTimeout(() => {
        busy.current = false;
        setThinking(false);
        if (d.kind === 'pick') onPick(d.id);
        else {
          update((st) => {
            const logs: string[] = [];
            if (d.card) { playCard(st, botColor, d.card.id, d.card.sel); logs.push(describeCard(botColor, d.card.id, d.card.sel)); }
            if (!st.winner) { logs.push(describeMove(st, d.move)); applyMove(st, d.move); }
            return { log: logs.join(' · '), last: { from: d.move.from, to: d.move.to } };
          });
        }
      }, wait);
    }).catch((e) => { busy.current = false; setThinking(false); toast(`AI 오류: ${e.message}`, 'error'); });
  }, [g, botColor]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = g.state;
  const actor: Color | null = s.winner ? null : g.kind === 'local' ? s.turn : s.turn === g.human ? g.human : null;
  const orientation: Color = g.kind === 'local' ? 'w' : g.human;
  const names = g.kind === 'ai'
    ? { [g.human]: { name: '나' }, [botColor!]: { name: `AI · ${LEVELS[g.settings.level - 1]![1]}`, sub: thinking ? '생각 중…' : undefined } } as Record<Color, { name: string; sub?: string }>
    : { w: { name: '백 플레이어' }, b: { name: '흑 플레이어' } };

  let overlay = null;
  if (s.winner) {
    const title = s.winner === 'draw' ? '무승부' : g.kind === 'local' ? `${s.winner === 'w' ? '백' : '흑'} 승리` : s.winner === g.human ? '승리!' : '패배';
    overlay = (
      <ResultModal title={title} subtitle={REASON_TEXT[s.endReason ?? 'end'] ?? ''}>
        <button className="btn" onClick={() => { remove(KEY(g.kind)); onExit(); }}>설정으로</button>
        <button className="btn primary" onClick={() => { remove(KEY(g.kind)); onRestart(); }}>한 판 더</button>
      </ResultModal>
    );
  }

  const status = s.winner ? null : actor ? (
    <div className="status-line attn">{g.kind === 'local' ? `${s.turn === 'w' ? '백' : '흑'} 차례예요.` : '내 차례예요.'} 기물을 끌거나 눌러서 움직이세요.</div>
  ) : (
    <div className="status-line row"><span className="spinner" /> AI가 수를 고민하고 있어요…</div>
  );

  return (
    <div className="main wide">
      <GameScreen
        state={s}
        orientation={orientation}
        self={g.kind === 'ai' ? g.human : null}
        actor={actor}
        players={names}
        lastMove={g.last}
        onPick={onPick}
        onCard={onCard}
        onMove={onMove}
        status={status}
        log={g.log}
        overlay={overlay}
        controls={
          <>
            <button className="btn sm" onClick={onExit}>나가기</button>
            {!s.winner && <button className="btn sm danger" onClick={() => { if (confirm('기권할까요?')) update((st) => { st.winner = g.kind === 'local' ? (st.turn === 'w' ? 'b' : 'w') : botColor!; st.endReason = 'resign'; return { log: '기권' }; }); }}>기권</button>}
            <Link to="/cards" className="btn sm ghost">카드 백과</Link>
          </>
        }
      />
    </div>
  );
}
