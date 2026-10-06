import { useState } from 'react';
import type { CardId, GameState } from '@engine';
import { CARDS, fromPlacement, startSandbox } from '@engine';
import { CardView } from '../game/CardView.tsx';
import { Link, navigate } from '../lib/router.tsx';
import { getProgress, markProgress } from '../lib/storage.ts';
import { DemoPlayer } from '../tutorial/DemoPlayer.tsx';
import { LESSONS, type LessonStep } from '../tutorial/lessons.ts';

export function LearnIndex() {
  const prog = getProgress();
  const doneLessons = LESSONS.filter((l) => prog.lessons.includes(l.id)).length;
  const cardIds = Object.keys(CARDS);
  const doneCards = cardIds.filter((id) => prog.demos.includes(id)).length;
  return (
    <div className="main narrow">
      <div className="page-head">
        <div>
          <div className="eyebrow">튜토리얼</div>
          <h1>직접 두면서 배우기</h1>
          <p>모든 레슨은 실제 보드에서 진행돼요. 5분이면 기본 규칙을 익힐 수 있어요.</p>
        </div>
      </div>
      <div className="panel pad stack" style={{ marginBottom: 22 }}>
        <div className="row"><b className="grow">레슨 진행도</b><span className="mono">{doneLessons}/{LESSONS.length}</span></div>
        <div className="progress"><div style={{ width: `${(doneLessons / LESSONS.length) * 100}%` }} /></div>
        <div className="row"><b className="grow">카드 실전 연습</b><span className="mono">{doneCards}/{cardIds.length}</span></div>
        <div className="progress"><div style={{ width: `${(doneCards / cardIds.length) * 100}%` }} /></div>
      </div>
      <div className="lesson-list">
        {LESSONS.map((l, i) => (
          <Link key={l.id} to={`/learn/${l.id}`} className={`lesson-item${prog.lessons.includes(l.id) ? ' done' : ''}${LESSONS.find((x) => !prog.lessons.includes(x.id))?.id === l.id ? ' next' : ''}`}>
            <span className="num">{prog.lessons.includes(l.id) ? '✓' : i + 1}</span>
            <div className="grow"><b>{l.title}</b><span>{l.summary}</span></div>
            <span style={{ fontWeight: 900 }}>→</span>
          </Link>
        ))}
        <Link to="/cards" className="lesson-item">
          <span className="num">60</span>
          <div className="grow"><b>카드 60장 실전 연습</b><span>카드 백과에서 모든 증강을 하나씩 직접 써보세요</span></div>
          <span style={{ fontWeight: 900 }}>→</span>
        </Link>
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
  if (!lesson) return <div className="main"><h1>없는 레슨이에요</h1><Link to="/learn">튜토리얼로</Link></div>;
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

  const nav = (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <button className="btn sm ghost" disabled={i === 0} onClick={() => { setI(i - 1); setStepDone(false); setPicked(null); }}>이전</button>
      <button className={`btn ${canNext ? 'primary' : ''}${canNext && (step.goal || step.draft) ? ' guide' : ''}`} disabled={!canNext} onClick={next}>{last ? '레슨 완료 →' : '다음 →'}</button>
    </div>
  );

  return (
    <div className={`main${step.board ? ' wide tight' : ' narrow'}`}>
      <div className="row" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Link to="/learn" className="btn sm ghost">← 레슨 목록</Link>
        <div className="grow">
          <div className="eyebrow">레슨 {li + 1} · {lesson.title}</div>
          <h2 style={{ fontSize: 'clamp(19px, 2.4vw, 24px)' }}>{step.title}</h2>
        </div>
        <span className="chip">{i + 1} / {lesson.steps.length}</span>
      </div>
      <div className="progress" style={{ marginBottom: 20 }}><div style={{ width: `${((i + (canNext ? 1 : 0)) / lesson.steps.length) * 100}%` }} /></div>

      {step.board ? (
        <DemoPlayer
          key={`${lesson.id}-${i}`}
          spec={{ build: () => buildStep(step), text: step.text, done: step.done ?? '좋아요!', goal: step.goal ?? (() => false) }}
          onComplete={() => setStepDone(true)}
          footer={() => nav}
        />
      ) : step.draft ? (
        <div className="panel pad stack">
          <p style={{ fontSize: 17 }}>{picked ? step.done : step.text}</p>
          <div className="draft-cards">
            {step.draft.map((cid) => (
              <CardView key={cid} def={CARDS[cid]!} selected={picked === cid} onClick={() => { setPicked(cid); setStepDone(true); }} />
            ))}
          </div>
          {nav}
        </div>
      ) : (
        <div className="coach" style={{ alignItems: 'center' }}>
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
