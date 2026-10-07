import { useMemo, useState, type CSSProperties } from 'react';
import {
  Check, ChevronLeft, ChevronRight, Crown, Footprints, GraduationCap, Infinity as InfinityIcon, Layers, Lock, RotateCcw,
  Scale, Shapes, ShieldAlert, Sparkles, Trophy, X, Zap, type LucideIcon,
} from 'lucide-react';
import type { CardId, GameState } from '@engine';
import { CARDS, CARD_ORDER, fromPlacement, startSandbox } from '@engine';
import { Confetti } from '../game/GameOver.tsx';
import { CardView } from '../game/CardView.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { useSettings } from '../lib/settings.tsx';
import { sound } from '../lib/sound.ts';
import { getProgress, markProgress } from '../lib/storage.ts';
import { useToast } from '../lib/toast.tsx';
import { useIsMobile } from '../lib/ui.tsx';
import { DemoPlayer } from '../tutorial/DemoPlayer.tsx';
import { LESSONS, UNITS, type Lesson, type LessonStep } from '../tutorial/lessons.ts';

const ICON: Record<string, LucideIcon> = {
  check: ShieldAlert, mate: Crown, draws: Scale, draft: Layers, active: Zap, passive: InfinityIcon,
  status: Sparkles, compound: Shapes, leapers: Footprints, ranked: Trophy,
};
/** Horizontal offsets of the stepping stones, repeating down the path. */
const ZIG = [0, 56, 84, 56, 0, -56, -84, -56];

type NodeState = 'done' | 'current' | 'locked';

export function LearnIndex() {
  const prog = getProgress();
  const toast = useToast();
  const doneCount = LESSONS.filter((l) => prog.lessons.includes(l.id)).length;
  const firstOpen = LESSONS.findIndex((l) => !prog.lessons.includes(l.id));
  const stateOf = (i: number): NodeState => (prog.lessons.includes(LESSONS[i]!.id) ? 'done' : i === firstOpen ? 'current' : firstOpen >= 0 && i > firstOpen ? 'locked' : 'done');
  const doneCards = CARD_ORDER.filter((id) => prog.demos.includes(id)).length;
  const allDone = firstOpen < 0;

  let g = 0;
  return (
    <div className="page narrow learn">
      <div className="learn-head">
        <div className="grow">
          <div className="eyebrow">배우기</div>
          <h1>한 걸음씩 익히기</h1>
          <p>짧은 레슨을 하나씩 건너며 규칙과 카드를 익힙니다. 모든 레슨은 실제 보드에서 직접 둡니다.</p>
        </div>
        <div className="learn-ring" style={{ '--p': doneCount / LESSONS.length } as CSSProperties}>
          <b>{doneCount}</b><small>/{LESSONS.length}</small>
        </div>
      </div>

      {UNITS.map((u, ui) => {
        const lessons = u.lessons.map((id) => LESSONS.findIndex((l) => l.id === id));
        const unitDone = lessons.filter((i) => prog.lessons.includes(LESSONS[i]!.id)).length;
        return (
          <section key={u.title} className={`unit ${u.tone}`}>
            <div className="unit-banner">
              <div className="grow"><small>{ui + 1}단계</small><b>{u.title}</b></div>
              <span className="unit-count">{unitDone}/{lessons.length}</span>
            </div>
            <div className="path">
              {lessons.map((li, k) => {
                const lesson = LESSONS[li]!;
                const st = stateOf(li);
                const x = ZIG[g % ZIG.length]!;
                const nx = ZIG[(g + 1) % ZIG.length]!;
                g++;
                const I = ICON[lesson.id] ?? GraduationCap;
                const open = () => (st === 'locked' ? toast('앞의 레슨을 먼저 마치세요.') : navigate(`/learn/${lesson.id}`));
                return (
                  <div key={lesson.id} className="stop-wrap">
                    <div className={`stop ${st}`} style={{ '--x': `${x}px` } as CSSProperties}>
                      {st === 'current' && <div className="start-tip">{doneCount === 0 ? '여기서 시작' : '이어서 하기'}</div>}
                      <button className={`node ${st}`} onClick={open} aria-label={`${lesson.title}${st === 'done' ? ' (완료)' : st === 'locked' ? ' (잠김)' : ''}`}>
                        {st === 'locked' ? <Lock /> : <I />}
                        {st === 'done' && <span className="node-check"><Check /></span>}
                      </button>
                      <div className="node-label"><b>{lesson.title}</b><small>{lesson.summary}</small></div>
                    </div>
                    {k < lessons.length - 1 && (
                      <div className="stones" aria-hidden>
                        {[0.33, 0.66].map((t) => <i key={t} className={st === 'done' ? 'lit' : ''} style={{ '--x': `${x + (nx - x) * t}px` } as CSSProperties} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="unit finale">
        <button className={`finale-card${allDone ? ' ready' : ''}`} onClick={() => navigate('/cards')}>
          <span className="finale-ic"><Trophy /></span>
          <span className="grow">
            <b>{allDone ? '모든 레슨을 마쳤습니다' : '마지막 관문 · 카드 실전 연습'}</b>
            <small>카드 {CARD_ORDER.length}장을 보드에서 하나씩 직접 써 보세요 · {doneCards}/{CARD_ORDER.length}</small>
          </span>
          <ChevronRight className="chev" />
        </button>
      </section>
    </div>
  );
}

function buildStep(step: LessonStep): GameState {
  const s = fromPlacement(step.board!);
  s.cards.w.hand = [...(step.white ?? [])];
  s.cards.b.hand = [...(step.black ?? [])];
  step.setup?.(s);
  return startSandbox(s);
}

/** One segment per step: filled when cleared, glowing for the current one. */
function StepBar({ n, at, cleared }: { n: number; at: number; cleared: boolean }) {
  return (
    <span className="stepbar" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={at + (cleared ? 1 : 0)}>
      {Array.from({ length: n }, (_, k) => <i key={k} className={k < at || (k === at && cleared) ? 'on' : k === at ? 'now' : ''} />)}
    </span>
  );
}

function LessonDone({ lesson, onAgain }: { lesson: Lesson; onAgain: () => void }) {
  const li = LESSONS.indexOf(lesson);
  const next = LESSONS[li + 1];
  const unit = UNITS.find((u) => u.lessons.includes(lesson.id))!;
  const unitDone = getProgress().lessons.filter((id) => unit.lessons.includes(id)).length;
  const I = ICON[lesson.id] ?? GraduationCap;
  const NI = next ? ICON[next.id] ?? GraduationCap : Trophy;
  const unitCleared = unitDone === unit.lessons.length && unit.lessons[unit.lessons.length - 1] === lesson.id;
  return (
    <div className={`page narrow lesson-done ${unit.tone}`}>
      <Confetti />
      <div className="ld-medal"><I /><span className="node-check"><Check /></span></div>
      <div className="eyebrow">{unitCleared ? `${unit.title} 단계 완료` : '레슨 완료'}</div>
      <h1>{lesson.title}</h1>
      <p className="muted">{lesson.steps.length}개 과제를 모두 마쳤습니다.</p>
      <div className="ld-track" aria-hidden>
        {unit.lessons.map((id) => <i key={id} className={getProgress().lessons.includes(id) ? 'on' : ''} />)}
      </div>
      {next ? (
        <button className="ld-next" onClick={() => navigate(`/learn/${next.id}`)}>
          <span className="node current"><NI /></span>
          <span className="grow"><small>다음 레슨</small><b>{next.title}</b><em>{next.summary}</em></span>
          <ChevronRight className="chev" />
        </button>
      ) : (
        <button className="ld-next" onClick={() => navigate('/play/ai')}>
          <span className="node current"><Trophy /></span>
          <span className="grow"><small>모든 레슨 완료</small><b>AI와 실전 대국</b><em>배운 것을 바로 써 보세요</em></span>
          <ChevronRight className="chev" />
        </button>
      )}
      <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 14 }}>
        <button className="btn ghost" onClick={onAgain}><RotateCcw />다시 하기</button>
        <Link to="/learn" className="btn ghost">레슨 목록</Link>
      </div>
    </div>
  );
}

export function LessonPage({ id }: { id: string }) {
  const li = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[li];
  const [i, setI] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [picked, setPicked] = useState<CardId | null>(null);
  const [finished, setFinished] = useState(false);
  const [round, setRound] = useState(0);
  const mobile = useIsMobile();
  const { s: settings } = useSettings();
  const locked = useMemo(() => {
    const prog = getProgress();
    return lesson ? LESSONS.slice(0, li).some((l) => !prog.lessons.includes(l.id)) && !prog.lessons.includes(lesson.id) : false;
  }, [lesson, li]);
  if (!lesson) return <div className="page"><h1>없는 레슨입니다</h1><Link to="/learn">배우기로</Link></div>;
  if (finished) return <LessonDone lesson={lesson} onAgain={() => { setFinished(false); setI(0); setRound((r) => r + 1); }} />;
  const step = lesson.steps[i]!;
  const last = i === lesson.steps.length - 1;
  const canNext = !step.goal && !step.draft ? true : stepDone;

  function next() {
    if (last) {
      markProgress('lessons', lesson!.id);
      if (settings.sound) sound.success();
      setFinished(true);
    } else setI(i + 1);
    setStepDone(false);
    setPicked(null);
  }
  const close = () => navigate('/learn');

  const nextBtn = (
    <button className={`btn lg block ${canNext ? 'primary' : ''}${canNext && (step.goal || step.draft) ? ' guide' : ''}`} disabled={!canNext} onClick={next}>
      {last ? '레슨 완료' : '계속'}
    </button>
  );
  const bar = <StepBar n={lesson.steps.length} at={i} cleared={canNext && !!(step.goal || step.draft)} />;
  const top = (
    <div className="lesson-top">
      <button className="icon-btn" onClick={close} aria-label="레슨 닫기"><X /></button>
      {bar}
      <span className="lesson-count">{i + 1}/{lesson.steps.length}</span>
    </div>
  );
  const lockNote = locked && i === 0 && <p className="lesson-skip">앞의 레슨을 건너뛰고 왔습니다. 막히면 <Link to="/learn">처음 레슨</Link>부터 해 보세요.</p>;

  if (step.board) {
    return (
      <div className="page wide tight">
        {!mobile && (
          <div style={{ marginBottom: 14 }}>{top}</div>
        )}
        <DemoPlayer
          key={`${lesson.id}-${i}-${round}`}
          spec={{ heading: `${lesson.title} · ${step.title}`, build: () => buildStep(step), text: step.text, done: step.done ?? '좋습니다!', goal: step.goal ?? (() => false), wrong: step.wrong }}
          onComplete={() => setStepDone(true)}
          footer={(done) => (done ? <div style={{ marginTop: 4 }}>{nextBtn}</div> : null)}
          title={<span className="m-lesson-title">{bar}</span>}
          onBack={close}
        />
      </div>
    );
  }
  return (
    <div className="page narrow lesson-text">
      {top}
      {lockNote}
      <div className="lt-body" key={`${i}-${round}`}>
        <div className="eyebrow">{lesson.title}</div>
        <h2 className="lesson-h">{step.title}</h2>
        {step.draft ? (
          <>
            <p className="lt-text">{picked ? step.done : step.text}</p>
            <div className="draft-row" style={{ marginTop: 18 }}>
              {step.draft.map((cid) => <CardView key={cid} def={CARDS[cid]!} selected={picked === cid} onClick={() => { setPicked(cid); setStepDone(true); }} />)}
            </div>
          </>
        ) : (
          <div className="coach lt-coach">
            <div className="face"><img src="/pieces/wN.svg" alt="" /></div>
            <p className="lt-text">{step.text}</p>
          </div>
        )}
      </div>
      <div className="lt-foot">
        {i > 0 && <button className="btn lg ghost" onClick={() => { setI(i - 1); setStepDone(false); setPicked(null); }} aria-label="이전"><ChevronLeft /></button>}
        {nextBtn}
      </div>
    </div>
  );
}
