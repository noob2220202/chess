import type { Move, Square } from '../types.ts';
import { file, forward, onBoard, other, rank, relRank, sq } from '../types.ts';
import { register } from '../registry.ts';
import { DIAG, KING, KNIGHT, landable, leaps, pawnMove } from '../rules.ts';
import {
  NON_KING, S, adjacent, addEffect, at, centerEmpty, destroy, empty, enemy, homeRank, moved, own, pieceAt, setStatus, summon,
  target, usedCard,
} from './helpers.ts';

/** Own pawn on rank `rr` (relative) and file `f`. */
const ownPawnAt = (s: Parameters<typeof at>[0], o: 'w' | 'b', f: number, rr: number) => {
  const x = sq(f, o === 'w' ? rr : 7 - rr);
  const p = at(s, x);
  return p && p.color === o && p.type === 'P' ? x : -1;
};

/** Is the own king adjacent (8 squares) to `x`? */
const besideKing = (s: Parameters<typeof at>[0], o: 'w' | 'b', x: Square) =>
  s.board.some((p, i) => !!p && p.type === 'K' && p.color === o && adjacent(i, x));

register(
  {
    id: 'light-cavalry', name: '경기병', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '내 나이트는 상하좌우로 두 칸 떨어진 곳으로도 뛸 수 있습니다. 사이에 있는 기물은 뛰어넘습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'N') return [];
      const out: Move[] = [];
      for (const [df, dr] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) {
        const f = file(from) + df, r = rank(from) + dr;
        if (onBoard(f, r) && landable(s, p.color, sq(f, r))) out.push({ from, to: sq(f, r) });
      }
      return out;
    },
    demo: { board: '4k3/8/8/8/3r4/3P4/3N4/4K3', text: 'd2 나이트로 d3 폰을 뛰어넘어 d4의 룩을 잡으세요.', done: '경기병은 직선으로도 두 칸을 뛰어 전장에 빨리 도착합니다.', goal: moved('d2', 'd4') },
  },
  {
    id: 'scout', name: '정찰병', kind: 'passive', category: 'OPENING', stars: 2,
    description: '아직 움직이지 않은 내 폰은 세 칸까지 전진할 수 있습니다. 앞의 칸이 모두 비어 있어야 합니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'P' || relRank(from, p.color) !== 1) return [];
      const d = forward(p.color);
      if (at(s, from + 8 * d) || at(s, from + 16 * d) || at(s, from + 24 * d)) return [];
      return [{ from, to: from + 24 * d }];
    },
    demo: { board: '4k3/8/8/8/8/8/4P3/4K3', text: 'e2 폰을 e5까지 단번에 전진시키세요.', done: '정찰병 폰은 첫걸음에 중앙을 넘어갑니다.', goal: moved('e2', 'e5') },
  },
  {
    id: 'sidestep', name: '사선 보병', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '내 폰은 대각선 앞의 빈칸으로도 한 칸 움직일 수 있습니다. 이 이동으로는 잡을 수 없습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'P') return [];
      const out: Move[] = [];
      const r = rank(from) + forward(p.color);
      for (const df of [-1, 1]) {
        const f = file(from) + df;
        if (onBoard(f, r) && !at(s, sq(f, r))) pawnMove(out, from, sq(f, r), p.color);
      }
      return out;
    },
    demo: { board: '4k3/8/8/8/4p3/8/4P3/4K3', text: 'e4의 상대 폰이 길을 막고 있습니다. e2 폰을 대각선 앞 d3으로 옮기세요.', done: '막힌 폰도 옆 줄로 비켜서 전진할 수 있습니다.', goal: moved('e2', 'd3') },
  },
  {
    id: 'royal-stroll', name: '왕의 행차', kind: 'passive', category: 'OPENING', stars: 2,
    description: '내 킹은 내 첫 줄(백 1랭크·흑 8랭크)에 있는 동안 가로로 두 칸까지 움직일 수 있습니다. 사이 칸이 비어 있어야 합니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'K' || relRank(from, p.color) !== 0) return [];
      const out: Move[] = [];
      for (const df of [-2, 2]) {
        const f = file(from) + df, mid = sq(file(from) + df / 2, rank(from));
        if (onBoard(f, rank(from)) && !at(s, mid) && landable(s, p.color, sq(f, rank(from)))) out.push({ from, to: sq(f, rank(from)) });
      }
      return out;
    },
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '킹을 e1에서 c1로 두 칸 옮기세요.', done: '캐슬링 없이도 킹을 안전한 구석으로 빠르게 옮길 수 있습니다.', goal: moved('e1', 'c1') },
  },
  {
    id: 'guard-muster', name: '근위 소집', kind: 'passive', category: 'OPENING', stars: 3,
    description: '카드를 얻는 즉시 d파일의 내 폰이 근위병이 됩니다. 근위병은 킹처럼 한 칸씩 움직이지만, 잡혀도 패배하지 않습니다.',
    detail: 'd파일에 폰이 없으면 가운데에 가장 가까운 내 폰이 근위병이 됩니다.',
    onAcquire: (s, o) => {
      for (const f of [3, 4, 2, 5, 1, 6, 0, 7]) {
        for (let rr = 1; rr < 7; rr++) {
          const x = ownPawnAt(s, o, f, rr);
          if (x >= 0) { at(s, x)!.type = 'G'; return; }
        }
      }
    },
    demo: { board: '4k3/8/8/8/8/2n5/3P4/4K3', text: 'd2 폰이 근위병이 되었습니다. 대각선 앞 c3의 나이트를 잡으세요.', done: '근위병은 어느 방향으로든 한 칸씩 움직이고 잡습니다.', goal: moved('d2', 'c3') },
  },
  {
    id: 'camel-caravan', name: '낙타 상단', kind: 'passive', category: 'OPENING', stars: 3.5,
    description: '카드를 얻는 즉시 내 진영 셋째 줄(백 3랭크·흑 6랭크)의 가운데에 가까운 빈칸에 낙타가 나타납니다. 낙타는 (1,3) 모양으로 뜁니다.',
    onAcquire: (s, o) => {
      const x = centerEmpty(s, o, 2);
      if (x >= 0) summon(s, x, 'L', o);
    },
    demo: { board: '4k3/8/8/8/6r1/8/8/4K3', text: '3랭크 d3에 낙타가 도착했습니다. 낙타로 g4의 룩을 잡으세요.', done: '낙타는 나이트보다 한 칸 더 멀리 뜁니다.', goal: (_s, a) => a.kind === 'move' && a.piece === 'L' && a.captured === 'R' },
  },
  {
    id: 'iron-pawns', name: '강철 폰', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '내 폰은 상대 나이트에게 잡히지 않습니다.',
    protects: (s, a, t) => at(s, t)?.type === 'P' && at(s, a)?.type === 'N',
    demo: { board: '4k3/8/4n3/8/8/3P4/8/4K3', text: 'e6 나이트가 d4를 노리고 있지만, d3 폰을 d4로 밀어 보세요.', done: '나이트로는 강철 폰을 잡을 수 없습니다.', goal: moved('d3', 'd4') },
  },
  {
    id: 'knight-return', name: '기병 귀환', kind: 'passive', category: 'OPENING', stars: 2,
    description: '내 나이트는 내 첫 줄(백 1랭크·흑 8랭크)의 빈칸 어디로든 돌아갈 수 있습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'N' || relRank(from, p.color) === 0) return [];
      const r = homeRank(p.color), out: Move[] = [];
      for (let f = 0; f < 8; f++) if (!at(s, sq(f, r))) out.push({ from, to: sq(f, r) });
      return out;
    },
    demo: { board: '4k3/8/3N4/2p1p3/8/8/8/4K3', text: 'd6 나이트가 적진 깊숙이 들어가 있습니다. 1랭크의 g1로 바로 돌아오세요.', done: '깊이 들어간 나이트도 한 수에 집으로 돌아옵니다.', goal: moved('d6', 'g1') },
  },
  {
    id: 'hidden-reserve', name: '비밀 예비대', kind: 'passive', category: 'OPENING', stars: 3.5,
    description: '내 15번째 차례가 시작될 때, 내 첫 줄(백 1랭크·흑 8랭크)에서 가운데와 가장 가까운 빈칸에 룩이 나타납니다.',
    detail: '첫 줄에 빈칸이 없으면 바로 앞 줄에 나타납니다.',
    onTurnStart: (s, src) => {
      const me = s.cards[src.owner];
      if (s.turn !== src.owner || me.moves !== 14 || me.flags['hidden-reserve']) return;
      me.flags['hidden-reserve'] = 1;
      let x = centerEmpty(s, src.owner, 0);
      if (x < 0) x = centerEmpty(s, src.owner, 1);
      if (x >= 0) summon(s, x, 'R', src.owner);
    },
    demo: {
      board: '4k3/8/8/8/8/8/4P3/4K3', setup: (s) => { s.cards.w.moves = 13; },
      text: '지금 14수를 둔 상태입니다. 한 수만 더 두면 15번째 차례에 룩이 합류합니다. e2 폰을 움직이세요.',
      done: 'd1에 룩이 나타났습니다. 중반에 갑자기 늘어난 룩 하나가 판을 뒤집습니다.', goal: pieceAt('d1', 'R'),
    },
  },
  {
    id: 'pawn-chain', name: '폰 사슬', kind: 'passive', category: 'OPENING', stars: 3.5,
    description: '대각선 바로 뒤에 다른 내 폰이 있는 내 폰은 잡히지 않습니다.',
    detail: '사슬의 맨 뒤 폰은 보호받지 않습니다. 앞쪽 폰만 단단해집니다.',
    protects: (s, _a, t, src) => {
      if (at(s, t)?.type !== 'P') return false;
      const r = rank(t) - forward(src.owner);
      return [-1, 1].some((df) => {
        const f = file(t) + df;
        const q = onBoard(f, r) ? at(s, sq(f, r)) : null;
        return !!q && q.type === 'P' && q.color === src.owner;
      });
    },
    demo: { board: '4k3/2b5/8/8/8/4P3/5P2/4K3', text: 'c7 비숍이 f4를 노리고 있지만, f2 폰을 f4로 밀어 e3 폰과 사슬을 만드세요.', done: '뒤에서 받쳐 주는 폰이 있으면 앞 폰은 잡히지 않습니다.', goal: moved('f2', 'f4') },
  },
  {
    id: 'fianchetto', name: '피앙케토', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '카드를 얻는 즉시 b·g파일의 내 폰이 한 칸 전진하고, 내 비숍이 상대 차례 6번 동안 방패를 얻습니다.',
    onAcquire: (s, o) => {
      for (const f of [1, 6]) {
        const x = ownPawnAt(s, o, f, 1), to = x + 8 * forward(o);
        if (x >= 0 && !at(s, to)) { s.board[to] = s.board[x]!; s.board[x] = null; s.board[to]!.moved = true; }
      }
      s.board.forEach((p, i) => { if (p && p.color === o && p.type === 'B') setStatus(s, i, 'shield', 12); });
    },
    demo: { board: '4k3/8/8/8/8/8/1P4P1/2B1KB2', text: '길이 열린 f1 비숍을 대각선 끝 a6까지 보내세요.', done: '긴 대각선을 차지한 비숍은 방패까지 둘러 한동안 든든합니다.', goal: moved('f1', 'a6') },
  },
  {
    id: 'shove', name: '밀쳐내기', kind: 'active', category: 'OPENING', stars: 2.5,
    description: '상대 폰 하나를 한 칸 뒤로 밀어냅니다. 그 뒤 칸이 비어 있어야 합니다.',
    targets: [target('밀어낼 상대 폰을 고르세요.', enemy(['P'], (s, o, x) => {
      const to = x + 8 * forward(o);
      return to >= 0 && to < 64 && !at(s, to) && relRank(to, other(o)) >= 1;
    }))],
    activate: (s, o, [x]) => { const to = x! + 8 * forward(o); s.board[to] = s.board[x!]!; s.board[x!] = null; },
    demo: { board: '4k3/8/8/3p4/4P3/8/8/4K3', text: '밀쳐내기로 d5의 상대 폰을 d6으로 밀어낸 뒤, e4 폰을 e5로 전진시키세요.', done: '중앙을 다투던 폰을 밀어내고 공간을 넓혔습니다.', goal: (st, a) => a.kind === 'move' && a.move.from === S('e4') && a.move.to === S('e5') && at(st, S('d6'))?.type === 'P' },
  },
  {
    id: 'twin-towers', name: '쌍둥이 탑', kind: 'passive', category: 'OPENING', stars: 3,
    description: '같은 가로줄에 사이에 기물 없이 연결된 내 룩 두 개는 잡히지 않습니다.',
    protects: (s, _a, t, src) => {
      const p = at(s, t);
      if (!p || (p.type !== 'R' && p.type !== 'C')) return false;
      for (const df of [-1, 1]) {
        let f = file(t) + df;
        while (f >= 0 && f < 8) {
          const q = at(s, sq(f, rank(t)));
          if (q) { if (q.color === src.owner && (q.type === 'R' || q.type === 'C')) return true; break; }
          f += df;
        }
      }
      return false;
    },
    demo: { board: '4k3/8/8/2b5/8/6R1/4K3/R7', text: 'c5 비숍이 g1을 노리고 있지만, g3 룩을 g1로 옮겨 a1 룩과 연결하세요.', done: '연결된 두 룩은 서로를 지켜 잡히지 않습니다.', goal: moved('g3', 'g1') },
  },
  {
    id: 'mobilize', name: '총동원', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '카드를 얻는 즉시 b·g파일의 내 나이트가 c3·f3(흑은 c6·f6)으로 나갑니다. 그 칸이 비어 있어야 합니다.',
    onAcquire: (s, o) => {
      const r0 = homeRank(o), r2 = o === 'w' ? 2 : 5;
      for (const [f0, f1] of [[1, 2], [6, 5]] as const) {
        const p = at(s, sq(f0, r0));
        if (p && p.color === o && p.type === 'N' && !at(s, sq(f1, r2))) { s.board[sq(f1, r2)] = p; s.board[sq(f0, r0)] = null; }
      }
    },
    demo: { board: '4k3/8/8/4r3/8/8/8/1N2K1N1', text: '나이트 둘이 이미 c3·f3에 나와 있습니다. f3 나이트로 e5의 룩을 잡으세요.', done: '전개에 쓸 두 수를 아끼고 바로 싸움을 시작합니다.', goal: moved('f3', 'e5') },
  },
  {
    id: 'sentinel-bishops', name: '파수 비숍', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '내 첫 줄과 둘째 줄(백 1·2랭크, 흑 8·7랭크)에 있는 내 비숍은 잡히지 않습니다.',
    protects: (s, _a, t, src) => {
      const p = at(s, t);
      return !!p && (p.type === 'B' || p.type === 'A') && relRank(t, src.owner) <= 1;
    },
    demo: { board: '4k3/8/8/8/8/6r1/8/4KB2', text: 'g3 룩이 2랭크를 노리지만, f1 비숍을 g2로 옮겨 보세요.', done: '진영 안쪽의 비숍은 든든한 수비수입니다.', goal: moved('f1', 'g2') },
  },
  {
    id: 'smoke-screen', name: '연막', kind: 'active', category: 'OPENING', stars: 2.5,
    description: '상대 차례 2번 동안 상대 비숍·퀸(대주교·아마존 포함)은 대각선으로 움직일 수 없습니다.',
    activate: (s, o) => addEffect(s, 'smoke-screen', o, 4),
    allowMove: (s, m, mover, src) => {
      if (mover === src.owner) return true;
      const p = at(s, m.from);
      if (!p || !['B', 'Q', 'A', 'M'].includes(p.type)) return true;
      const df = Math.abs(file(m.to) - file(m.from)), dr = Math.abs(rank(m.to) - rank(m.from));
      return !(df === dr && df > 0);
    },
    demo: { board: '4k3/8/8/8/8/8/1b6/4K3', text: '“연막” 카드를 써서 b2 비숍의 대각선을 막으세요.', done: '연막이 걷힐 때까지 상대 비숍은 대각선으로 움직이지 못합니다.', goal: usedCard('smoke-screen') },
  },
  {
    id: 'banner', name: '군기', kind: 'passive', category: 'OPENING', stars: 2,
    description: '내 킹 주변 8칸에 있는 내 기물은 상대 폰에게 잡히지 않습니다.',
    protects: (s, a, t, src) => at(s, a)?.type === 'P' && at(s, t)?.type !== 'K' && besideKing(s, src.owner, t),
    demo: { board: '4k3/8/8/8/8/5p2/8/4K1N1', text: 'f3 폰이 e2를 노리지만, g1 나이트를 킹 옆 e2로 옮겨 보세요.', done: '군기 아래 모인 기물은 폰에게 잡히지 않습니다.', goal: moved('g1', 'e2') },
  },
  {
    id: 'pawn-trade', name: '폰 맞교환', kind: 'active', category: 'OPENING', stars: 2,
    description: '내 폰 하나와 상대 폰 하나를 함께 없앱니다.',
    targets: [target('내줄 내 폰을 고르세요.', own(['P'])), target('없앨 상대 폰을 고르세요.', enemy(['P']))],
    activate: (s, _o, [a, b]) => { destroy(s, a!); destroy(s, b!); },
    demo: { board: '4k3/8/8/8/3p4/8/2P5/2R1K3', text: '폰 맞교환으로 c2 폰과 d4 폰을 함께 없애고, 열린 c파일로 룩을 c8까지 보내세요.', done: '폰을 교환해 룩이 달릴 길을 열었습니다.', goal: moved('c1', 'c8') },
  },
  {
    id: 'charge', name: '돌격 나팔', kind: 'active', category: 'OPENING', stars: 2.5,
    description: '앞이 비어 있는 내 폰 두 개를 골라 각각 한 칸씩 전진시킵니다.',
    targets: [
      target('전진시킬 첫 번째 폰을 고르세요.', own(['P'], (s, o, x) => { const to = x + 8 * forward(o); return to >= 0 && to < 64 && relRank(to, o) < 7 && !at(s, to); })),
      target('전진시킬 두 번째 폰을 고르세요.', (s, o, x, [a]) => {
        const p = at(s, x), to = x + 8 * forward(o);
        return x !== a && !!p && p.color === o && p.type === 'P' && to >= 0 && to < 64 && relRank(to, o) < 7 && !at(s, to);
      }),
    ],
    activate: (s, o, sel) => {
      for (const x of sel) { const to = x + 8 * forward(o); s.board[to] = s.board[x]!; s.board[x] = null; s.board[to]!.moved = true; }
    },
    demo: { board: '4k3/8/8/8/8/8/3PP3/4K3', text: '돌격 나팔로 d2·e2 폰을 함께 한 칸 전진시키세요.', done: '한 차례에 폰 두 개가 나아갔습니다. 수는 아직 남아 있습니다.', goal: usedCard('charge') },
  },
  {
    id: 'queen-sortie', name: '퀸 출격', kind: 'passive', category: 'OPENING', stars: 2.5,
    description: '내 퀸이 처음 움직일 때는 나이트처럼 뛸 수도 있습니다.',
    extraMoves: (s, from, p, src) => (p.type === 'Q' && !s.cards[src.owner].flags['queen-sortie'] ? leaps(s, from, p.color, KNIGHT) : []),
    afterMove: (s, ctx, src) => { if (ctx.mover === src.owner && ctx.piece.type === 'Q') s.cards[src.owner].flags['queen-sortie'] = 1; },
    demo: { board: '4k3/8/8/8/8/2r5/8/3QK3', text: 'd1 퀸을 나이트처럼 뛰게 해서 c3의 룩을 잡으세요.', done: '첫 출격만큼은 퀸이 막힌 길도 뛰어넘습니다.', goal: moved('d1', 'c3') },
  },
);

export const OPENING2_LOADED = true;
void DIAG; void KING; void NON_KING; void empty;
