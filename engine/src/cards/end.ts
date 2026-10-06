import type { Move, PieceType } from '../types.ts';
import { file, forward, other, rank, relRank, sq } from '../types.ts';
import { register } from '../registry.ts';
import { DIAG, ORTHO, slides } from '../rules.ts';
import {
  MINORS, NON_PAWN_KING, ROOKISH, S, addEffect, adjacent, at, destroy, empty, enemy, homeRank, moved, own, setStatus,
  summon, target, usedCard,
} from './helpers.ts';

const REVIVABLE: PieceType[] = ['R', 'B', 'N', 'A', 'C', 'L', 'G'];
const CENTER = [S('d4'), S('e4'), S('d5'), S('e5')];

register(
  {
    id: 'promotion-drill', name: '승진 훈련', kind: 'passive', category: 'END', stars: 4,
    description: '내 폰이 7랭크(흑은 2랭크)에 닿으면 바로 퀸으로 승진합니다.',
    afterMove: (s, ctx, src) => {
      if (ctx.mover === src.owner && ctx.piece.type === 'P' && relRank(ctx.move.to, src.owner) === 6) ctx.piece.type = 'Q';
    },
    demo: { board: '4k3/8/1P6/8/8/8/8/4K3', text: 'b6 폰을 b7로 전진시키세요.', done: '한 칸 일찍 퀸이 됐어요!', goal: (s) => at(s, S('b7'))?.type === 'Q' },
  },
  {
    id: 'swift-king', name: '날랜 왕', kind: 'passive', category: 'END', stars: 3,
    description: '내 킹은 사이 칸이 비어 있으면 가로·세로·대각선으로 두 칸까지 움직일 수 있습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'K') return [];
      const out: Move[] = [];
      for (const [df, dr] of [...ORTHO, ...DIAG]) {
        const f1 = file(from) + df, r1 = rank(from) + dr, f2 = f1 + df, r2 = r1 + dr;
        if (f2 < 0 || f2 > 7 || r2 < 0 || r2 > 7 || at(s, sq(f1, r1))) continue;
        const t = at(s, sq(f2, r2));
        if (!t || t.color !== p.color) out.push({ from, to: sq(f2, r2) });
      }
      return out;
    },
    demo: { board: '4k3/8/8/8/8/2r5/8/4K3', text: '킹으로 대각선 두 칸 앞 c3의 룩을 잡으세요.', done: '엔드게임에서 킹이 훨씬 빨라져요.', goal: moved('e1', 'c3') },
  },
  {
    id: 'revive', name: '부활', kind: 'active', category: 'END', stars: 3.5,
    description: '가장 최근에 잡힌 내 룩이나 마이너 기물(대주교·재상 포함) 하나를 내 첫 줄(백 1랭크·흑 8랭크)의 빈칸에 되살립니다.',
    canPlay: (s, o) => s.lost[o].some((t) => REVIVABLE.includes(t)),
    targets: [target('기물을 되살릴 첫 줄의 빈칸을 고르세요.', empty((_s, o, x) => rank(x) === homeRank(o)))],
    activate: (s, o, [x]) => {
      const lost = s.lost[o];
      for (let i = lost.length - 1; i >= 0; i--) {
        if (REVIVABLE.includes(lost[i]!)) { summon(s, x!, lost[i]!, o); lost.splice(i, 1); return; }
      }
    },
    demo: { board: '4k3/8/8/8/8/8/8/4K3', setup: (s) => { s.lost.w.push('R'); }, text: '잡혔던 룩을 부활시켜 1랭크의 빈칸에 놓으세요.', done: '잡혔던 룩이 돌아왔어요.', goal: usedCard('revive') },
  },
  {
    id: 'push', name: '전진 명령', kind: 'active', category: 'END', stars: 3,
    description: '내 폰 하나가 바로 한 칸 전진합니다(앞이 비어 있어야 함). 끝 줄에 닿으면 퀸으로 승진합니다.',
    targets: [target('전진시킬 내 폰을 고르세요.', own(['P'], (s, o, x) => { const to = x + 8 * forward(o); return to >= 0 && to < 64 && !at(s, to); }))],
    activate: (s, o, [x]) => {
      const to = x! + 8 * forward(o), p = at(s, x!)!;
      s.board[to] = p; s.board[x!] = null; p.moved = true;
      if (relRank(to, o) === 7) p.type = 'Q';
    },
    demo: { board: '4k3/1P6/8/8/8/8/8/4K3', text: '전진 명령으로 b7 폰을 승진시킨 뒤, 같은 차례에 수를 하나 더 두세요.', done: '카드로 한 걸음, 수로 한 걸음. 한 차례를 번 셈이에요.', goal: (s, a) => a.kind === 'move' && at(s, S('b8'))?.type === 'Q' },
  },
  {
    id: 'intercept', name: '저지', kind: 'active', category: 'END', stars: 3,
    description: '내 진영(백 기준 1~4랭크)까지 들어온 상대 폰 하나를 없앱니다.',
    targets: [target('내 진영에 들어온 상대 폰을 고르세요.', enemy(['P'], (_s, o, x) => relRank(x, o) <= 3))],
    activate: (s, _o, [x]) => destroy(s, x!),
    demo: { board: '4k3/8/8/8/8/1p6/8/4K3', text: '깊이 들어온 b3 폰을 저지로 없애세요.', done: '승진을 노리던 폰을 막았어요.', goal: usedCard('intercept') },
  },
  {
    id: 'rook-lift', name: '룩 리프트', kind: 'passive', category: 'END', stars: 3,
    description: '내 룩(재상 포함)은 직선으로 움직일 때 내 기물 하나를 통과할 수 있습니다.',
    extraMoves: (s, from, p, src) =>
      p.type === 'R' || p.type === 'C'
        ? slides(s, from, p.color, ORTHO, (x, _at, passed) => x.color === src.owner && passed === 0)
        : [],
    demo: { board: '4k3/8/8/8/r7/8/P7/R3K3', text: 'a1 룩으로 a2 폰을 통과해 a4의 룩을 잡으세요.', done: '갇혀 있던 룩도 앞으로 나설 수 있어요.', goal: moved('a1', 'a4') },
  },
  {
    id: 'bodyguard', name: '호위', kind: 'passive', category: 'END', stars: 4,
    description: '내 킹 주변 8칸에 폰이 아닌 내 기물이 있으면, 킹은 잡히지 않습니다.',
    protects: (s, _a, t, src) => {
      if (at(s, t)?.type !== 'K') return false;
      for (let i = 0; i < 64; i++) {
        const p = at(s, i);
        if (p && p.color === src.owner && NON_PAWN_KING.includes(p.type) && adjacent(i, t)) return true;
      }
      return false;
    },
    demo: { board: '3k4/8/8/8/8/2B5/8/4K2r', text: 'h1 룩이 킹을 노리고 있어요. c3 비숍을 d2로 옮겨 킹 옆에 붙이세요.', done: '호위 기물이 곁에 있는 킹은 잡히지 않아요.', goal: moved('c3', 'd2') },
  },
  {
    id: 'second-wind', name: '기사회생', kind: 'passive', category: 'END', stars: 4.5,
    description: '게임에서 한 번, 내 킹이 잡히는 순간 공격한 기물이 대신 파괴되고 킹은 살아남습니다.',
    saveKing: (s, _a, src) => {
      const f = s.cards[src.owner].flags;
      if (f['second-wind']) return false;
      f['second-wind'] = 1;
      return true;
    },
    demo: { board: '4k3/8/8/8/8/8/8/4R1K1', white: [], black: ['second-wind'], text: '상대가 기사회생을 가지고 있어요. e1 룩으로 e8의 킹을 잡아 보세요.', done: '킹 대신 공격한 룩이 파괴됐어요. 기사회생은 한 번만 발동해요.', goal: (s, a) => a.kind === 'move' && at(s, S('e8'))?.type === 'K' && !at(s, S('e1')) },
  },
  {
    id: 'amazon', name: '아마존', kind: 'active', category: 'END', stars: 4.5,
    description: '내 룩 하나를 희생해서 내 퀸을 아마존(퀸+나이트)으로 바꿉니다.',
    targets: [target('아마존으로 만들 내 퀸을 고르세요.', own(['Q'])), target('희생할 내 룩을 고르세요.', own(ROOKISH))],
    activate: (s, _o, [q, r]) => { at(s, q!)!.type = 'M'; destroy(s, r!); },
    demo: { board: '4k3/8/8/8/8/2r5/8/R2QK3', text: '아마존 카드로 a1 룩을 희생해 퀸을 아마존으로 만든 뒤, 나이트처럼 뛰어 c3의 룩을 잡으세요.', done: '아마존은 퀸과 나이트의 움직임을 모두 가진 가장 강한 기물이에요.', goal: moved('d1', 'c3') },
  },
  {
    id: 'pawn-storm', name: '폰 폭풍', kind: 'active', category: 'END', stars: 3,
    description: '내 진영 셋째 줄(백 3랭크, 흑 6랭크)의 빈칸 두 곳에 내 폰을 놓습니다.',
    targets: [
      target('첫 번째 폰을 놓을 빈칸을 고르세요.', empty((_s, o, x) => relRank(x, o) === 2)),
      target('두 번째 폰을 놓을 빈칸을 고르세요.', (s, o, x, [a]) => x !== a && !at(s, x) && relRank(x, o) === 2),
    ],
    activate: (s, o, [a, b]) => { summon(s, a!, 'P', o); summon(s, b!, 'P', o); },
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '폰 폭풍으로 3랭크에 폰 두 개를 놓으세요.', done: '엔드게임에서 폰 개수 싸움을 뒤집을 수 있어요.', goal: usedCard('pawn-storm') },
  },
  {
    id: 'summit', name: '정상 정복', kind: 'passive', category: 'END', stars: 4,
    description: '내 차례가 시작될 때 내 킹이 가운데 네 칸(d4·e4·d5·e5) 중 하나에 있으면 승리합니다.',
    detail: '킹을 가운데에 올린 뒤, 상대 차례를 한 번 버텨야 합니다.',
    onTurnStart: (s, src) => {
      if (s.turn !== src.owner || s.winner) return;
      const k = CENTER.find((x) => at(s, x)?.type === 'K' && at(s, x)?.color === src.owner);
      if (k !== undefined) { s.winner = src.owner; s.endReason = 'card-win'; }
    },
    demo: { board: '4k3/8/8/8/8/4K3/8/8', text: '킹을 e4로 올리세요. 다음 내 차례가 시작될 때 킹이 가운데에 있으면 승리해요.', done: '정상 정복! 실전에서는 상대에게 킹을 몰아낼 기회가 한 번 있어요.', goal: (s) => s.winner === 'w' },
  },
  {
    id: 'sanctuary', name: '성역', kind: 'active', category: 'END', stars: 2,
    description: '빈칸 하나를 성역으로 정합니다. 상대 차례 4번 동안 상대 기물은 그 칸에 들어올 수 없습니다.',
    targets: [target('성역으로 정할 빈칸을 고르세요.', empty())],
    activate: (s, o, [x]) => addEffect(s, 'sanctuary', o, 8, x),
    allowMove: (_s, m, mover, src) => mover === src.owner || m.to !== src.effect?.square,
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '성역으로 빈칸 하나를 정하세요.', done: '승진할 칸이나 킹이 피할 길을 지킬 수 있어요.', goal: usedCard('sanctuary') },
  },
  {
    id: 'queen-call', name: '여왕 호출', kind: 'active', category: 'END', stars: 3.5,
    description: '퀸(아마존 포함)이 하나도 없을 때, 내 룩 하나를 퀸으로 바꿉니다.',
    canPlay: (s, o) => !s.board.some((p) => p && p.color === o && (p.type === 'Q' || p.type === 'M')),
    targets: [target('퀸으로 바꿀 내 룩을 고르세요.', own(['R']))],
    activate: (s, _o, [x]) => { at(s, x!)!.type = 'Q'; },
    demo: { board: '4k3/8/8/8/8/8/8/R3K3', text: '퀸이 없어요. 여왕 호출로 a1 룩을 퀸으로 바꾸세요.', done: '잃었던 퀸을 되찾았어요.', goal: usedCard('queen-call') },
  },
  {
    id: 'stalwart', name: '불굴', kind: 'passive', category: 'END', stars: 2.5,
    description: '내 폰은 상대 퀸(아마존 포함)에게 잡히지 않습니다.',
    protects: (s, a, t) => at(s, t)?.type === 'P' && (at(s, a)?.type === 'Q' || at(s, a)?.type === 'M'),
    demo: { board: '4k3/8/8/8/q7/8/2P5/4K3', text: 'a4 퀸이 4랭크를 노리고 있지만, c2 폰을 c4로 밀어 보세요.', done: '퀸 혼자서는 폰을 쓸어 담을 수 없어요.', goal: moved('c2', 'c4') },
  },
  {
    id: 'haste', name: '질풍', kind: 'active', category: 'END', stars: 2.5,
    description: '내 킹이 바로 주변 빈칸으로 한 칸 움직입니다.',
    targets: [target('킹이 움직일 주변 빈칸을 고르세요.', empty((s, o, x) => s.board.some((p, i) => !!p && p.type === 'K' && p.color === o && adjacent(i, x))))],
    activate: (s, o, [x]) => {
      const k = s.board.findIndex((p) => !!p && p.type === 'K' && p.color === o);
      s.board[x!] = s.board[k]!; s.board[k] = null; s.board[x!]!.moved = true;
    },
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '질풍으로 킹을 한 칸 옮긴 뒤, 같은 차례에 킹을 한 번 더 움직이세요.', done: '킹이 한 차례에 두 걸음 걸었어요.', goal: (_s, a) => a.kind === 'move' && a.piece === 'K' },
  },
  {
    id: 'liquidate', name: '청산', kind: 'active', category: 'END', stars: 2,
    description: '내 룩 하나와 상대 룩 하나를 함께 없앱니다(재상 포함).',
    targets: [target('내줄 내 룩을 고르세요.', own(ROOKISH)), target('없앨 상대 룩을 고르세요.', enemy(ROOKISH))],
    activate: (s, _o, [a, b]) => { destroy(s, a!); destroy(s, b!); },
    demo: { board: '4k2r/8/8/8/8/8/8/R3K3', text: '청산으로 a1 룩과 h8 룩을 함께 없애세요.', done: '판이 단순해져 엔드게임을 이끌기 쉬워져요.', goal: usedCard('liquidate') },
  },
  {
    id: 'long-reach', name: '장창', kind: 'passive', category: 'END', stars: 3,
    description: '내 킹은 가로·세로로 두 칸 떨어진 상대 기물을, 사이 칸이 비어 있으면 잡을 수 있습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'K') return [];
      const out: Move[] = [];
      for (const [df, dr] of ORTHO) {
        const f1 = file(from) + df, r1 = rank(from) + dr, f2 = f1 + df, r2 = r1 + dr;
        if (f2 < 0 || f2 > 7 || r2 < 0 || r2 > 7 || at(s, sq(f1, r1))) continue;
        const t = at(s, sq(f2, r2));
        if (t && t.color !== p.color) out.push({ from, to: sq(f2, r2) });
      }
      return out;
    },
    demo: { board: '4k3/8/8/8/8/4n3/8/4K3', text: '킹으로 두 칸 앞 e3의 나이트를 잡으세요.', done: '킹이 긴 창으로 멀리 있는 기물을 찔렀어요.', goal: moved('e1', 'e3') },
  },
  {
    id: 'stasis', name: '정지장', kind: 'active', category: 'END', stars: 2.5,
    description: '판 위의 모든 폰(양쪽 모두)이 양쪽 차례가 두 번씩 지날 때까지 얼어붙습니다.',
    activate: (s) => { s.board.forEach((p, i) => { if (p && p.type === 'P') setStatus(s, i, 'frozen', 4); }); },
    demo: { board: '4k3/pp6/8/8/8/8/PP6/4K3', text: '정지장을 써서 모든 폰을 멈추세요.', done: '상대 폰이 승진하러 달려가는 걸 멈출 수 있어요.', goal: usedCard('stasis') },
  },
  {
    id: 'shadow', name: '그림자', kind: 'active', category: 'END', stars: 3,
    description: '내 킹과, 폰이 아닌 내 기물 하나의 자리를 맞바꿉니다.',
    targets: [target('킹과 자리를 바꿀 내 기물을 고르세요.', own(NON_PAWN_KING))],
    activate: (s, o, [x]) => {
      const k = s.board.findIndex((p) => !!p && p.type === 'K' && p.color === o);
      const t = s.board[k]!; s.board[k] = s.board[x!]!; s.board[x!] = t; t.moved = true;
    },
    demo: { board: '4k3/8/8/8/8/8/8/R3K2r', text: '그림자로 킹과 a1 룩의 자리를 바꾸세요.', done: '킹이 순식간에 반대편으로 숨었어요.', goal: usedCard('shadow') },
  },
  {
    id: 'last-push', name: '최후 돌격', kind: 'active', category: 'END', stars: 3,
    description: '상대 진영(백 기준 5랭크 이상)에 있는 내 폰 하나가 빈칸으로 최대 두 칸 전진합니다. 끝 줄에 닿으면 퀸으로 승진합니다.',
    targets: [
      target('상대 진영에 있는 내 폰을 고르세요.', own(['P'], (_s, o, x) => relRank(x, o) >= 4)),
      target('앞으로 한두 칸 떨어진 도착 칸을 고르세요.', (s, o, x, [a]) => {
        const d = forward(o);
        if (file(x) !== file(a!) || at(s, x)) return false;
        const steps = (rank(x) - rank(a!)) * d;
        return steps === 1 || (steps === 2 && !at(s, a! + 8 * d));
      }),
    ],
    activate: (s, o, [a, b]) => {
      const p = at(s, a!)!;
      s.board[b!] = p; s.board[a!] = null; p.moved = true;
      if (relRank(b!, o) === 7) p.type = 'Q';
    },
    demo: { board: '4k3/8/8/1P6/8/8/8/4K3', text: '최후 돌격으로 b5 폰을 b7까지 보내세요.', done: '두 칸을 단숨에 달렸어요.', goal: usedCard('last-push') },
  },
);

export const END_LOADED = true;
void other; void MINORS; void addEffect;
