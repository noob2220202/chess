import type { CardId, DemoAction, GameState } from '../../../engine/src/index.ts';
import { attacks, findKing, parseSquare } from '../../../engine/src/index.ts';

export interface LessonStep {
  title: string;
  text: string;
  done?: string;
  board?: string;
  white?: CardId[];
  black?: CardId[];
  setup?: (s: GameState) => void;
  goal?: (s: GameState, a: DemoAction) => boolean;
  /** Draft practice: offer these cards; any pick completes the step. */
  draft?: CardId[];
  hints?: string[];
}
export interface Lesson { id: string; title: string; summary: string; steps: LessonStep[] }

const S = parseSquare;
const moved = (from: string, to: string) => (_s: GameState, a: DemoAction) => a.kind === 'move' && a.move.from === S(from) && a.move.to === S(to);

export const LESSONS: Lesson[] = [
  {
    id: 'basics', title: '킹을 잡으면 승리', summary: '체크 없는 체스: 승리 조건과 위험 감지',
    steps: [
      {
        title: '목표는 킹 포획', board: '4k3/8/8/8/4R3/8/8/4K3', hints: ['e4'],
        text: '증강전에는 체크메이트가 없어요. 상대 킹을 직접 잡으면 이깁니다. e4 룩으로 e8의 킹을 잡아보세요.',
        done: '승리! 킹을 잡는 순간 게임이 끝나요.', goal: (_s, a) => a.kind === 'move' && a.captured === 'K',
      },
      {
        title: '체크 알림은 없어요', board: '4k3/8/8/8/8/8/3q4/4K3',
        text: '상대 퀸이 킹 바로 옆까지 왔어요. 경고는 따로 뜨지 않으니 스스로 위험을 봐야 해요. 킹으로 d2의 퀸을 잡으세요.',
        done: '좋아요. 킹이 잡힐 수 있는 수도 둘 수 있으니 항상 상대 공격을 확인하세요.', goal: moved('e1', 'd2'),
      },
      {
        title: '상대의 공격 범위 보기', board: '4k3/8/8/8/1b6/8/8/4K3',
        text: '상대 기물을 누르면 빨간 점선으로 그 기물이 갈 수 있는 칸이 보여요. b4 비숍을 눌러 확인한 뒤, 킹을 공격받지 않는 칸으로 옮기세요.',
        done: '안전합니다! 상대 기물을 눌러 공격 범위를 보는 습관을 들이세요.',
        goal: (s, a) => a.kind === 'move' && a.piece === 'K' && !attacks(s, 'b').has(findKing(s, 'w')),
      },
      {
        title: '무승부 규칙', text: '같은 국면이 3번 반복되거나, 100수(양측 합산) 동안 포획과 폰 이동이 없거나, 300수에 도달하면 무승부예요. 둘 수 있는 수가 하나도 없으면 그 쪽이 패배합니다.',
      },
    ],
  },
  {
    id: 'pieces', title: '새로운 기물', summary: '대주교 · 재상 · 아마존 · 낙타 · 근위병',
    steps: [
      { title: '대주교', board: '4k3/8/8/8/8/3r4/8/2A1K3', text: '대주교는 비숍 + 나이트예요. 오른쪽 아래 나이트 배지가 표시돼요. c1에서 나이트처럼 뛰어 d3의 룩을 잡으세요.', done: '대주교는 대각선 이동과 나이트 점프를 모두 해요.', goal: moved('c1', 'd3') },
      { title: '재상', board: '4k3/8/8/8/8/6r1/8/4K2C', text: '재상은 룩 + 나이트예요. h1에서 나이트처럼 뛰어 g3의 룩을 잡으세요.', done: '재상은 직선 이동과 나이트 점프를 모두 해요.', goal: moved('h1', 'g3') },
      { title: '아마존', board: '4k3/8/8/8/8/2r5/8/3MK3', text: '아마존은 퀸 + 나이트, 가장 강한 기물이에요. d1에서 나이트처럼 뛰어 c3의 룩을 잡으세요.', done: '아마존은 거의 모든 칸을 노릴 수 있어요.', goal: moved('d1', 'c3') },
      { title: '낙타', board: '4k3/8/8/8/1r6/8/8/L3K3', text: '낙타("낙" 배지)는 (1,3) 모양으로 뛰어요. a1에서 b4로 뛰어 룩을 잡으세요.', done: '낙타는 항상 같은 색 칸에만 머무는 점프 기물이에요.', goal: moved('a1', 'b4') },
      { title: '근위병', board: '4k3/8/8/8/8/8/Gp6/4K3', text: '근위병("근" 배지)은 킹처럼 모든 방향으로 한 칸 움직이지만, 잡혀도 패배하지 않는 일반 기물이에요. 옆으로 움직여 b2의 폰을 잡으세요.', done: '근위병은 폰보다 유연한 수비수예요.', goal: moved('a2', 'b2') },
    ],
  },
  {
    id: 'draft', title: '증강 카드 드래프트', summary: '언제, 무엇을 고르는지',
    steps: [
      { title: '드래프트 타이밍', text: '내 0·10·20번째 수를 두기 직전에 카드 3장이 제시되고, 그중 하나를 골라요. 1라운드는 오프닝, 2라운드는 미들게임, 3라운드는 엔드게임 카드예요. 드래프트도 내 차례 시간 안에서 진행돼요.' },
      { title: '직접 골라보기', draft: ['sprint', 'knight-king', 'lancers'], text: '세 장 중 마음에 드는 카드를 하나 고르세요. ★이 많을수록 강하지만 드물게 나와요.', done: '카드를 손에 넣었어요! 패시브는 즉시, 영구히 적용돼요.' },
      { title: '미러 드래프트', text: '레이팅전에서는 두 사람이 매 라운드 똑같은 3장을 제시받아요(미러 드래프트). 카드 운이 아니라 선택과 운영으로 실력을 겨루게 됩니다.' },
    ],
  },
  {
    id: 'active', title: '액티브 카드', summary: '턴을 쓰지 않는 한 번짜리 능력',
    steps: [
      { title: '카드 + 수 = 한 차례', board: '4k3/8/8/8/8/2r5/P7/4K3', white: ['conscript'], text: '손패(내 카드)에서 "징병"을 누르고 a2 폰을 고르세요. 폰이 나이트가 되면, 같은 차례에 나이트로 c3의 룩을 잡으세요.', done: '액티브 카드는 턴을 쓰지 않아요. 단, 한 차례에 한 장만 쓸 수 있어요.', goal: moved('a2', 'c3') },
      { title: '상대 기물 얼리기', board: '4k3/8/8/8/8/8/8/r3K3', white: ['freeze'], text: 'a1 룩이 킹을 노려요. "빙결"로 룩을 얼리세요. 얼어붙은 기물에는 하늘색 얼음이 덮여요.', done: '얼어붙은 기물은 정해진 동안 움직이지 못해요(잡을 수는 있어요).', goal: (_s, a) => a.kind === 'card' && a.id === 'freeze' },
    ],
  },
  {
    id: 'passive', title: '패시브 카드', summary: '항상 켜져 있는 규칙 변화',
    steps: [
      { title: '움직임이 바뀌는 카드', board: '4k3/8/8/8/8/5r2/8/4K3', white: ['knight-king'], text: '"기사왕"을 가지고 있어요. 킹이 나이트처럼 뛸 수 있어요. 킹으로 f3의 룩을 잡으세요.', done: '패시브는 따로 사용하지 않아도 늘 적용돼요.', goal: moved('e1', 'f3') },
      { title: '포획이 바뀌는 카드', board: '4k3/8/8/4r3/8/4P3/8/4R1K1', white: ['rook-cannon'], text: '"포격 룩"이 있으면 룩이 기물 하나를 뛰어넘어 그 너머를 잡을 수 있어요. e1 룩으로 e5의 룩을 잡으세요.', done: '상대의 패시브도 늘 확인하세요. 상단 플레이어 바의 카드 아이콘을 누르면 볼 수 있어요.', goal: moved('e1', 'e5') },
    ],
  },
  {
    id: 'status', title: '상태 효과 읽기', summary: '방패 · 빙결 · 무장해제 · 지뢰',
    steps: [
      { title: '방패', board: '4k3/8/8/8/3r4/8/8/3QK3', white: ['aegis'], text: 'd4 룩이 퀸을 노려요. "방패"로 퀸을 보호하세요. 파란 원이 생기면 그 기물은 잡히지 않아요.', done: '방패는 정해진 수 동안 유지돼요.', goal: (_s, a) => a.kind === 'card' && a.id === 'aegis' },
      { title: '표시 한눈에 보기', text: '파란 원 = 방패(잡히지 않음) · 하늘색 얼음 = 빙결(움직일 수 없음) · 빨간 ✕ = 무장해제(잡을 수 없음) · 빨간 구슬 = 지뢰 · 초록 빗금 = 성역(상대 진입 불가) · 노란 테두리 = 정상 정복 칸.' },
    ],
  },
  {
    id: 'ranked', title: '레이팅전 안내', summary: '시간, 매칭, 점수',
    steps: [
      { title: '시간 규칙', text: '레이팅전은 10분 + 수당 5초예요. 카드 선택과 사용 시간도 내 시계에서 흘러요. 시간이 0이 되면 패배합니다.' },
      { title: '대국 취소', text: '대국 시작 후 30초 안에 첫 수를 두지 않으면 대국이 취소되고 레이팅에 반영되지 않아요.' },
      { title: '레이팅', text: '레이팅은 Glicko-2 방식이에요. 처음엔 1500에서 시작해 빠르게 움직이고, 판이 쌓일수록 안정돼요. 10판을 두기 전에는 "배치" 상태로 표시되고 랭킹에 오르지 않아요.' },
      { title: '시즌', text: '시즌이 바뀌면 레이팅이 1500 쪽으로 절반만큼 당겨지고, 다시 빠르게 자리를 찾아갑니다. 이제 실전에서 만나요!' },
    ],
  },
];
