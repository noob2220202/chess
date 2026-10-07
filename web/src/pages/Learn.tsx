import { CARD_ORDER } from '@engine';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import type { CardId, GameState } from '@engine';
import { CARDS, fromPlacement, startSandbox } from '@engine';
import { CardView } from '../game/CardView.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { getProgress, markProgress } from '../lib/storage.ts';
import { useIsMobile } from '../lib/ui.tsx';
import { DemoPlayer } from '../tutorial/DemoPlayer.tsx';
import { LESSONS, type LessonStep } from '../tutorial/lessons.ts';

export function LearnIndex() {
  const prog = getProgress();
  const doneLessons = LESSONS.filter((l) => prog.lessons.includes(l.id)).length;
  const cardIds = Object.keys(CARDS);
  const doneCards = cardIds.filter((id) => prog.demos.includes(id)).length;
  const nextId = LESSONS.find((l) => !prog.lessons.includes(l.id))?.id;
  return (
    <div className="page narrow">
      <div className="head">
        <div className="eyebrow">배우기</div>
        <h1>직접 두면서 배웁니다</h1>
        <p>모든 레슨은 실제 보드에서 진행됩니다. 다음에 누를 곳은 반짝이며 알려 드립니다.</p>
      </div>
      <div className="surface pad stack" style={{ gap: 10, marginBottom: 22 }}>
        <div className="row between"><b>레슨</b><span className="mono muted">{doneLessons}/{LESSONS.length}</span></div>
        <div className="progress"><div style={{ width: `${(doneLessons / LESSONS.length) * 100}%` }} /></div>
        <div className="row between" style={{ marginTop: 6 }}><b>카드 연습</b><span className="mono muted">{doneCards}/{cardIds.length}</span></div>
        <div className="progress"><div style={{ width: `${(doneCards / cardIds.length) * 100}%` }} /></div>
      </div>
      <div className="list lessons">
        {LESSONS.map((l, i) => {
          const done = prog.lessons.includes(l.id);
          return (
            <button key={l.id} className={`list-row${done ? ' done' : ''}${nextId === l.id ? ' next' : ''}`} onClick={() => navigate(`/learn/${l.id}`)}>
              <span className="num">{done ? '✓' : i + 1}</span>
              <span className="grow"><b>{l.title}</b><small>{l.summary}</small></span>
              <ChevronRight className="chev" />
            </button>
          );
        })}
        <button className="list-row" onClick={() => navigate('/cards')}>
          <span className="ic violet"><Layers /></span>
          <span className="grow"><b>카드 {CARD_ORDER.length}장 실전 연습</b><small>카드 백과에서 모든 카드를 하나씩 직접 써 보세요</small></span>
          <ChevronRight className="chev" />
        </button>
      </div>
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

export function LessonPage({ id }: { id: string }) {
  const li = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[li];
  const [i, setI] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [picked, setPicked] = useState<CardId | null>(null);
  const mobile = useIsMobile();
  if (!lesson) return <div className="page"><h1>없는 레슨입니다</h1><Link to="/learn">배우기로</Link></div>;
  const step = lesson.steps[i]!;
  const last = i === lesson.steps.length - 1;
  const canNext = !step.goal && !step.draft ? true : stepDone;

  function next() {
    if (last) {
      markProgress('lessons', lesson!.id);
      const nextLesson = LESSONS[li + 1];
      navigate(nextLesson ? `/learn/${nextLesson.id}` : '/learn');
      setI(0);
    } else setI(i + 1);
    setStepDone(false);
    setPicked(null);
  }
  const prev = () => { setI(i - 1); setStepDone(false); setPicked(null); };

  const nav = (
    <div className="row between" style={{ marginTop: 4 }}>
      <button className="btn sm ghost" disabled={i === 0} onClick={prev}><ChevronLeft />이전</button>
      <button className={`btn ${canNext ? 'primary' : ''}${canNext && (step.goal || step.draft) ? ' guide' : ''}`} disabled={!canNext} onClick={next}>
        {last ? '레슨 완료' : '다음'}<ChevronRight />
      </button>
    </div>
  );
  const header = (
    <div style={{ marginBottom: 16 }}>
      {!mobile && <Link to="/learn" className="backlink"><ChevronLeft />배우기</Link>}
      <div className="row between" style={{ marginTop: 4 }}>
        <div>
          <div className="eyebrow">레슨 {li + 1} · {lesson.title} · {i + 1}/{lesson.steps.length}</div>
          <h2 style={{ fontSize: 'clamp(20px, 2.6vw, 26px)', fontWeight: 850 }}>{step.title}</h2>
        </div>
      </div>
      <div className="progress" style={{ marginTop: 12 }}><div style={{ width: `${((i + (canNext ? 1 : 0)) / lesson.steps.length) * 100}%` }} /></div>
    </div>
  );

  if (step.board) {
    return (
      <div className="page wide tight">
        {!mobile && header}
        <DemoPlayer
          key={`${lesson.id}-${i}`}
          spec={{ build: () => buildStep(step), text: step.text, done: step.done ?? '좋습니다!', goal: step.goal ?? (() => false) }}
          onComplete={() => setStepDone(true)}
          footer={(done) => (!mobile || done ? nav : null)}
          title={`${step.title} · ${i + 1}/${lesson.steps.length}`}
          onBack={() => navigate('/learn')}
        />
      </div>
    );
  }
  return (
    <div className="page narrow">
      {header}
      {step.draft ? (
        <div className="stack" style={{ gap: 16 }}>
          <p style={{ fontSize: 17 }}>{picked ? step.done : step.text}</p>
          <div className="draft-row" style={{ marginTop: 0 }}>
            {step.draft.map((cid) => <CardView key={cid} def={CARDS[cid]!} selected={picked === cid} onClick={() => { setPicked(cid); setStepDone(true); }} />)}
          </div>
          {nav}
        </div>
      ) : (
        <div className="coach" style={{ alignItems: 'flex-start' }}>
          <div className="face"><img src="/pieces/wN.svg" alt="" /></div>
          <div className="stack grow" style={{ gap: 14 }}>
            <p style={{ fontSize: 17 }}>{step.text}</p>
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}
