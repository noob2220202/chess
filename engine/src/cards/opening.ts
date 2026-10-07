import type { Color, GameState, Move, Square } from '../types.ts';
import { file, forward, other, rank, relRank, sq } from '../types.ts';
import { register } from '../registry.ts';
import { CAMEL, KNIGHT, ORTHO, DIAG, leaps, pawnMove, slides } from '../rules.ts';
import { S, at, centerEmpty, destroy, homeRank, moved, orthAdjacent, pieceAt, setStatus, summon } from './helpers.ts';

/** Convert the first own piece of `type` found on `prefer` squares (then anywhere). */
function convertFirst(s: GameState, o: Color, type: 'B' | 'R', to: 'A' | 'C', prefer: Square[]): void {
  const cands = [...prefer, ...Array.from({ length: 64 }, (_, i) => i)];
  for (const x of cands) {
    const p = at(s, x);
    if (p && p.color === o && p.type === type) { p.type = to; return; }
  }
}
/** Remove the own knight on its home square for file `f` (b or g), else the nearest own knight. */
const absorbKnight = (s: GameState, o: Color, f: number): void => {
  const home = sq(f, homeRank(o));
  if (at(s, home)?.type === 'N' && at(s, home)?.color === o) return destroy(s, home);
  for (let i = 0; i < 64; i++) {
    const p = at(s, i);
    if (p && p.color === o && p.type === 'N') return destroy(s, i);
  }
};

register(
  {
    id: 'sprint', name: '질주', kind: 'passive', category: 'OPENING', stars: 3,
    description: '내 폰은 어느 줄에서든 두 칸 전진할 수 있습니다.',
    detail: '앞의 두 칸이 모두 비어 있어야 하고, 이 이동으로는 기물을 잡을 수 없습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'P' || relRank(from, p.color) === 1) return [];
      const d = forward(p.color), r2 = rank(from) + 2 * d;
      if (r2 < 0 || r2 > 7 || at(s, from + 8 * d) || at(s, sq(file(from), r2))) return [];
      const out: Move[] = [];
      pawnMove(out, from, sq(file(from), r2), p.color);
      return out;
    },
    demo: { board: '4k3/8/8/8/8/3P4/8/4K3', text: 'd3 폰을 d5까지 두 칸 전진시키세요.', done: '이미 움직인 폰도 두 칸씩 나아갈 수 있습니다.', goal: moved('d3', 'd5') },
  },
  {
    id: 'knight-king', name: '기사왕', kind: 'passive', category: 'OPENING', stars: 3,
    description: '내 킹이 나이트처럼 뛸 수도 있습니다.',
    extraMoves: (s, from, p) => (p.type === 'K' ? leaps(s, from, p.color, KNIGHT) : []),
    demo: { board: '4k3/8/8/8/8/5r2/8/4K3', text: '킹을 나이트처럼 뛰게 해서 f3의 룩을 잡으세요.', done: '킹이 나이트처럼 뛰었습니다. 다만 킹이 앞으로 나갈수록 그만큼 위험해집니다.', goal: moved('e1', 'f3') },
  },
  {
    id: 'trench', name: '참호', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '상대 폰은 두 칸 전진할 수 없습니다.',
    allowMove: (s, m, mover, src) => {
      if (mover === src.owner) return true;
      const p = at(s, m.from);
      return !(p && p.type === 'P' && Math.abs(m.to - m.from) === 16);
    },
    demo: { board: '4k3/8/8/8/8/8/4P3/4K3', white: [], black: ['trench'], text: '상대가 참호를 가지고 있습니다. e2 폰을 눌러 두 칸 전진이 막힌 걸 확인한 뒤, e3으로 한 칸 전진하세요.', done: '참호는 상대 폰이 빠르게 올라오는 걸 막아 줍니다.', goal: moved('e2', 'e3') },
  },
  {
    id: 'royal-guard', name: '근위대', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '내 킹은 폰에게 잡히지 않습니다.',
    protects: (s, a, t) => at(s, t)?.type === 'K' && at(s, a)?.type === 'P',
    demo: { board: '4k3/8/8/2p5/8/4K3/8/8', text: 'c5의 폰이 d4를 노리고 있습니다. 그래도 킹을 d4로 옮겨 보세요.', done: '근위대가 있으면 폰은 킹을 잡을 수 없습니다.', goal: moved('e3', 'd4') },
  },
  {
    id: 'archbishop', name: '대주교 서임', kind: 'passive', category: 'OPENING', stars: 3.5,
    description: '카드를 얻는 즉시, 퀸 쪽 비숍이 퀸 쪽 나이트를 흡수해 대주교(비숍+나이트)가 됩니다.',
    detail: '흡수한 나이트는 판에서 사라집니다. 나이트가 없으면 비숍만 대주교가 됩니다.',
    onAcquire: (s, o) => {
      convertFirst(s, o, 'B', 'A', [sq(2, homeRank(o))]);
      absorbKnight(s, o, 1);
    },
    demo: { board: '4k3/8/8/8/8/3r4/8/1NB1K3', text: 'b1 나이트를 흡수해서 c1 비숍이 대주교가 되었습니다. 나이트처럼 뛰어 d3의 룩을 잡으세요.', done: '대주교는 비숍처럼도, 나이트처럼도 움직입니다.', goal: moved('c1', 'd3') },
  },
  {
    id: 'chancellor', name: '재상 임명', kind: 'passive', category: 'OPENING', stars: 3.5,
    description: '카드를 얻는 즉시, 킹 쪽 룩이 킹 쪽 나이트를 흡수해 재상(룩+나이트)이 됩니다.',
    detail: '흡수한 나이트는 판에서 사라집니다. 나이트가 없으면 룩만 재상이 됩니다.',
    onAcquire: (s, o) => {
      convertFirst(s, o, 'R', 'C', [sq(7, homeRank(o))]);
      absorbKnight(s, o, 6);
    },
    demo: { board: '4k3/8/8/8/8/6r1/8/4K1NR', text: 'g1 나이트를 흡수해서 h1 룩이 재상이 되었습니다. 나이트처럼 뛰어 g3의 룩을 잡으세요.', done: '재상은 룩처럼도, 나이트처럼도 움직입니다.', goal: moved('h1', 'g3') },
  },
  {
    id: 'outriders', name: '척후병', kind: 'passive', category: 'OPENING', stars: 3,
    description: '카드를 얻는 즉시 a·h파일의 내 폰이 근위병이 됩니다. 근위병은 킹처럼 한 칸씩 움직이지만, 잡혀도 패배하지 않습니다.',
    onAcquire: (s, o) => {
      for (let i = 0; i < 64; i++) {
        const p = at(s, i);
        if (p && p.color === o && p.type === 'P' && (file(i) === 0 || file(i) === 7)) p.type = 'G';
      }
    },
    demo: { board: '4k3/8/8/8/8/8/Pp6/4K3', text: 'a2 폰이 근위병이 되었습니다. 옆으로 한 칸 움직여 b2의 폰을 잡으세요.', done: '근위병은 모든 방향으로 한 칸씩 움직이고 잡을 수 있습니다.', goal: moved('a2', 'b2') },
  },
  {
    id: 'phase-bishop', name: '투과 사격', kind: 'passive', category: 'OPENING', stars: 3,
    description: '내 비숍(대주교 포함)은 대각선으로 움직일 때 내 폰을 통과할 수 있습니다.',
    extraMoves: (s, from, p, src) =>
      p.type === 'B' || p.type === 'A'
        ? slides(s, from, p.color, DIAG, (x) => x.color === src.owner && x.type === 'P')
        : [],
    demo: { board: '4k3/8/8/5r2/8/3P4/8/1B2K3', text: 'b1 비숍으로 d3의 내 폰을 통과해 f5의 룩을 잡으세요.', done: '폰 뒤에 있는 비숍도 바로 공격할 수 있습니다.', goal: moved('b1', 'f5') },
  },
  {
    id: 'lancers', name: '창병', kind: 'passive', category: 'OPENING', stars: 3,
    description: '내 폰은 바로 앞 칸의 상대 기물도 잡을 수 있습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'P') return [];
      const to = from + 8 * forward(p.color);
      const t = to >= 0 && to < 64 ? at(s, to) : null;
      const out: Move[] = [];
      if (t && t.color !== p.color) pawnMove(out, from, to, p.color);
      return out;
    },
    demo: { board: '4k3/8/8/8/4n3/4P3/8/4K3', text: 'e3 폰으로 바로 앞 e4의 나이트를 잡으세요.', done: '창병 폰은 앞이 막혀도 정면을 찔러 뚫을 수 있습니다.', goal: moved('e3', 'e4') },
  },
  {
    id: 'wazir-knights', name: '기사 훈련', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '내 나이트는 상하좌우로 한 칸 움직이거나 잡을 수도 있습니다.',
    extraMoves: (s, from, p) => (p.type === 'N' ? leaps(s, from, p.color, ORTHO) : []),
    demo: { board: '4k3/8/8/8/8/8/3Nr3/4K3', text: 'd2 나이트로 바로 옆 e2의 룩을 잡으세요.', done: '이제 나이트가 바로 옆 칸도 지킬 수 있습니다.', goal: moved('d2', 'e2') },
  },
  {
    id: 'reserve-knight', name: '예비 기병', kind: 'passive', category: 'OPENING', stars: 3,
    description: '내 7번째 차례가 시작될 때, 내 첫 줄(백 1랭크·흑 8랭크)에서 가운데와 가장 가까운 빈칸에 나이트가 나타납니다.',
    detail: '첫 줄에 빈칸이 없으면 바로 앞 줄에 나타납니다.',
    onTurnStart: (s, src) => {
      const me = s.cards[src.owner];
      if (s.turn !== src.owner || me.moves !== 6 || me.flags['reserve-knight']) return;
      me.flags['reserve-knight'] = 1;
      let x = centerEmpty(s, src.owner, 0);
      if (x < 0) x = centerEmpty(s, src.owner, 1);
      if (x >= 0) summon(s, x, 'N', src.owner);
    },
    demo: {
      board: '4k3/8/8/8/8/8/4P3/4K3', setup: (s) => { s.cards.w.moves = 5; },
      text: '지금 6수를 둔 상태입니다. 한 수만 더 두면 7번째 차례에 나이트가 합류합니다. e2 폰을 움직이세요.',
      done: 'd1에 예비 기병이 도착했습니다.', goal: pieceAt('d1', 'N'),
    },
  },
  {
    id: 'pawn-shield', name: '방패병', kind: 'passive', category: 'OPENING', stars: 2,
    description: '카드를 얻는 즉시 d·e파일의 내 폰에 방패가 생겨, 상대 차례 8번 동안 잡히지 않습니다.',
    onAcquire: (s, o) => {
      for (let i = 0; i < 64; i++) {
        const p = at(s, i);
        if (p && p.color === o && p.type === 'P' && (file(i) === 3 || file(i) === 4)) setStatus(s, i, 'shield', 16);
      }
    },
    demo: { board: '4k3/8/8/2b5/8/8/3PP3/4K3', text: 'c5 비숍이 d4를 노리고 있지만, 방패를 두른 d2 폰을 d4로 밀어 보세요.', done: '방패가 있는 동안 폰은 잡히지 않습니다. 중앙을 안전하게 차지하세요.', goal: moved('d2', 'd4') },
  },
  {
    id: 'iron-rooks', name: '철옹성', kind: 'passive', category: 'OPENING', stars: 3,
    description: '내 룩(재상 포함)은 내 첫 줄(백 1랭크·흑 8랭크)에 있는 동안 잡히지 않습니다.',
    protects: (s, _a, t, src) => {
      const p = at(s, t);
      return !!p && (p.type === 'R' || p.type === 'C') && relRank(t, src.owner) === 0;
    },
    demo: { board: '4k3/8/8/8/8/4K3/8/R6r', text: 'h1의 상대 룩이 1랭크를 노리고 있습니다. 그래도 a1 룩을 d1로 옮겨 보세요.', done: '첫 줄에 있는 룩은 잡히지 않습니다.', goal: moved('a1', 'd1') },
  },
  {
    id: 'vanguard', name: '선봉대', kind: 'passive', category: 'OPENING', stars: 2,
    description: '카드를 얻는 즉시, c·d·e·f파일에서 아직 움직이지 않은 내 폰이 한 칸씩 전진합니다.',
    onAcquire: (s, o) => {
      for (const f of [2, 3, 4, 5]) {
        const x = sq(f, o === 'w' ? 1 : 6), to = x + 8 * forward(o);
        const p = at(s, x);
        if (p && p.color === o && p.type === 'P' && !at(s, to)) { s.board[to] = p; s.board[x] = null; p.moved = true; }
      }
    },
    demo: { board: '4k3/8/8/8/8/8/2PPPP2/4K3', text: '가운데 폰 네 개가 이미 한 칸씩 나와 있습니다. 아무 폰이나 한 칸 더 전진시키세요.', done: '선봉대로 중앙 공간을 먼저 차지했습니다.', goal: (_s, a) => a.kind === 'move' && a.piece === 'P' },
  },
  {
    id: 'guardian-pawns', name: '호위병', kind: 'passive', category: 'OPENING', stars: 3,
    description: '내 킹과 상하좌우로 맞닿은 내 폰은 잡히지 않습니다.',
    protects: (s, _a, t, src) => {
      if (at(s, t)?.type !== 'P') return false;
      for (let i = 0; i < 64; i++) {
        const k = at(s, i);
        if (k && k.type === 'K' && k.color === src.owner) return orthAdjacent(i, t);
      }
      return false;
    },
    demo: { board: '4k3/8/8/1b6/8/3P4/8/4K3', text: 'b5 비숍이 d3 폰을 노립니다. 킹을 d2로 옮겨 폰 바로 아래에 붙이세요.', done: '킹과 맞닿은 폰은 잡히지 않습니다.', goal: moved('e1', 'd2') },
  },
  {
    id: 'camel-knights', name: '낙타 기병', kind: 'passive', category: 'OPENING', stars: 4,
    description: '내 나이트는 낙타처럼 (1,3) 모양으로도 뛸 수 있습니다.',
    extraMoves: (s, from, p) => (p.type === 'N' ? leaps(s, from, p.color, CAMEL) : []),
    demo: { board: '4k3/8/8/8/1r6/8/8/N3K3', text: 'a1 나이트를 (1,3) 모양으로 뛰게 해서 b4의 룩을 잡으세요.', done: '나이트가 닿는 거리가 크게 늘어났습니다.', goal: moved('a1', 'b4') },
  },
  {
    id: 'queen-guard', name: '여왕 친위대', kind: 'passive', category: 'OPENING', stars: 2,
    description: '내 퀸은 폰에게 잡히지 않습니다.',
    protects: (s, a, t) => at(s, t)?.type === 'Q' && at(s, a)?.type === 'P',
    demo: { board: '4k3/8/8/2p5/8/8/8/3QK3', text: 'c5 폰이 d4를 노리고 있지만, 퀸을 d4로 옮겨 보세요.', done: '폰으로 퀸을 쫓아낼 수 없으니, 퀸이 일찍부터 활약할 수 있습니다.', goal: moved('d1', 'd4') },
  },
  {
    id: 'bishop-pair', name: '쌍비숍', kind: 'passive', category: 'OPENING', stars: 3,
    description: '내 비숍이 둘 이상 있으면, 비숍이 상하좌우로 한 칸 움직이거나 잡을 수도 있습니다.',
    extraMoves: (s, from, p, src) => {
      if (p.type !== 'B') return [];
      const n = s.board.filter((x) => x && x.color === src.owner && x.type === 'B').length;
      return n >= 2 ? leaps(s, from, p.color, ORTHO) : [];
    },
    demo: { board: '4k3/8/8/8/8/8/2r5/2B1KB2', text: 'c1 비숍으로 바로 위 c2의 룩을 잡으세요.', done: '비숍 둘을 지키면 한 가지 색 칸에만 묶이지 않습니다.', goal: moved('c1', 'c2') },
  },
  {
    id: 'flank-march', name: '측면 행군', kind: 'passive', category: 'OPENING', stars: 2,
    description: 'a·h파일의 내 폰은 옆 빈칸으로 한 칸 이동할 수 있습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'P' || (file(from) !== 0 && file(from) !== 7)) return [];
      const to = file(from) === 0 ? from + 1 : from - 1;
      return at(s, to) ? [] : [{ from, to }];
    },
    demo: { board: '4k3/8/8/8/8/8/P7/4K3', text: 'a2 폰을 옆 칸 b2로 옮기세요.', done: '가장자리 폰을 가운데 쪽으로 옮길 수 있습니다.', goal: moved('a2', 'b2') },
  },
  {
    id: 'fortified-center', name: '중앙 요새', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '상대 기물은 내 요새 칸(백은 d3·e3, 흑은 d6·e6)에 들어올 수 없습니다.',
    detail: '그 칸에 서 있는 킹을 잡는 수는 막지 못합니다.',
    allowMove: (s, m, mover, src) => {
      if (mover === src.owner) return true;
      if (relRank(m.to, src.owner) !== 2 || (file(m.to) !== 3 && file(m.to) !== 4)) return true;
      return at(s, m.to)?.type === 'K';
    },
    demo: { board: '4k3/8/8/8/5N2/8/8/4K3', white: [], black: ['fortified-center'], text: '상대가 중앙 요새를 가지고 있어서 f4 나이트는 e6으로 갈 수 없습니다. 대신 d5로 옮기세요.', done: '요새 칸에는 상대가 거점을 만들 수 없습니다.', goal: moved('f4', 'd5') },
  },
);

export const OPENING_LOADED = true;
void other; void S;
