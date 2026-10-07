import type { Move } from '../types.ts';
import { file, forward, onBoard, other, rank, relRank, sq } from '../types.ts';
import { register } from '../registry.ts';
import { DIAG, KNIGHT, captureSquare, leaps, pawnMove } from '../rules.ts';
import {
  MINORS, ROOKISH, S, addEffect, at, centerEmpty, destroy, empty, enemy, moved, own, pieceAt, setStatus, summon, target,
  usedCard,
} from './helpers.ts';

const isKnightJump = (a: number, b: number) => {
  const df = Math.abs(file(a) - file(b)), dr = Math.abs(rank(a) - rank(b));
  return (df === 1 && dr === 2) || (df === 2 && dr === 1);
};

register(
  {
    id: 'double-time', name: '연속 행동', kind: 'active', category: 'MIDDLE', stars: 4,
    description: '이번 차례에 수를 둔 뒤 한 번 더 둡니다. 두 번째 수로는 기물을 잡을 수 없습니다.',
    activate: (s, o) => addEffect(s, 'double-time', o, 2),
    keepTurn: (s, mover, src) => mover === src.owner && !!src.effect && s.ply === src.effect.until - 2,
    filterMoves: (s, color, moves, src) =>
      color === src.owner && src.effect && s.ply === src.effect.until - 1 ? moves.filter((m) => captureSquare(s, m) < 0) : moves,
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '“연속 행동” 카드를 쓰세요. 실전에서는 이번 차례에 수를 두 번 둡니다.', done: '두 번째 수로는 잡을 수 없지만, 기물 둘을 한꺼번에 움직일 수 있습니다.', goal: usedCard('double-time') },
  },
  {
    id: 'transfigure', name: '변신술', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '내 나이트 하나를 비숍으로, 또는 비숍 하나를 나이트로 바꿉니다.',
    targets: [target('바꿀 내 나이트나 비숍을 고르세요.', own(['N', 'B']))],
    activate: (s, _o, [x]) => { const p = at(s, x!)!; p.type = p.type === 'N' ? 'B' : 'N'; },
    demo: { board: '4k3/8/8/8/8/3r4/8/2B1K3', text: '변신술로 c1 비숍을 나이트로 바꾸고, 그 나이트로 d3의 룩을 잡으세요.', done: '상황에 맞게 기물의 성질을 바꿀 수 있습니다.', goal: moved('c1', 'd3') },
  },
  {
    id: 'promote-guard', name: '근위병 승격', kind: 'active', category: 'MIDDLE', stars: 2,
    description: '내 폰 하나를 근위병으로 바꿉니다. 근위병은 킹처럼 한 칸씩 움직이지만, 잡혀도 패배하지 않습니다.',
    targets: [target('근위병으로 만들 내 폰을 고르세요.', own(['P']))],
    activate: (s, _o, [x]) => { at(s, x!)!.type = 'G'; },
    demo: { board: '4k3/8/8/8/8/8/3Pr3/4K3', text: 'd2 폰을 근위병으로 바꾸고, 바로 옆 e2의 룩을 잡으세요.', done: '폰이 옆과 뒤로도 움직이는 근위병이 되었습니다.', goal: moved('d2', 'e2') },
  },
  {
    id: 'camel-mount', name: '낙타 조련', kind: 'active', category: 'MIDDLE', stars: 2,
    description: '내 폰 하나를 낙타로 바꿉니다. 낙타는 (1,3) 모양으로 뜁니다.',
    targets: [target('낙타로 만들 내 폰을 고르세요.', own(['P']))],
    activate: (s, _o, [x]) => { at(s, x!)!.type = 'L'; },
    demo: { board: '4k3/8/8/4r3/8/8/3P4/4K3', text: 'd2 폰을 낙타로 바꾸고, (1,3) 모양으로 뛰어 e5의 룩을 잡으세요.', done: '느린 폰이 멀리 뛰는 낙타가 되었습니다.', goal: moved('d2', 'e5') },
  },
  {
    id: 'rook-teleport', name: '성채 이동', kind: 'active', category: 'MIDDLE', stars: 3.5,
    description: '내 룩(재상 포함) 하나를 같은 가로줄이나 세로줄의 빈칸 어디로든 옮깁니다. 사이에 기물이 있어도 됩니다.',
    targets: [
      target('옮길 내 룩을 고르세요.', own(ROOKISH)),
      target('같은 줄에서 도착할 빈칸을 고르세요.', (s, _o, x, [a]) => !at(s, x) && (file(x) === file(a!) || rank(x) === rank(a!))),
    ],
    activate: (s, _o, [a, b]) => { s.board[b!] = s.board[a!]!; s.board[a!] = null; },
    demo: { board: '4k3/8/8/8/8/8/PPP5/R3K3', text: '폰 뒤에 갇힌 a1 룩을 성채 이동으로 a7까지 보내세요.', done: '막힌 룩을 단번에 적진 깊숙이 들여보냈습니다.', goal: pieceAt('a7', 'R') },
  },
  {
    id: 'lightning', name: '낙뢰', kind: 'active', category: 'MIDDLE', stars: 4,
    description: '상대 진영(백 기준 5~8랭크)에 있는 상대 마이너 기물 하나를 없앱니다.',
    detail: '마이너 기물: 나이트, 비숍, 낙타, 근위병',
    targets: [target('없앨 상대 진영의 마이너 기물을 고르세요.', enemy(MINORS, (_s, o, x) => relRank(x, o) >= 4))],
    activate: (s, _o, [x]) => destroy(s, x!),
    demo: { board: '4k3/8/2n5/8/8/8/8/4K3', text: '낙뢰로 c6의 나이트를 없애세요.', done: '수비하던 기물이 사라져 상대 진영에 구멍이 났습니다.', goal: usedCard('lightning') },
  },
  {
    id: 'sacrifice', name: '희생', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '내 마이너 기물 하나를 없애고, 그 대가로 상대 폰 두 개를 없앱니다.',
    targets: [
      target('희생할 내 마이너 기물을 고르세요.', own(MINORS)),
      target('없앨 첫 번째 상대 폰을 고르세요.', enemy(['P'])),
      target('없앨 두 번째 상대 폰을 고르세요.', (s, o, x, [, b]) => x !== b && enemy(['P'])(s, o, x)),
    ],
    activate: (s, _o, [a, b, c]) => { destroy(s, a!); destroy(s, b!); destroy(s, c!); },
    demo: { board: '4k3/3pp3/8/8/8/8/8/2B1K3', text: '희생으로 c1 비숍을 바치고, 킹 앞의 d7·e7 폰을 없애세요.', done: '기물 하나로 상대 킹의 방어벽을 허물었습니다.', goal: usedCard('sacrifice') },
  },
  {
    id: 'quicksand', name: '늪', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '빈칸 하나를 늪으로 만듭니다. 그 칸에 처음 들어온 상대 기물(킹 제외)은 상대 차례 3번 동안 얼어붙습니다.',
    detail: '늪은 양쪽 모두에게 보이고, 한 번 발동하면 사라집니다.',
    targets: [target('늪으로 만들 빈칸을 고르세요.', empty((s, _o, x) => !s.effects.some((e) => e.card === 'quicksand' && e.square === x && e.until > s.ply)))],
    activate: (s, o, [x]) => addEffect(s, 'quicksand', o, 1e9 - s.ply, x),
    afterMove: (s, ctx, src) => {
      const e = src.effect;
      if (!e || ctx.mover === src.owner || ctx.move.to !== e.square || ctx.piece.type === 'K') return;
      setStatus(s, ctx.move.to, 'frozen', 6);
      e.until = s.ply;
    },
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '빈칸 하나를 늪으로 만드세요.', done: '상대 기물이 그 칸을 밟으면 한동안 움직이지 못합니다.', goal: usedCard('quicksand') },
  },
  {
    id: 'forward-base', name: '전진 기지', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '판 가운데 두 줄(4·5랭크)의 빈칸 하나에 내 폰을 놓습니다.',
    targets: [target('폰을 놓을 4·5랭크의 빈칸을 고르세요.', empty((_s, o, x) => relRank(x, o) === 3 || relRank(x, o) === 4))],
    activate: (s, o, [x]) => summon(s, x!, 'P', o),
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '전진 기지로 판 가운데에 폰을 놓으세요.', done: '중앙에 거점이 생겼습니다.', goal: usedCard('forward-base') },
  },
  {
    id: 'veteran', name: '백전노장', kind: 'passive', category: 'MIDDLE', stars: 3,
    description: '상대 기물을 잡은 내 폰은 근위병이 됩니다. 승진하는 경우는 제외합니다.',
    afterMove: (_s, ctx, src) => {
      if (ctx.mover === src.owner && ctx.captured && ctx.piece.type === 'P') ctx.piece.type = 'G';
    },
    demo: { board: '4k3/8/8/8/3r4/4P3/8/4K3', text: 'e3 폰으로 d4의 룩을 잡으세요.', done: '전투를 치른 폰이 근위병으로 거듭났습니다.', goal: pieceAt('d4', 'G') },
  },
  {
    id: 'battle-promotion', name: '전공', kind: 'passive', category: 'MIDDLE', stars: 3.5,
    description: '상대 기물을 잡은 내 비숍은 대주교(비숍+나이트)가 됩니다.',
    afterMove: (_s, ctx, src) => {
      if (ctx.mover === src.owner && ctx.captured && ctx.piece.type === 'B') ctx.piece.type = 'A';
    },
    demo: { board: '4k3/8/8/1r6/8/8/8/4KB2', text: 'f1 비숍으로 b5의 룩을 잡으세요.', done: '공을 세운 비숍이 대주교로 승진했습니다.', goal: pieceAt('b5', 'A') },
  },
  {
    id: 'counterattack', name: '반격', kind: 'passive', category: 'MIDDLE', stars: 2.5,
    description: '상대 폰이 내 기물을 잡으면, 그 폰도 함께 파괴됩니다.',
    afterMove: (s, ctx, src) => {
      if (ctx.mover !== src.owner && ctx.captured?.color === src.owner && ctx.piece.type === 'P') destroy(s, ctx.move.to);
    },
    demo: { board: '4k3/8/8/3n4/4P3/8/8/4K3', white: [], black: ['counterattack'], text: '상대가 반격을 가지고 있습니다. e4 폰으로 d5의 나이트를 잡아 보세요.', done: '나이트를 잡은 폰도 함께 사라졌습니다. 폰으로 쉽게 이득을 볼 수 없습니다.', goal: (s, a) => a.kind === 'move' && a.captured === 'N' && !at(s, S('d5')) },
  },
  {
    id: 'repel', name: '격퇴', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '내 진영(백 기준 1~4랭크)에 들어온 상대 마이너 기물 하나를 상대의 첫 줄 빈칸으로 돌려보냅니다.',
    detail: '가운데에 가장 가까운 빈칸으로 돌아갑니다.',
    targets: [target('돌려보낼 상대 마이너 기물을 고르세요.', enemy(MINORS, (s, o, x) => relRank(x, o) <= 3 && centerEmpty(s, other(o), 0) >= 0))],
    activate: (s, o, [x]) => {
      const to = centerEmpty(s, other(o), 0);
      s.board[to] = s.board[x!]!; s.board[x!] = null;
    },
    demo: { board: '4k3/8/8/8/8/3n4/8/4K3', text: 'd3까지 들어온 나이트를 격퇴로 돌려보내세요.', done: '침입한 나이트가 처음 자리로 돌아갔습니다.', goal: usedCard('repel') },
  },
  {
    id: 'sky-horse', name: '천마', kind: 'passive', category: 'MIDDLE', stars: 2.5,
    description: '내 나이트는 대각선으로 두 칸 떨어진 빈칸으로도 뛸 수 있습니다. 이 이동으로는 잡을 수 없습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'N') return [];
      const out: Move[] = [];
      for (const [df, dr] of DIAG) {
        const f = file(from) + 2 * df, r = rank(from) + 2 * dr;
        if (onBoard(f, r) && !at(s, sq(f, r))) out.push({ from, to: sq(f, r) });
      }
      return out;
    },
    demo: { board: '4k3/8/8/8/8/8/8/3NK3', text: 'd1 나이트를 대각선 두 칸 앞 f3으로 뛰게 하세요.', done: '나이트가 닿을 수 있는 칸이 늘어났습니다.', goal: moved('d1', 'f3') },
  },
  {
    id: 'tank', name: '전차', kind: 'passive', category: 'MIDDLE', stars: 3,
    description: '내 룩(재상 포함)은 대각선으로 한 칸 움직이거나 잡을 수도 있습니다.',
    extraMoves: (s, from, p) => (p.type === 'R' || p.type === 'C' ? leaps(s, from, p.color, DIAG) : []),
    demo: { board: '4k3/8/8/8/8/8/1n6/R3K3', text: 'a1 룩으로 대각선 b2의 나이트를 잡으세요.', done: '룩의 약점이던 대각선 한 칸을 메웠습니다.', goal: moved('a1', 'b2') },
  },
  {
    id: 'silence', name: '침묵', kind: 'active', category: 'MIDDLE', stars: 3,
    description: '상대는 상대 차례 3번 동안 액티브 카드를 쓸 수 없습니다.',
    activate: (s, o) => addEffect(s, 'silence', o, 6),
    blocksCards: (_s, color, src) => color !== src.owner,
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '“침묵” 카드를 써서 상대의 카드를 봉인하세요.', done: '상대는 한동안 액티브 카드를 쓸 수 없습니다.', goal: usedCard('silence') },
  },
  {
    id: 'march-order', name: '행군 명령', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '내 나이트 하나를 나이트가 뛸 수 있는 빈칸으로 바로 옮깁니다. 그 뒤에 수를 둘 수 있습니다.',
    targets: [
      target('옮길 내 나이트를 고르세요.', own(['N'])),
      target('도착할 빈칸을 고르세요.', (s, _o, x, [a]) => !at(s, x) && isKnightJump(a!, x)),
    ],
    activate: (s, _o, [a, b]) => { s.board[b!] = s.board[a!]!; s.board[a!] = null; },
    demo: { board: '4k3/8/8/8/4r3/8/8/1N2K3', text: '행군 명령으로 b1 나이트를 c3으로 옮긴 뒤, 그 나이트로 e4의 룩을 잡으세요.', done: '나이트가 한 차례에 두 번 뛰었습니다.', goal: (st, a) => a.kind === 'move' && a.move.from === S('c3') && a.move.to === S('e4') && st.cards.w.used.includes('march-order') },
  },
  {
    id: 'consecrate', name: '축성', kind: 'active', category: 'MIDDLE', stars: 4,
    description: '내 나이트 하나를 대주교(비숍+나이트)로 바꿉니다.',
    targets: [target('대주교로 만들 내 나이트를 고르세요.', own(['N']))],
    activate: (s, _o, [x]) => { at(s, x!)!.type = 'A'; },
    demo: { board: '4k3/8/8/8/4r3/8/8/1N2K3', text: '축성으로 b1 나이트를 대주교로 바꾸고, 비숍처럼 대각선으로 e4의 룩을 잡으세요.', done: '나이트가 대각선까지 다스리는 대주교가 되었습니다.', goal: (st, a) => a.kind === 'move' && a.move.from === S('b1') && a.move.to === S('e4') && st.cards.w.used.includes('consecrate') },
  },
  {
    id: 'leapfrog', name: '개구리 뜀', kind: 'passive', category: 'MIDDLE', stars: 2.5,
    description: '내 폰은 바로 앞의 기물을 뛰어넘어 그다음 빈칸으로 전진할 수 있습니다. 이 이동으로는 잡을 수 없습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'P') return [];
      const d = forward(p.color), r1 = rank(from) + d, r2 = r1 + d;
      if (r2 < 0 || r2 > 7 || !at(s, sq(file(from), r1)) || at(s, sq(file(from), r2))) return [];
      const out: Move[] = [];
      pawnMove(out, from, sq(file(from), r2), p.color);
      return out;
    },
    demo: { board: '4k3/8/8/8/8/4p3/4P3/4K3', text: 'e3의 폰이 앞을 막고 있습니다. e2 폰으로 뛰어넘어 e4로 가세요.', done: '막힌 폰도 앞 기물을 넘어 전진합니다.', goal: moved('e2', 'e4') },
  },
  {
    id: 'iron-curtain', name: '철의 장막', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '상대 차례 2번 동안 상대 기물은 내 진영(백 기준 1~4랭크)으로 들어올 수 없습니다.',
    detail: '이미 내 진영에 있는 상대 기물은 계속 움직일 수 있고, 체크는 막지 못합니다.',
    activate: (s, o) => addEffect(s, 'iron-curtain', o, 4),
    allowMove: (s, m, mover, src) =>
      mover === src.owner || relRank(m.to, src.owner) > 3 || relRank(m.from, src.owner) <= 3 || at(s, m.to)?.type === 'K',
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '“철의 장막” 카드를 써서 내 진영을 닫으세요.', done: '상대 기물은 두 차례 동안 내 진영으로 넘어오지 못합니다.', goal: usedCard('iron-curtain') },
  },
);

export const MIDDLE2_LOADED = true;
void KNIGHT;
