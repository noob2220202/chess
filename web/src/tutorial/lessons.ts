import type { CardId, DemoAction, GameState } from '../../../engine/src/index.ts';
import { hasLegalMove, inCheck, parseSquare } from '../../../engine/src/index.ts';

export interface LessonStep {
  title: string;
  text: string;
  done?: string;
  board?: string;
  white?: CardId[];
  black?: CardId[];
  setup?: (s: GameState) => void;
  goal?: (s: GameState, a: DemoAction) => boolean;
  /** Explain why a move that misses the goal is wrong (the move is then taken back). */
  wrong?: (s: GameState, a: DemoAction) => string | null;
  /** Draft practice: offer these cards; any pick completes the step. */
  draft?: CardId[];
}
export interface Lesson { id: string; title: string; summary: string; steps: LessonStep[] }
export interface Unit { title: string; tone: 'amber' | 'teal' | 'violet' | 'blue'; lessons: string[] }

const S = parseSquare;
const moved = (from: string, to: string) => (_s: GameState, a: DemoAction) => a.kind === 'move' && a.move.from === S(from) && a.move.to === S(to);
const mates = (s: GameState, a: DemoAction) => a.kind === 'move' && inCheck(s, 'b') && !hasLegalMove(s, 'b');

export const UNITS: Unit[] = [
  { title: '체스 기본', tone: 'amber', lessons: ['check', 'mate', 'draws'] },
  { title: '증강 카드', tone: 'teal', lessons: ['draft', 'active', 'passive', 'status'] },
  { title: '특수 기물', tone: 'violet', lessons: ['compound', 'leapers'] },
  { title: '실전', tone: 'blue', lessons: ['ranked'] },
];

/** Lessons that replaced older, longer ones (for saved progress). */
export const LESSON_RENAMES: Record<string, string[]> = { basics: ['check', 'mate', 'draws'], pieces: ['compound', 'leapers'] };

export const LESSONS: Lesson[] = [
  {
    id: 'check', title: '체크', summary: '공격받은 킹을 지키는 세 가지 방법',
    steps: [
      {
        title: '피하기', board: '3kr3/8/8/8/8/8/8/4K3',
        text: 'e8의 룩이 킹을 공격하고 있습니다. 이것을 체크라고 합니다. 킹을 공격받지 않는 칸으로 옮기세요.',
        done: '체크를 받으면 킹이 빨갛게 표시됩니다. 체크를 받은 채로는 다른 수를 둘 수 없습니다.',
        goal: (_s, a) => a.kind === 'move' && a.piece === 'K',
      },
      {
        title: '막기', board: '3kr3/8/8/8/8/8/3P1P2/3QKB2',
        text: '이번에는 킹이 피할 칸이 없습니다. 퀸이나 비숍을 e2로 옮겨 룩의 공격을 막으세요.',
        done: '공격하는 선 사이에 기물을 세우면 체크를 막을 수 있습니다.',
        goal: (s, a) => a.kind === 'move' && a.piece !== 'K' && !inCheck(s, 'w'),
      },
      {
        title: '잡기', board: '4k3/8/8/8/8/8/3q4/4K3',
        text: '공격한 기물을 잡아도 체크에서 벗어납니다. 킹으로 d2의 퀸을 잡으세요.',
        done: '피하기, 막기, 잡기. 체크를 벗어나는 방법은 이 세 가지뿐입니다.', goal: moved('e1', 'd2'),
      },
    ],
  },
  {
    id: 'mate', title: '체크메이트', summary: '피할 수 없는 체크로 승리',
    steps: [
      {
        title: '마지막 줄 메이트', board: '6k1/5ppp/8/8/8/8/8/R5K1',
        text: '체크를 피할 방법이 하나도 없으면 체크메이트, 곧 승리입니다. a1의 룩을 a8로 보내세요.',
        done: '체크메이트! 흑 킹이 자기 폰에 막혀 도망칠 곳이 없습니다.',
        goal: mates,
      },
      {
        title: '킹과 퀸의 협력', board: '7k/8/5K2/8/8/8/8/6Q1',
        text: '킹이 지켜 주는 칸에 퀸을 보내면 상대 킹은 퀸을 잡을 수 없습니다. 퀸으로 체크메이트하세요.',
        done: '킹이 지키는 g7의 퀸은 잡을 수 없습니다. 가장 흔한 메이트 모양입니다.',
        goal: mates,
      },
      {
        title: '카드로 버티기',
        text: '증강전에서는 체크메이트처럼 보여도, 쓸 수 있는 카드로 체크를 벗어날 수 있다면 대국이 계속됩니다. 상대에게 남은 카드를 늘 확인하세요.',
      },
    ],
  },
  {
    id: 'draws', title: '무승부와 연장전', summary: '스테일메이트, 동형 반복, 연장전',
    steps: [
      {
        title: '스테일메이트 피하기', board: '7k/5K2/8/8/8/8/8/6Q1',
        text: '이길 수 있는 판을 무승부로 만들지 마세요. 퀸으로 바로 체크메이트하세요.',
        done: '정확합니다. 체크가 아닌데 둘 수 있는 수가 없으면 스테일메이트로 무승부가 됩니다.',
        goal: mates,
        wrong: (s, a) => a.kind === 'move' && !inCheck(s, 'b') && !hasLegalMove(s, 'b')
          ? '스테일메이트입니다. 흑은 체크가 아닌데 둘 수 있는 수가 없어 무승부가 됩니다. 다시 해 보세요.' : null,
      },
      {
        title: '그 밖의 무승부',
        text: '같은 국면이 세 번 나오거나, 양쪽 합쳐 100수 동안 기물을 잡지도 폰을 움직이지도 않거나, 300수에 도달하면 무승부입니다.',
      },
      {
        title: '연장전',
        text: '양쪽 합쳐 120수가 지나면 연장전에 들어갑니다. 연장전에서 20수 동안 잡기, 폰 이동, 카드 사용이 하나도 없으면 남은 기물 점수가 높은 쪽이 이깁니다. 앞서고 있다면 시간을 끌어도 되고, 지고 있다면 먼저 움직여야 합니다.',
      },
    ],
  },
  {
    id: 'draft', title: '카드 고르기', summary: '언제, 어떤 카드를 고르는가',
    steps: [
      { title: '드래프트는 세 번', text: '내 0번째, 10번째, 20번째 수를 두기 직전에 카드 3장이 나오고, 그중 한 장을 고릅니다. 차례로 오프닝, 미들게임, 엔드게임 카드입니다. 카드를 고르는 동안에도 내 시계는 흘러갑니다.' },
      { title: '직접 골라 보기', draft: ['sprint', 'knight-king', 'lancers'], text: '세 장 중 마음에 드는 카드를 한 장 고르세요. 오른쪽 위 숫자가 클수록 강하지만, 그만큼 드물게 나옵니다.', done: '카드를 얻었습니다. 패시브 카드는 얻는 즉시 효과가 생기고 끝까지 유지됩니다.' },
      { title: '같은 카드로 겨루기', text: '레이팅전에서는 두 사람이 매번 똑같은 카드 3장 중에서 고릅니다. 이것을 미러 드래프트라고 합니다. 카드 운이 아니라 선택과 운영으로 실력을 겨룹니다.' },
    ],
  },
  {
    id: 'active', title: '액티브 카드', summary: '차례를 쓰지 않는 한 번짜리 능력',
    steps: [
      { title: '카드 쓰고 수 두기', board: '4k3/8/8/8/8/2r5/P7/4K3', white: ['conscript'], text: '“징병” 카드를 누른 뒤 a2 폰을 고르세요. 폰이 나이트로 바뀌면, 같은 차례에 그 나이트로 c3의 룩을 잡으세요.', done: '액티브 카드를 써도 차례는 넘어가지 않습니다. 다만 한 차례에 한 장만 쓸 수 있습니다.', goal: moved('a2', 'c3') },
      { title: '상대 기물 얼리기', board: '4k3/8/8/8/8/8/8/r3K3', white: ['freeze'], text: 'a1의 룩이 킹을 노리고 있습니다. “빙결” 카드로 룩을 얼리세요.', done: '얼어붙은 기물은 하늘색 얼음으로 덮이고, 정해진 동안 움직이지 못합니다. 대신 잡을 수는 있습니다.', goal: (_s, a) => a.kind === 'card' && a.id === 'freeze' },
    ],
  },
  {
    id: 'passive', title: '패시브 카드', summary: '항상 켜져 있는 규칙 변화',
    steps: [
      { title: '움직임이 바뀌는 카드', board: '4k3/8/8/8/8/5r2/8/4K3', white: ['knight-king'], text: '“기사왕” 카드가 있어서 킹이 나이트처럼 뛸 수 있습니다. 킹으로 f3의 룩을 잡으세요.', done: '패시브 카드는 따로 쓰지 않아도 항상 적용됩니다.', goal: moved('e1', 'f3') },
      { title: '잡는 방법이 바뀌는 카드', board: '4k3/8/8/4r3/8/4P3/8/4R1K1', white: ['rook-cannon'], text: '“포격 룩” 카드가 있으면 룩이 기물 하나를 뛰어넘어 그 너머를 잡을 수 있습니다. e1의 룩으로 e5의 룩을 잡으세요.', done: '상대의 패시브 카드도 늘 확인하세요. 상대 이름 옆의 작은 카드를 누르면 볼 수 있습니다.', goal: moved('e1', 'e5') },
    ],
  },
  {
    id: 'status', title: '상태 효과', summary: '방패 · 빙결 · 무장해제 · 지뢰',
    steps: [
      { title: '방패', board: '4k3/8/8/8/3r4/8/8/3QK3', white: ['aegis'], text: 'd4의 룩이 퀸을 노리고 있습니다. “방패” 카드로 퀸을 지키세요.', done: '파란 원이 생긴 기물은 잡히지 않습니다. 왼쪽 위의 숫자는 효과가 남은 차례 수입니다.', goal: (_s, a) => a.kind === 'card' && a.id === 'aegis' },
      { title: '표시 한눈에 보기', text: '파란 원은 방패(잡히지 않음), 하늘색 얼음은 빙결(움직일 수 없음), 빨간 표시는 무장해제(잡을 수 없음)입니다. 빨간 구슬은 지뢰, 초록 빗금 칸은 성역(상대가 들어올 수 없음), 노란 테두리 칸은 정상 정복 칸입니다.' },
    ],
  },
  {
    id: 'compound', title: '합성 기물', summary: '대주교 · 재상 · 아마존',
    steps: [
      { title: '대주교', board: '4k3/8/8/8/8/3r4/8/2A1K3', text: '대주교는 비숍과 나이트를 합친 기물입니다. 오른쪽 아래의 작은 나이트 배지로 알아볼 수 있습니다. c1에서 나이트처럼 뛰어 d3의 룩을 잡으세요.', done: '대주교는 대각선으로도 가고, 나이트처럼 뛰기도 합니다.', goal: moved('c1', 'd3') },
      { title: '재상', board: '4k3/8/8/8/8/6r1/8/4K2C', text: '재상은 룩과 나이트를 합친 기물입니다. h1에서 나이트처럼 뛰어 g3의 룩을 잡으세요.', done: '재상은 직선으로도 가고, 나이트처럼 뛰기도 합니다.', goal: moved('h1', 'g3') },
      { title: '아마존', board: '4k3/8/8/8/8/2r5/8/3MK3', text: '아마존은 퀸과 나이트를 합친, 가장 강한 기물입니다. d1에서 나이트처럼 뛰어 c3의 룩을 잡으세요.', done: '아마존은 거의 모든 방향을 노릴 수 있습니다.', goal: moved('d1', 'c3') },
    ],
  },
  {
    id: 'leapers', title: '낙타와 근위병', summary: '특이하게 움직이는 두 기물',
    steps: [
      { title: '낙타', board: '4k3/8/8/8/1r6/8/8/L3K3', text: '낙타는 “낙” 배지가 붙은 기물로, 한 칸과 세 칸을 꺾어 뜁니다. a1에서 b4로 뛰어 룩을 잡으세요.', done: '낙타는 늘 같은 색 칸에만 머무르는 점프 기물입니다.', goal: moved('a1', 'b4') },
      { title: '근위병', board: '4k3/8/8/8/8/8/Gp6/4K3', text: '근위병은 “근” 배지가 붙은 기물입니다. 킹처럼 모든 방향으로 한 칸씩 움직입니다. 옆으로 움직여 b2의 폰을 잡으세요.', done: '근위병은 잡혀도 지지 않는, 폰보다 자유로운 수비수입니다.', goal: moved('a2', 'b2') },
    ],
  },
  {
    id: 'ranked', title: '레이팅전', summary: '시간, 매칭, 점수',
    steps: [
      { title: '시간 규칙', text: '레이팅전은 10분에, 수를 둘 때마다 5초가 더해집니다. 카드를 고르고 쓰는 시간도 내 시계에서 빠집니다. 시간이 다 떨어지면 집니다. 대국이 시작되고 30초 안에 첫 수를 두지 않으면 대국이 취소되며, 취소된 대국은 레이팅에 반영되지 않습니다.' },
      { title: '레이팅', text: '레이팅은 Glicko-2 방식으로 계산합니다. 1500에서 시작해 처음에는 크게 오르내리고, 판이 쌓일수록 안정됩니다. 10판을 두기 전에는 배치 중으로 표시되고 랭킹에 오르지 않습니다.' },
      { title: '시즌', text: '새 시즌이 시작되면 레이팅이 1500 쪽으로 절반만큼 당겨지고, 다시 빠르게 제자리를 찾아갑니다. 이제 실전에서 만납니다.' },
    ],
  },
];
