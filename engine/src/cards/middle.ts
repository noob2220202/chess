import type { Square } from '../types.ts';
import { file, forward, other, rank, relRank, sq } from '../types.ts';
import { register } from '../registry.ts';
import { ORTHO, captureSquare, slides } from '../rules.ts';
import {
  MINORS, NON_KING, NON_PAWN_KING, ROOKISH, addEffect, adjacent, at, chebyshev, destroy, empty, enemy, homeRank,
  moved, own, setStatus, summon, target, usedCard,
} from './helpers.ts';

register(
  {
    id: 'conscript', name: '징병', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '내 폰 하나를 나이트로 바꿉니다.',
    targets: [target('나이트로 바꿀 내 폰을 고르세요.', own(['P']))],
    activate: (s, _o, [x]) => { at(s, x!)!.type = 'N'; },
    demo: { board: '4k3/8/8/8/8/2r5/P7/4K3', text: '“징병” 카드를 눌러 a2 폰을 나이트로 바꾸고, 같은 차례에 그 나이트로 c3의 룩을 잡으세요.', done: '카드를 써도 차례가 넘어가지 않아요. 같은 차례에 수를 바로 둘 수 있어요.', goal: moved('a2', 'c3') },
  },
  {
    id: 'snipe', name: '저격', kind: 'active', category: 'MIDDLE', stars: 3,
    description: '상대 폰 하나를 없앱니다.',
    targets: [target('없앨 상대 폰을 고르세요.', enemy(['P']))],
    activate: (s, _o, [x]) => destroy(s, x!),
    demo: { board: '4k3/8/8/8/3p4/8/3P4/4K3', text: '“저격” 카드를 눌러 d4의 상대 폰을 없애세요.', done: '길을 막던 폰이 사라졌어요.', goal: usedCard('snipe') },
  },
  {
    id: 'aegis', name: '방패', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '킹이 아닌 내 기물 하나에 방패를 씌웁니다. 그 기물은 상대 차례 3번 동안 잡히지 않습니다.',
    targets: [target('방패를 씌울 내 기물을 고르세요.', own(NON_KING))],
    activate: (s, _o, [x]) => setStatus(s, x!, 'shield', 6),
    demo: { board: '4k3/8/8/8/3r4/8/8/3QK3', text: 'd4 룩이 d1 퀸을 노리고 있어요. 퀸에게 방패를 씌우세요.', done: '방패를 두른 기물에는 파란 테두리가 생겨요.', goal: usedCard('aegis') },
  },
  {
    id: 'freeze', name: '빙결', kind: 'active', category: 'MIDDLE', stars: 3,
    description: '킹이 아닌 상대 기물 하나를 상대 차례 2번 동안 얼립니다. 얼어붙은 기물은 움직일 수 없지만, 잡을 수는 있습니다.',
    targets: [target('얼릴 상대 기물을 고르세요.', enemy(NON_KING))],
    activate: (s, _o, [x]) => setStatus(s, x!, 'frozen', 4),
    demo: { board: '4k3/8/8/8/8/8/8/r3K3', text: 'a1 룩이 킹을 노리고 있어요. 빙결로 룩을 얼리세요.', done: '얼어붙은 룩은 상대의 다음 두 차례 동안 움직일 수 없어요.', goal: usedCard('freeze') },
  },
  {
    id: 'swap', name: '위치 교환', kind: 'active', category: 'MIDDLE', stars: 3,
    description: '킹이 아닌 내 기물 두 개의 자리를 맞바꿉니다. 폰은 1랭크나 8랭크로 옮길 수 없습니다.',
    targets: [
      target('자리를 바꿀 첫 번째 내 기물을 고르세요.', own(NON_KING)),
      target('자리를 바꿀 두 번째 내 기물을 고르세요.', (s, o, x, [a]) => {
        const p = at(s, x), q = at(s, a!);
        if (!p || !q || p.color !== o || p.type === 'K' || x === a) return false;
        const bad = (t: string, to: Square) => t === 'P' && (rank(to) === 0 || rank(to) === 7);
        return !bad(q.type, x) && !bad(p.type, a!);
      }),
    ],
    activate: (s, _o, [a, b]) => { const t = s.board[a!]!; s.board[a!] = s.board[b!]!; s.board[b!] = t; },
    demo: { board: '4k3/8/8/8/8/8/8/R2NK3', text: '위치 교환으로 a1 룩과 d1 나이트의 자리를 바꾸세요.', done: '룩은 가운데로, 나이트는 구석으로 옮겨졌어요.', goal: usedCard('swap') },
  },
  {
    id: 'retreat', name: '후퇴 명령', kind: 'active', category: 'MIDDLE', stars: 2,
    description: '폰과 킹을 뺀 내 기물 하나를 내 첫 줄(백 1랭크·흑 8랭크)의 빈칸으로 바로 옮깁니다.',
    targets: [
      target('후퇴시킬 내 기물을 고르세요.', own(NON_PAWN_KING)),
      target('내 첫 줄에서 도착할 빈칸을 고르세요.', empty((_s, o, x) => rank(x) === homeRank(o))),
    ],
    activate: (s, _o, [a, b]) => { s.board[b!] = s.board[a!]!; s.board[a!] = null; },
    demo: { board: '4k3/8/8/3Q4/2p1p3/8/8/4K3', text: '퀸이 너무 깊이 들어가 있어요. 후퇴 명령으로 퀸을 1랭크의 빈칸으로 데려오세요.', done: '위험한 기물을 한 번에 안전한 곳으로 뺄 수 있어요.', goal: usedCard('retreat') },
  },
  {
    id: 'ordain', name: '서임', kind: 'active', category: 'MIDDLE', stars: 4,
    description: '내 비숍 하나를 대주교(비숍+나이트)로 바꿉니다.',
    targets: [target('대주교로 만들 내 비숍을 고르세요.', own(['B']))],
    activate: (s, _o, [x]) => { at(s, x!)!.type = 'A'; },
    demo: { board: '4k3/8/8/8/4r3/8/3B4/4K3', text: '서임으로 d2 비숍을 대주교로 바꾸고, 나이트처럼 뛰어 e4의 룩을 잡으세요.', done: '대주교는 비숍과 나이트를 합친 강력한 기물이에요.', goal: moved('d2', 'e4') },
  },
  {
    id: 'commission', name: '위임', kind: 'active', category: 'MIDDLE', stars: 4,
    description: '내 룩 하나를 재상(룩+나이트)으로 바꿉니다.',
    targets: [target('재상으로 만들 내 룩을 고르세요.', own(['R']))],
    activate: (s, _o, [x]) => { at(s, x!)!.type = 'C'; },
    demo: { board: '4k3/8/8/8/8/1r6/8/R3K3', text: '위임으로 a1 룩을 재상으로 바꾸고, 나이트처럼 뛰어 b3의 룩을 잡으세요.', done: '재상은 룩과 나이트를 합친 기물이에요.', goal: moved('a1', 'b3') },
  },
  {
    id: 'reinforce', name: '증원', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '내 진영의 둘째·셋째 줄(백 2·3랭크, 흑 7·6랭크) 빈칸 하나에 내 폰을 놓습니다.',
    targets: [target('폰을 놓을 빈칸을 고르세요.', empty((_s, o, x) => relRank(x, o) === 1 || relRank(x, o) === 2))],
    activate: (s, o, [x]) => summon(s, x!, 'P', o),
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '증원으로 2랭크나 3랭크의 빈칸에 폰을 놓으세요.', done: '비어 있던 폰 자리를 메울 수 있어요.', goal: usedCard('reinforce') },
  },
  {
    id: 'provoke', name: '도발', kind: 'active', category: 'MIDDLE', stars: 3,
    description: '상대는 다음 차례에 잡을 수 있는 기물이 있으면 반드시 잡아야 합니다.',
    filterMoves: (s, color, moves, src) => {
      if (color === src.owner) return moves;
      const caps = moves.filter((m) => captureSquare(s, m) >= 0);
      return caps.length ? caps : moves;
    },
    activate: (s, o) => addEffect(s, 'provoke', o, 2),
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '“도발” 카드를 써 보세요. 상대는 다음 차례에 잡을 수 있는 수가 있으면 반드시 잡아야 해요.', done: '미끼를 던져 상대 기물을 원하는 칸으로 끌어낼 수 있어요.', goal: usedCard('provoke') },
  },
  {
    id: 'rally', name: '집결', kind: 'active', category: 'MIDDLE', stars: 3,
    description: '내 진영(백 1~4랭크, 흑 8~5랭크)에 있는 내 폰이 모두, 앞이 비어 있으면 한 칸씩 전진합니다.',
    activate: (s, o) => {
      const d = forward(o);
      const xs: Square[] = [];
      for (let i = 0; i < 64; i++) {
        const p = at(s, i);
        if (p && p.color === o && p.type === 'P' && relRank(i, o) <= 3) xs.push(i);
      }
      xs.sort((a, b) => relRank(b, o) - relRank(a, o));
      for (const x of xs) {
        const to = x + 8 * d;
        if (!at(s, to)) { s.board[to] = s.board[x]!; s.board[x] = null; s.board[to]!.moved = true; }
      }
    },
    demo: { board: '4k3/8/8/8/8/8/PPP5/4K3', text: '집결을 써서 폰들을 한꺼번에 전진시키세요.', done: '카드 한 장으로 폰 여러 개가 동시에 움직였어요.', goal: usedCard('rally') },
  },
  {
    id: 'exchange', name: '맞교환', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '내 마이너 기물 하나와 상대 마이너 기물 하나를 함께 없앱니다.',
    detail: '마이너 기물: 나이트, 비숍, 낙타, 근위병',
    targets: [target('내줄 내 마이너 기물을 고르세요.', own(MINORS)), target('없앨 상대 마이너 기물을 고르세요.', enemy(MINORS))],
    activate: (s, _o, [a, b]) => { destroy(s, a!); destroy(s, b!); },
    demo: { board: '4k3/8/8/3n4/8/8/8/2B1K3', text: '맞교환으로 c1 비숍과 d5 나이트를 함께 없애세요.', done: '까다로운 상대 기물을 맞바꿔 정리했어요.', goal: usedCard('exchange') },
  },
  {
    id: 'cold-snap', name: '한파', kind: 'active', category: 'MIDDLE', stars: 3,
    description: '내 기물 하나를 고르면, 그 주변 8칸에 있는 상대 기물(킹 제외)이 상대의 다음 차례 동안 얼어붙습니다.',
    targets: [target('한파의 중심이 될 내 기물을 고르세요.', own())],
    activate: (s, o, [c]) => {
      for (let i = 0; i < 64; i++) {
        const p = at(s, i);
        if (p && p.color === other(o) && p.type !== 'K' && adjacent(i, c!)) setStatus(s, i, 'frozen', 2);
      }
    },
    demo: { board: '4k3/8/8/2rnb3/3N4/8/8/4K3', text: 'd4 나이트를 중심으로 한파를 써서 주변의 상대 기물을 얼리세요.', done: '얼어붙은 기물은 상대의 다음 차례에 움직일 수 없어요.', goal: usedCard('cold-snap') },
  },
  {
    id: 'bastion', name: '보루', kind: 'active', category: 'MIDDLE', stars: 2,
    description: '내 룩(재상 포함) 하나가 상대 차례 4번 동안 잡히지 않습니다. 대신 그동안 움직일 수 없습니다.',
    targets: [target('보루로 만들 내 룩을 고르세요.', own(ROOKISH))],
    activate: (s, _o, [x]) => { setStatus(s, x!, 'shield', 8); setStatus(s, x!, 'frozen', 8); },
    demo: { board: '4k3/8/8/8/8/8/1q6/R3K3', text: 'b2 퀸이 a1 룩을 노리고 있어요. 보루로 룩을 지키세요.', done: '움직이지 못하는 대신 단단한 벽이 됐어요.', goal: usedCard('bastion') },
  },
  {
    id: 'royal-escape', name: '왕의 도피', kind: 'active', category: 'MIDDLE', stars: 3,
    description: '내 킹을 내 첫 줄(백 1랭크·흑 8랭크)의 빈칸으로 바로 옮깁니다.',
    targets: [target('킹이 피할 첫 줄의 빈칸을 고르세요.', empty((_s, o, x) => rank(x) === homeRank(o)))],
    activate: (s, o, [x]) => {
      for (let i = 0; i < 64; i++) {
        const p = at(s, i);
        if (p && p.color === o && p.type === 'K') { s.board[x!] = p; s.board[i] = null; p.moved = true; return; }
      }
    },
    demo: { board: '4k3/8/8/8/3q4/8/4K3/8', text: '퀸이 킹을 노리고 있어요. 왕의 도피로 킹을 1랭크로 피신시키세요.', done: '위기에 빠진 킹을 한 번에 뒤로 뺐어요.', goal: usedCard('royal-escape') },
  },
  {
    id: 'fork-master', name: '포크 장인', kind: 'passive', category: 'MIDDLE', stars: 2.5,
    description: '내 나이트는 폰에게 잡히지 않습니다.',
    protects: (s, a, t) => at(s, t)?.type === 'N' && at(s, a)?.type === 'P',
    demo: { board: '4k3/8/8/2p1p3/8/8/2N5/4K3', text: 'c5·e5 폰이 d4를 지키고 있지만, 나이트를 d4로 보내 보세요.', done: '폰으로 쫓아낼 수 없는 나이트는 든든한 거점이 돼요.', goal: moved('c2', 'd4') },
  },
  {
    id: 'rook-cannon', name: '포격 룩', kind: 'passive', category: 'MIDDLE', stars: 3.5,
    description: '내 룩(재상 포함)은 같은 줄의 기물 하나를 뛰어넘어, 그 너머 첫 번째 상대 기물을 잡을 수 있습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'R' && p.type !== 'C') return [];
      const out = [];
      for (const [df, dr] of ORTHO) {
        let f = file(from) + df, r = rank(from) + dr, screen = false;
        while (f >= 0 && f < 8 && r >= 0 && r < 8) {
          const t = at(s, sq(f, r));
          if (t) {
            if (!screen) screen = true;
            else { if (t.color !== p.color) out.push({ from, to: sq(f, r) }); break; }
          }
          f += df; r += dr;
        }
      }
      return out;
    },
    demo: { board: '4k3/8/8/4r3/8/4P3/8/4R1K1', text: 'e1 룩으로 e3 폰을 뛰어넘어 e5의 룩을 잡으세요.', done: '앞이 막힌 룩도 장기의 포처럼 공격할 수 있어요.', goal: moved('e1', 'e5') },
  },
  {
    id: 'mine', name: '지뢰', kind: 'active', category: 'MIDDLE', stars: 3,
    description: '상대 진영(백 기준 5~8랭크)의 빈칸에 지뢰를 묻습니다. 그 칸에 처음 들어온 상대 기물(킹 제외)은 파괴됩니다.',
    detail: '지뢰는 양쪽 모두에게 보이고, 내 기물에는 반응하지 않습니다.',
    targets: [target('지뢰를 묻을 상대 진영의 빈칸을 고르세요.', empty((s, o, x) => relRank(x, o) >= 4 && !s.effects.some((e) => e.card === 'mine' && e.square === x && e.until > s.ply)))],
    activate: (s, o, [x]) => addEffect(s, 'mine', o, 1e9 - s.ply, x),
    afterMove: (s, ctx, src) => {
      const e = src.effect;
      if (!e || ctx.mover === src.owner || ctx.move.to !== e.square || ctx.piece.type === 'K') return;
      destroy(s, ctx.move.to);
      e.until = s.ply;
    },
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '상대 진영의 빈칸 하나에 지뢰를 묻으세요.', done: '상대 기물이 그 칸을 밟으면 파괴돼요.', goal: usedCard('mine') },
  },
  {
    id: 'blink', name: '점멸', kind: 'active', category: 'MIDDLE', stars: 3.5,
    description: '내 마이너 기물 하나를 두 칸 이내의 빈칸으로 순간이동시킵니다.',
    targets: [
      target('순간이동할 내 마이너 기물을 고르세요.', own(MINORS)),
      target('두 칸 이내에서 도착할 빈칸을 고르세요.', (s, _o, x, [a]) => !at(s, x) && chebyshev(a!, x) <= 2),
    ],
    activate: (s, _o, [a, b]) => { s.board[b!] = s.board[a!]!; s.board[a!] = null; },
    demo: { board: '4k3/8/8/8/8/8/8/2B1K3', text: '점멸로 c1 비숍을 두 칸 이내의 빈칸으로 옮기세요.', done: '비숍이 다른 색 칸으로 옮겨 갈 수도 있어요.', goal: usedCard('blink') },
  },
  {
    id: 'disarm', name: '무장해제', kind: 'active', category: 'MIDDLE', stars: 2.5,
    description: '킹이 아닌 상대 기물 하나는 상대 차례 3번 동안 아무것도 잡을 수 없습니다. 움직이는 것은 가능합니다.',
    targets: [target('무장해제할 상대 기물을 고르세요.', enemy(NON_KING))],
    activate: (s, _o, [x]) => setStatus(s, x!, 'disarmed', 6),
    demo: { board: '4k3/8/8/8/8/8/2q5/3QK3', text: 'c2 퀸이 위협적이에요. 퀸을 무장해제하세요.', done: '무장해제된 기물은 한동안 아무것도 잡지 못해요.', goal: usedCard('disarm') },
  },
);

export const MIDDLE_LOADED = true;
void slides;
