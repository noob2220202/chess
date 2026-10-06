import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import type { DemoAction, GameState, Move, Square } from '@engine';
import { CARDS, PIECE_NAME, cloneState, demoAct, solveDemo, squareName } from '@engine';
import { GameScreen } from '../game/GameScreen.tsx';
import { cardEntry, moveEntry, startEntry, type HistEntry } from '../game/history.ts';
import { useSettings } from '../lib/settings.tsx';
import { sound } from '../lib/sound.ts';
import { josa } from '../lib/korean.ts';
import { useToast } from '../lib/toast.tsx';
import { useIsMobile } from '../lib/ui.tsx';

export interface DemoSpec {
  build: () => GameState;
  text: string;
  done: string;
  goal: (s: GameState, a: DemoAction) => boolean;
}

function Burst() {
  const bits = useMemo(() => Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * Math.PI * 2, d = 90 + Math.random() * 120;
    return { dx: `${Math.cos(a) * d}px`, dy: `${Math.sin(a) * d}px`, r: `${Math.random() * 540}deg`, c: ['#f0a73a', '#72c46e', '#9b8cf5', '#5aa9e6', '#ffd98a'][i % 5] };
  }), []);
  return (
    <div style={{ position: 'fixed', left: '50%', top: '45%', width: 0, height: 0, zIndex: 70, pointerEvents: 'none' }}>
      <div className="burst">{bits.map((b, i) => <i key={i} style={{ background: b.c, ['--dx' as string]: b.dx, ['--dy' as string]: b.dy, ['--r' as string]: b.r }} />)}</div>
      <div className="success-flag">성공!</div>
    </div>
  );
}

export function DemoPlayer({ spec, onComplete, footer, title, onBack }: { spec: DemoSpec; onComplete?: () => void; footer?: (done: boolean, reset: () => void) => ReactNode; title?: string; onBack?: () => void }) {
  const { s: settings } = useSettings();
  const mobile = useIsMobile();
  const [hist, setHist] = useState<HistEntry[]>(() => [startEntry(spec.build())]);
  const [done, setDone] = useState(false);
  const [burst, setBurst] = useState(0);
  const [showHint, setShowHint] = useState(settings.guide);
  const toast = useToast();
  const s = hist[hist.length - 1]!.state;
  const histRef = useRef(hist);
  histRef.current = hist;

  useEffect(() => setShowHint(settings.guide), [settings.guide]);

  // Next action toward the goal, recomputed after every learner action.
  const plan = useMemo(() => (done ? null : solveDemo(s, spec.goal)), [s, spec, done]);
  const next = plan?.[0] ?? null;

  const reset = () => { setHist([startEntry(spec.build())]); setDone(false); };

  function act(a: { move: Move } | { card: string; sel: Square[] }) {
    if (done) return;
    const prev = histRef.current[histRef.current.length - 1]!;
    const c = cloneState(prev.state);
    let rec: DemoAction;
    try { rec = demoAct(c, a); } catch (e) { toast((e as Error).message, 'error'); sound.error(); return; }
    const entry = 'move' in a ? moveEntry(prev.state, a.move, c) : cardEntry('w', a.card, c, prev.last);
    setHist((h) => [...h, entry]);
    if (spec.goal(c, rec)) {
      setDone(true);
      setBurst((n) => n + 1);
      if (settings.sound) setTimeout(() => sound.success(), 180);
      onComplete?.();
    } else if (c.winner) toast('게임이 끝났어요. 처음부터 다시 해 보세요.', 'error');
  }

  let guide = null;
  let guideCard: string | null = null;
  let hintText: string | null = null;
  if (next && showHint) {
    if ('move' in next) {
      const p = s.board[next.move.from];
      guide = { squares: [next.move.from, next.move.to], label: '이 기물을 움직이세요' };
      hintText = `${josa(p ? PIECE_NAME[p.type] : '기물', '을/를')} ${squareName(next.move.from)}에서 ${josa(squareName(next.move.to), '으로/로')} 움직이기`;
    } else {
      guideCard = next.card;
      guide = { squares: next.sel, label: '여기를 고르세요' };
      hintText = `“${CARDS[next.card]!.name}” 카드를 눌러 사용하기`;
    }
  }

  const coach = (
    <div className={`coach${done ? ' success' : ''}`}>
      <div className="face"><img src="/pieces/wN.svg" alt="" /></div>
      <div className="stack grow" style={{ gap: 8 }}>
        <p>{done ? spec.done : spec.text}</p>
        {!done && hintText && <div className="step-hint">다음 할 일: {hintText}</div>}
        {!done && !showHint && next && <div><button className="btn sm" onClick={() => setShowHint(true)}>힌트 보기</button></div>}
        {!done && !mobile && <div className="row" style={{ gap: 6 }}><button className="btn sm ghost" style={{ paddingLeft: 0 }} onClick={reset}><RotateCcw />처음부터</button></div>}
        {footer?.(done, reset)}
      </div>
    </div>
  );

  return (
    <>
      <GameScreen
        history={hist}
        orientation="w"
        self="w"
        actor={done ? null : 'w'}
        players={{ w: { name: '나', sub: '백' }, b: { name: '연습 상대', sub: '흑 · 움직이지 않아요' } }}
        onPick={() => {}}
        onCard={(id, sel) => act({ card: id, sel })}
        onMove={(move) => act({ move })}
        status={coach}
        guide={guide}
        guideCard={guideCard}
        hideDraft
        showMoves={false}
        menu={[{ label: '처음부터 다시', icon: <RotateCcw />, onClick: reset }]}
        title={title}
        onBack={onBack}
      />
      {burst > 0 && <Burst key={burst} />}
    </>
  );
}
