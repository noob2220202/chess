import { useMemo, useState } from 'react';
import type { CardId, DemoAction, GameState, Move, Square } from '@engine';
import { cloneState, demoAct, parseSquare } from '@engine';
import { GameScreen } from '../game/GameScreen.tsx';
import { useToast } from '../lib/toast.tsx';

export interface DemoSpec {
  build: () => GameState;
  text: string;
  done: string;
  goal: (s: GameState, a: DemoAction) => boolean;
  hints?: string[];
}

export function DemoPlayer({ spec, onComplete, footer }: { spec: DemoSpec; onComplete?: () => void; footer?: (done: boolean, reset: () => void) => React.ReactNode }) {
  const [s, setS] = useState<GameState>(() => spec.build());
  const [done, setDone] = useState(false);
  const [last, setLast] = useState<{ from: Square; to: Square } | null>(null);
  const toast = useToast();
  const hints = useMemo(() => (done ? [] : (spec.hints ?? []).map(parseSquare)), [spec, done]);

  const reset = () => { setS(spec.build()); setDone(false); setLast(null); };
  function act(a: { move: Move } | { card: CardId; sel: Square[] }) {
    if (done) return;
    const c = cloneState(s);
    let rec: DemoAction;
    try { rec = demoAct(c, a); } catch (e) { toast((e as Error).message, 'error'); return; }
    setS(c);
    if ('move' in a) setLast({ from: a.move.from, to: a.move.to });
    if (spec.goal(c, rec)) { setDone(true); onComplete?.(); }
    else if (c.winner) toast('게임이 끝났어요. 다시 해보세요.', 'error');
  }

  const coach = (
    <div className={`coach${done ? ' success' : ''}`}>
      <div className="face"><img src="/pieces/wN.svg" alt="" /></div>
      <div className="stack" style={{ gap: 10 }}>
        <p>{done ? spec.done : spec.text}</p>
        {footer?.(done, reset)}
      </div>
    </div>
  );

  return (
    <GameScreen
      state={s}
      orientation="w"
      self="w"
      actor={done ? null : 'w'}
      players={{ w: { name: '나', sub: '백' }, b: { name: '상대', sub: '흑 · 연습용으로 움직이지 않아요' } }}
      lastMove={last}
      onPick={() => {}}
      onCard={(id, sel) => act({ card: id, sel })}
      onMove={(move) => act({ move })}
      status={coach}
      hints={hints}
      hideDraft
      controls={<button className="btn sm" onClick={reset}>처음부터</button>}
    />
  );
}
