import type { Move } from '../types.ts';
import { file, forward, onBoard, other, rank, relRank, sq } from '../types.ts';
import { register } from '../registry.ts';
import { DIAG } from '../rules.ts';
import {
  MINORS, ROOKISH, S, addEffect, adjacent, at, destroy, empty, enemy, moved, own, orthAdjacent, setStatus, summon, target,
  usedCard,
} from './helpers.ts';

const kingSq = (s: Parameters<typeof at>[0], o: 'w' | 'b') => s.board.findIndex((p) => !!p && p.type === 'K' && p.color === o);

register(
  {
    id: 'promote-deep', name: '현장 승격', kind: 'active', category: 'END', stars: 4,
    description: '상대 진영 깊숙이(백 기준 6·7랭크) 들어간 내 폰 하나를 퀸으로 바꿉니다.',
    targets: [target('퀸으로 만들 내 폰을 고르세요.', own(['P'], (_s, o, x) => relRank(x, o) >= 5))],
    activate: (s, _o, [x]) => { at(s, x!)!.type = 'Q'; },
    demo: { board: '4k3/8/1P6/8/8/8/8/4K3', text: '현장 승격으로 b6 폰을 바로 퀸으로 바꾸세요.', done: '끝 줄까지 가지 않고도 퀸을 얻었습니다.', goal: usedCard('promote-deep') },
  },
  {
    id: 'king-armor', name: '왕의 갑옷', kind: 'active', category: 'END', stars: 3.5,
    description: '내 킹이 상대 차례 2번 동안 잡히지 않습니다.',
    activate: (s, o) => setStatus(s, kingSq(s, o), 'shield', 4),
    demo: { board: '4k3/8/8/8/8/8/8/r3K3', text: 'a1 룩이 킹을 노리고 있습니다. 왕의 갑옷으로 킹을 지키세요.', done: '갑옷을 두른 킹은 두 차례 동안 잡히지 않습니다. 그동안 반격을 준비하세요.', goal: usedCard('king-armor') },
  },
  {
    id: 'zugzwang', name: '추크츠방', kind: 'active', category: 'END', stars: 3.5,
    description: '상대는 다음 차례에 킹만 움직일 수 있습니다. 킹이 움직일 수 없으면 다른 수를 둘 수 있습니다.',
    activate: (s, o) => addEffect(s, 'zugzwang', o, 2),
    filterMoves: (s, color, moves, src) => {
      if (color === src.owner) return moves;
      const k = moves.filter((m) => at(s, m.from)?.type === 'K');
      return k.length ? k : moves;
    },
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '“추크츠방” 카드를 쓰세요. 상대는 다음 차례에 킹만 움직여야 합니다.', done: '킹을 억지로 움직이게 해 수비를 무너뜨릴 수 있습니다.', goal: usedCard('zugzwang') },
  },
  {
    id: 'stand-firm', name: '버티기', kind: 'passive', category: 'END', stars: 2.5,
    description: '상대 진영(백 기준 5~8랭크)에 있는 내 폰은 상대 킹에게 잡히지 않습니다.',
    protects: (s, a, t, src) => at(s, t)?.type === 'P' && at(s, a)?.type === 'K' && relRank(t, src.owner) >= 4,
    demo: { board: '8/4k3/8/3P4/8/8/8/4K3', text: 'e7 킹이 d6을 지키고 있지만, d5 폰을 d6으로 밀어 보세요.', done: '킹 혼자서는 버티는 폰을 막을 수 없습니다.', goal: moved('d5', 'd6') },
  },
  {
    id: 'passed-pawn', name: '통과한 폰', kind: 'passive', category: 'END', stars: 3,
    description: '앞길과 양옆 줄에 상대 폰이 하나도 없는 내 폰은 잡히지 않습니다.',
    protects: (s, _a, t, src) => {
      if (at(s, t)?.type !== 'P') return false;
      const d = forward(src.owner);
      for (let r = rank(t) + d; r >= 0 && r < 8; r += d) {
        for (const f of [file(t) - 1, file(t), file(t) + 1]) {
          const q = onBoard(f, r) ? at(s, sq(f, r)) : null;
          if (q && q.type === 'P' && q.color !== src.owner) return false;
        }
      }
      return true;
    },
    demo: { board: '4k3/8/8/8/1r6/8/2P5/4K3', text: 'b4 룩이 4랭크를 노리지만, 통과한 c2 폰을 c4로 밀어 보세요.', done: '막을 폰이 없는 폰은 아무도 잡을 수 없습니다. 승진까지 달리세요.', goal: moved('c2', 'c4') },
  },
  {
    id: 'bishop-cannon', name: '포격 비숍', kind: 'passive', category: 'END', stars: 2.5,
    description: '내 비숍(대주교 포함)은 대각선의 기물 하나를 뛰어넘어, 그 너머 첫 번째 상대 기물을 잡을 수 있습니다.',
    extraMoves: (s, from, p) => {
      if (p.type !== 'B' && p.type !== 'A') return [];
      const out: Move[] = [];
      for (const [df, dr] of DIAG) {
        let f = file(from) + df, r = rank(from) + dr, screen = false;
        while (onBoard(f, r)) {
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
    demo: { board: '4k3/8/8/5r2/8/3P4/8/1B2K3', text: 'b1 비숍으로 d3 폰을 뛰어넘어 f5의 룩을 잡으세요.', done: '비숍도 장기의 포처럼 한 기물을 넘어 공격합니다.', goal: moved('b1', 'f5') },
  },
  {
    id: 'last-guard', name: '최후의 근위대', kind: 'active', category: 'END', stars: 3,
    description: '내 킹 주변의 빈칸 하나에 근위병을 놓습니다. 근위병은 킹처럼 한 칸씩 움직이지만, 잡혀도 패배하지 않습니다.',
    targets: [target('근위병을 놓을 킹 주변의 빈칸을 고르세요.', empty((s, o, x) => adjacent(kingSq(s, o), x)))],
    activate: (s, o, [x]) => summon(s, x!, 'G', o),
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '킹 옆 빈칸에 근위병을 불러오세요.', done: '마지막 순간에 킹을 지킬 호위가 생겼습니다.', goal: usedCard('last-guard') },
  },
  {
    id: 'fortress', name: '요새', kind: 'active', category: 'END', stars: 3,
    description: '상대 차례 2번 동안 상대 기물은 내 킹 주변 8칸에 들어올 수 없습니다.',
    detail: '체크는 막지 못합니다.',
    activate: (s, o) => addEffect(s, 'fortress', o, 4),
    allowMove: (s, m, mover, src) => mover === src.owner || !adjacent(kingSq(s, src.owner), m.to),
    demo: { board: '4k3/8/8/8/8/8/8/4K3', text: '“요새” 카드를 써서 킹 주변을 막으세요.', done: '두 차례 동안 상대는 킹에게 다가오지 못합니다.', goal: usedCard('fortress') },
  },
  {
    id: 'rook-backup', name: '후방 지원', kind: 'passive', category: 'END', stars: 2.5,
    description: '같은 세로줄 바로 앞 칸에 내 폰이 있는 내 룩(재상 포함)은 잡히지 않습니다.',
    protects: (s, _a, t, src) => {
      const p = at(s, t);
      if (!p || (p.type !== 'R' && p.type !== 'C')) return false;
      const ahead = t + 8 * forward(src.owner);
      const q = ahead >= 0 && ahead < 64 ? at(s, ahead) : null;
      return !!q && q.type === 'P' && q.color === src.owner;
    },
    demo: { board: '4k3/8/8/8/P7/8/1b6/R3K3', text: 'b2 비숍이 a3을 노리지만, a1 룩을 a4 폰 바로 뒤 a3으로 올려 보세요.', done: '폰 뒤에서 받치는 룩은 잡히지 않습니다.', goal: moved('a1', 'a3') },
  },
  {
    id: 'blast', name: '폭발', kind: 'active', category: 'END', stars: 3.5,
    description: '내 폰 하나를 터뜨립니다. 그 폰과 주변 8칸에 있는 상대 폰이 모두 사라집니다.',
    targets: [target('터뜨릴 내 폰을 고르세요.', own(['P']))],
    activate: (s, o, [x]) => {
      for (let i = 0; i < 64; i++) {
        const p = at(s, i);
        if (p && p.type === 'P' && p.color === other(o) && adjacent(i, x!)) destroy(s, i);
      }
      destroy(s, x!);
    },
    demo: { board: '4k3/8/8/2ppp3/3P4/8/8/4K3', text: 'd4 폰을 터뜨려 앞을 막은 상대 폰 셋을 없애세요.', done: '폰 하나로 셋을 지웠습니다.', goal: usedCard('blast') },
  },
  {
    id: 'pawn-wave', name: '파도', kind: 'active', category: 'END', stars: 3,
    description: '앞이 비어 있는 내 폰이 모두 한 칸씩 전진합니다. 끝 줄에 닿으면 퀸으로 승진합니다.',
    activate: (s, o) => {
      const d = forward(o);
      const xs = s.board.map((p, i) => (p && p.color === o && p.type === 'P' ? i : -1)).filter((i) => i >= 0);
      xs.sort((a, b) => relRank(b, o) - relRank(a, o));
      for (const x of xs) {
        const to = x + 8 * d;
        if (to < 0 || to >= 64 || at(s, to)) continue;
        const p = s.board[x]!;
        s.board[to] = p; s.board[x] = null; p.moved = true;
        if (relRank(to, o) === 7) p.type = 'Q';
      }
    },
    demo: { board: '4k3/1P6/8/8/8/8/PP6/4K3', text: '파도를 써서 모든 폰을 한 칸씩 전진시키세요.', done: 'b7 폰은 퀸이 되고, 나머지 폰도 함께 나아갔습니다.', goal: usedCard('pawn-wave') },
  },
  {
    id: 'iron-king', name: '강철 왕', kind: 'passive', category: 'END', stars: 3,
    description: '내 킹은 상대 마이너 기물(나이트·비숍·낙타·근위병)에게 잡히지 않습니다.',
    protects: (s, a, t) => at(s, t)?.type === 'K' && MINORS.includes(at(s, a)?.type ?? 'K'),
    demo: { board: '4k3/8/8/8/8/2n5/8/4K3', text: 'c3 나이트가 e2를 노리지만, 킹을 e2로 옮겨 보세요.', done: '마이너 기물로는 강철 왕을 잡을 수 없습니다.', goal: moved('e1', 'e2') },
  },
  {
    id: 'clone', name: '복제', kind: 'active', category: 'END', stars: 4,
    description: '내 마이너 기물 하나와 똑같은 기물을 그 주변 빈칸에 하나 더 만듭니다.',
    targets: [
      target('복제할 내 마이너 기물을 고르세요.', own(MINORS)),
      target('새 기물을 놓을 주변 빈칸을 고르세요.', (s, _o, x, [a]) => !at(s, x) && adjacent(a!, x)),
    ],
    activate: (s, o, [a, b]) => summon(s, b!, at(s, a!)!.type, o),
    demo: { board: '4k3/8/8/8/8/8/8/1N2K3', text: '복제로 b1 나이트 옆에 나이트를 하나 더 만드세요.', done: '기물 하나가 둘이 되었습니다.', goal: usedCard('clone') },
  },
  {
    id: 'gate', name: '관문', kind: 'active', category: 'END', stars: 2.5,
    description: '상대 차례 2번 동안 상대 폰은 앞으로 전진할 수 없습니다. 대각선으로 잡는 것은 가능합니다.',
    activate: (s, o) => addEffect(s, 'gate', o, 4),
    allowMove: (s, m, mover, src) => mover === src.owner || at(s, m.from)?.type !== 'P' || file(m.from) !== file(m.to),
    demo: { board: '4k3/8/8/8/8/8/1p6/4K3', text: 'b2 폰이 승진을 노립니다. 관문으로 폰을 멈추세요.', done: '두 차례 동안 상대 폰은 앞으로 나오지 못합니다.', goal: usedCard('gate') },
  },
  {
    id: 'rook-sweep', name: '쓸어내기', kind: 'active', category: 'END', stars: 3,
    description: '내 룩(재상 포함)과 같은 가로줄에 있는 상대 폰 하나를 없앱니다. 사이에 기물이 있어도 됩니다.',
    targets: [target('없앨 상대 폰을 고르세요.', enemy(['P'], (s, o, x) => s.board.some((p, i) => !!p && p.color === o && ROOKISH.includes(p.type) && rank(i) === rank(x))))],
    activate: (s, _o, [x]) => destroy(s, x!),
    demo: { board: '4k3/8/8/8/R1N2p2/8/8/4K3', text: 'a4 룩과 같은 줄에 있는 f4 폰을 쓸어내세요.', done: '내 나이트가 가로막고 있어도 룩의 줄은 닿습니다.', goal: usedCard('rook-sweep') },
  },
  {
    id: 'last-rites', name: '최후의 일격', kind: 'passive', category: 'END', stars: 2.5,
    description: '내 퀸(아마존 포함)이 잡히면, 잡은 상대 기물도 함께 파괴됩니다.',
    afterMove: (s, ctx, src) => {
      if (ctx.mover !== src.owner && ctx.captured?.color === src.owner && (ctx.captured.type === 'Q' || ctx.captured.type === 'M')) destroy(s, ctx.move.to);
    },
    demo: { board: '4k3/8/8/3q4/8/8/8/3RK3', white: [], black: ['last-rites'], text: '상대가 최후의 일격을 가지고 있습니다. d1 룩으로 d5의 퀸을 잡아 보세요.', done: '퀸을 잡은 룩도 함께 쓰러졌습니다.', goal: (s, a) => a.kind === 'move' && a.captured === 'Q' && !at(s, S('d5')) },
  },
  {
    id: 'frost-line', name: '서리 길', kind: 'active', category: 'END', stars: 3,
    description: '내 룩(재상 포함) 하나를 고르면, 같은 세로줄에 있는 상대 기물(킹 제외)이 상대 차례 2번 동안 얼어붙습니다.',
    targets: [target('서리 길을 낼 내 룩을 고르세요.', own(ROOKISH))],
    activate: (s, o, [x]) => {
      for (let i = 0; i < 64; i++) {
        const p = at(s, i);
        if (p && p.color === other(o) && p.type !== 'K' && file(i) === file(x!)) setStatus(s, i, 'frozen', 4);
      }
    },
    demo: { board: '3qk3/3r4/8/8/8/8/8/3RK3', text: 'd1 룩으로 서리 길을 내서 d파일의 상대 기물을 얼리세요.', done: '한 줄에 선 기물들이 한꺼번에 얼어붙었습니다.', goal: usedCard('frost-line') },
  },
  {
    id: 'double-agent', name: '이중 첩자', kind: 'active', category: 'END', stars: 4.5,
    description: '상대 폰 하나를 내 폰으로 바꿉니다.',
    targets: [target('내 편으로 만들 상대 폰을 고르세요.', enemy(['P'], (_s, o, x) => relRank(x, o) >= 1 && relRank(x, o) <= 6))],
    activate: (s, o, [x]) => { const p = at(s, x!)!; p.color = o; p.moved = true; },
    demo: { board: '4k3/8/8/3p4/8/8/8/4K3', text: '이중 첩자로 d5의 상대 폰을 내 편으로 만드세요.', done: '상대 폰 하나가 사라지고 내 폰 하나가 늘었습니다.', goal: usedCard('double-agent') },
  },
  {
    id: 'color-shift', name: '색 바꾸기', kind: 'active', category: 'END', stars: 2,
    description: '내 비숍 하나를 상하좌우로 맞닿은 빈칸으로 옮깁니다. 비숍이 반대 색 칸으로 갈 수 있습니다.',
    targets: [
      target('옮길 내 비숍을 고르세요.', own(['B'])),
      target('맞닿은 빈칸을 고르세요.', (s, _o, x, [a]) => !at(s, x) && orthAdjacent(a!, x)),
    ],
    activate: (s, _o, [a, b]) => { s.board[b!] = s.board[a!]!; s.board[a!] = null; },
    demo: { board: '4k3/8/8/8/8/8/8/2B1K3', text: '색 바꾸기로 c1 비숍을 옆 칸 d1로 옮기세요.', done: '어두운 칸 비숍이 밝은 칸을 다스리게 되었습니다.', goal: usedCard('color-shift') },
  },
  {
    id: 'hourglass', name: '모래시계', kind: 'active', category: 'END', stars: 3.5,
    description: '상대 차례 2번 동안 상대 기물은 한 칸만 움직일 수 있습니다. 나이트처럼 뛰는 수와 캐슬링도 막힙니다.',
    activate: (s, o) => addEffect(s, 'hourglass', o, 4),
    allowMove: (_s, m, mover, src) =>
      mover === src.owner || (Math.max(Math.abs(file(m.to) - file(m.from)), Math.abs(rank(m.to) - rank(m.from))) <= 1 && !m.castle),
    demo: { board: '4k3/8/8/8/8/8/8/q3K3', text: 'a1 퀸이 멀리서 노리고 있습니다. 모래시계로 상대를 느리게 만드세요.', done: '두 차례 동안 상대 기물은 한 칸씩만 움직입니다.', goal: usedCard('hourglass') },
  },
);

export const END2_LOADED = true;
void moved;
