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
}
export interface Lesson { id: string; title: string; summary: string; steps: LessonStep[] }

const S = parseSquare;
const moved = (from: string, to: string) => (_s: GameState, a: DemoAction) => a.kind === 'move' && a.move.from === S(from) && a.move.to === S(to);

export const LESSONS: Lesson[] = [
  {
    id: 'basics', title: '킹을 잡으면 승리', summary: '체크가 없는 체스의 승리 조건',
    steps: [
      {
        title: '목표는 킹을 잡는 것', board: '4k3/8/8/8/4R3/8/8/4K3',
        text: '증강전에는 체크메이트가 없습니다. 상대 킹을 직접 잡으면 바로 이깁니다. e4의 룩으로 e8의 킹을 잡으세요.',
        done: '승리! 킹을 잡는 순간 게임이 끝납니다.', goal: (_s, a) => a.kind === 'move' && a.captured === 'K',
      },
      {
        title: '체크 경고가 없습니다', board: '4k3/8/8/8/8/8/3q4/4K3',
        text: '상대 퀸이 킹 바로 옆까지 왔습니다. 증강전은 "체크" 경고를 띄우지 않으니, 위험은 직접 살펴야 합니다. 킹으로 d2의 퀸을 잡으세요.',
        done: '좋습니다. 킹이 잡히는 칸으로도 움직일 수 있으니, 수를 두기 전에 상대의 공격을 꼭 확인하세요.', goal: moved('e1', 'd2'),
      },
      {
        title: '상대 공격 범위 보기', board: '4k3/8/8/8/1b6/8/8/4K3',
        text: '상대 기물을 누르면, 그 기물이 갈 수 있는 칸이 빨간 점선으로 보입니다. b4 비숍을 눌러 확인한 뒤, 킹을 공격받지 않는 칸으로 옮기세요.',
        done: '안전합니다! 상대 기물을 눌러 공격 범위를 확인하는 습관을 들이세요.',
        goal: (s, a) => a.kind === 'move' && a.piece === 'K' && !attacks(s, 'b').has(findKing(s, 'w')),
      },
      {
        title: '무승부와 패배',
        text: '같은 국면이 세 번 나오거나, 양쪽 합쳐 100수 동안 기물을 잡지도 폰을 움직이지도 않거나, 300수에 도달하면 무승부입니다. 둘 수 있는 수가 하나도 없으면 그쪽이 집니다.',
      },
    ],
  },
  {
    id: 'pieces', title: '새로운 기물', summary: '대주교 · 재상 · 아마존 · 낙타 · 근위병',
    steps: [
      { title: '대주교', board: '4k3/8/8/8/8/3r4/8/2A1K3', text: '대주교는 비숍과 나이트를 합친 기물입니다. 오른쪽 아래의 작은 나이트 배지로 알아볼 수 있습니다. c1에서 나이트처럼 뛰어 d3의 룩을 잡으세요.', done: '대주교는 대각선으로도 가고, 나이트처럼 뛰기도 합니다.', goal: moved('c1', 'd3') },
      { title: '재상', board: '4k3/8/8/8/8/6r1/8/4K2C', text: '재상은 룩과 나이트를 합친 기물입니다. h1에서 나이트처럼 뛰어 g3의 룩을 잡으세요.', done: '재상은 직선으로도 가고, 나이트처럼 뛰기도 합니다.', goal: moved('h1', 'g3') },
      { title: '아마존', board: '4k3/8/8/8/8/2r5/8/3MK3', text: '아마존은 퀸과 나이트를 합친, 가장 강한 기물입니다. d1에서 나이트처럼 뛰어 c3의 룩을 잡으세요.', done: '아마존은 거의 모든 방향을 노릴 수 있습니다.', goal: moved('d1', 'c3') },
      { title: '낙타', board: '4k3/8/8/8/1r6/8/8/L3K3', text: '낙타는 "낙" 배지가 붙은 기물로, (1,3) 모양으로 뜁니다. a1에서 b4로 뛰어 룩을 잡으세요.', done: '낙타는 늘 같은 색 칸에만 머무르는 점프 기물입니다.', goal: moved('a1', 'b4') },
      { title: '근위병', board: '4k3/8/8/8/8/8/Gp6/4K3', text: '근위병은 "근" 배지가 붙은 기물입니다. 킹처럼 모든 방향으로 한 칸씩 움직이지만, 잡혀도 지지 않습니다. 옆으로 움직여 b2의 폰을 잡으세요.', done: '근위병은 폰보다 자유롭게 움직이는 수비수입니다.', goal: moved('a2', 'b2') },
    ],
  },
  {
    id: 'draft', title: '증강 카드 고르기', summary: '언제, 어떤 카드를 고릅니까',
    steps: [
      { title: '드래프트는 세 번', text: '내 0번째, 10번째, 20번째 수를 두기 직전에 카드 3장이 나오고, 그중 한 장을 고릅니다. 첫 번째는 오프닝, 두 번째는 미들게임, 세 번째는 엔드게임 카드입니다. 카드를 고르는 동안에도 내 시계는 흘러갑니다.' },
      { title: '직접 골라 보기', draft: ['sprint', 'knight-king', 'lancers'], text: '세 장 중 마음에 드는 카드를 한 장 고르세요. ★이 많을수록 강하지만, 그만큼 드물게 나옵니다.', done: '카드를 얻었습니다! 패시브 카드는 얻는 즉시 효과가 생기고 끝까지 유지됩니다.' },
      { title: '같은 카드로 겨루기', text: '레이팅전에서는 두 사람이 매번 똑같은 카드 3장 중에서 고릅니다. 이걸 "미러 드래프트"라고 합니다. 카드 운이 아니라 선택과 운영으로 실력을 겨루게 됩니다.' },
    ],
  },
  {
    id: 'active', title: '액티브 카드', summary: '차례를 쓰지 않는 한 번짜리 능력',
    steps: [
      { title: '카드 쓰고 수 두기', board: '4k3/8/8/8/8/2r5/P7/4K3', white: ['conscript'], text: '내 카드에서 “징병”을 누른 뒤 a2 폰을 고르세요. 폰이 나이트로 바뀌면, 같은 차례에 그 나이트로 c3의 룩을 잡으세요.', done: '액티브 카드를 써도 차례는 넘어가지 않습니다. 다만 한 차례에 한 장만 쓸 수 있습니다.', goal: moved('a2', 'c3') },
      { title: '상대 기물 얼리기', board: '4k3/8/8/8/8/8/8/r3K3', white: ['freeze'], text: 'a1의 룩이 킹을 노리고 있습니다. “빙결” 카드로 룩을 얼리세요. 얼어붙은 기물은 하늘색 얼음으로 덮이고, 남은 차례 수가 숫자로 표시됩니다.', done: '얼어붙은 기물은 정해진 동안 움직이지 못합니다. 대신 잡을 수는 있습니다.', goal: (_s, a) => a.kind === 'card' && a.id === 'freeze' },
    ],
  },
  {
    id: 'passive', title: '패시브 카드', summary: '항상 켜져 있는 규칙 변화',
    steps: [
      { title: '움직임이 바뀌는 카드', board: '4k3/8/8/8/8/5r2/8/4K3', white: ['knight-king'], text: '“기사왕” 카드를 가지고 있어서, 킹이 나이트처럼 뛸 수 있습니다. 킹으로 f3의 룩을 잡으세요.', done: '패시브 카드는 따로 쓰지 않아도 항상 적용됩니다.', goal: moved('e1', 'f3') },
      { title: '잡는 방법이 바뀌는 카드', board: '4k3/8/8/4r3/8/4P3/8/4R1K1', white: ['rook-cannon'], text: '“포격 룩” 카드가 있으면, 룩이 기물 하나를 뛰어넘어 그 너머를 잡을 수 있습니다. e1의 룩으로 e5의 룩을 잡으세요.', done: '상대의 패시브 카드도 늘 확인하세요. 상대 이름 옆의 작은 카드 아이콘을 누르면 볼 수 있습니다.', goal: moved('e1', 'e5') },
    ],
  },
  {
    id: 'status', title: '상태 효과 읽기', summary: '방패 · 빙결 · 무장해제 · 지뢰',
    steps: [
      { title: '방패', board: '4k3/8/8/8/3r4/8/8/3QK3', white: ['aegis'], text: 'd4의 룩이 퀸을 노리고 있습니다. “방패” 카드로 퀸을 지키세요. 파란 원이 생긴 기물은 잡히지 않습니다.', done: '왼쪽 위의 숫자는 효과가 남은 차례 수입니다.', goal: (_s, a) => a.kind === 'card' && a.id === 'aegis' },
      { title: '표시 한눈에 보기', text: '파란 원은 방패(잡히지 않음), 하늘색 얼음은 빙결(움직일 수 없음), 빨간 표시는 무장해제(잡을 수 없음)입니다. 빨간 구슬은 지뢰, 초록 빗금 칸은 성역(상대가 들어올 수 없음), 노란 테두리 칸은 정상 정복 칸입니다.' },
    ],
  },
  {
    id: 'ranked', title: '레이팅전 안내', summary: '시간, 매칭, 점수',
    steps: [
      { title: '시간 규칙', text: '레이팅전은 10분에, 수를 둘 때마다 5초가 더해집니다. 카드를 고르고 쓰는 시간도 내 시계에서 빠집니다. 시간이 다 떨어지면 집니다.' },
      { title: '대국 취소', text: '대국이 시작되고 30초 안에 첫 수를 두지 않으면 대국이 취소됩니다. 취소된 대국은 레이팅에 반영되지 않습니다.' },
      { title: '레이팅', text: '레이팅은 Glicko-2 방식으로 계산합니다. 1500에서 시작해 처음에는 크게 오르내리고, 판이 쌓일수록 안정됩니다. 10판을 두기 전에는 "배치 중"으로 표시되고 랭킹에 오르지 않습니다.' },
      { title: '시즌', text: '새 시즌이 시작되면 레이팅이 1500 쪽으로 절반만큼 당겨지고, 다시 빠르게 제자리를 찾아갑니다. 이제 실전에서 만납니다!' },
    ],
  },
];
