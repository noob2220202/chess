import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legalMoves, toPlacement } from '../../engine/src/index.ts';
import { Room, parseMove, replay } from '../src/room.ts';

function mkRoom(mode: 'rated' | 'casual' = 'rated') {
  let now = 1_000_000;
  const ended: Room[] = [];
  const seat = (userId: number) => ({ userId, username: `u${userId}`, rating: 1500, rd: 350, provisional: true });
  const room = new Room(mode, { w: seat(1), b: seat(2) }, { baseMs: 60_000, incMs: 2_000 },
    { update() {}, end(r) { ended.push(r); } }, { abortMs: 30_000, now: () => now });
  return { room, ended, advance: (ms: number) => { now += ms; }, };
}

function playFirst(room: Room, uid: number) {
  const s = room.state;
  if (s.cards[s.turn].offer) room.act(uid, { type: 'pick', id: s.cards[s.turn].offer![0]! });
  room.act(uid, { type: 'move', move: legalMoves(s)[0]! });
}

test('rated rooms use the mirror draft', () => {
  const { room } = mkRoom('rated');
  assert.deepEqual(room.state.draftPlan.w, room.state.draftPlan.b);
  room.dispose();
});

test('server clocks: elapsed time is charged, increment added after a move', () => {
  const { room, advance } = mkRoom();
  advance(5_000);
  playFirst(room, 1);
  assert.equal(room.clocks.w, 60_000 - 5_000 + 2_000);
  assert.equal(room.clocks.b, 60_000);
  room.dispose();
});

test('players cannot act out of turn or make illegal moves', () => {
  const { room } = mkRoom();
  assert.throws(() => room.act(2, { type: 'move', move: { from: 52, to: 36 } }), /상대 차례/);
  assert.throws(() => room.act(99, { type: 'resign' }), /참가자가 아니/);
  room.act(1, { type: 'pick', id: room.state.cards.w.offer![0]! });
  assert.throws(() => room.act(1, { type: 'move', move: { from: 12, to: 44 } }), /둘 수 없는/);
  assert.throws(() => room.act(1, { type: 'move', move: { from: 12, to: 99 } as never }), /잘못된 수/);
  room.dispose();
});

test('no first move within the abort window aborts the game (unrated)', () => {
  const { room, ended, advance } = mkRoom();
  advance(31_000);
  assert.ok(room.tick());
  assert.equal(room.result?.winner, 'aborted');
  assert.equal(ended.length, 1);
});

test('flag fall loses on time', () => {
  const { room, advance } = mkRoom();
  playFirst(room, 1);
  playFirst(room, 2);
  advance(62_001);
  assert.ok(room.tick());
  assert.deepEqual(room.result, { winner: 'b', reason: 'timeout' });
  assert.equal(room.clocks.w, 0);
});

test('resign and draw agreement', () => {
  const a = mkRoom();
  playFirst(a.room, 1); playFirst(a.room, 2);
  a.room.act(2, { type: 'resign' });
  assert.deepEqual(a.room.result, { winner: 'w', reason: 'resign' });

  const b = mkRoom();
  playFirst(b.room, 1); playFirst(b.room, 2);
  b.room.act(1, { type: 'draw', action: 'offer' });
  assert.equal(b.room.drawOffer, 'w');
  assert.throws(() => b.room.act(1, { type: 'draw', action: 'accept' }));
  b.room.act(2, { type: 'draw', action: 'accept' });
  assert.deepEqual(b.room.result, { winner: 'draw', reason: 'agreement' });
});

test('resigning before your first move aborts instead', () => {
  const { room } = mkRoom();
  room.act(1, { type: 'resign' });
  assert.equal(room.result?.winner, 'aborted');
});

test('views hide the draft plan and the opponent offer; replay reproduces the game', () => {
  const { room } = mkRoom();
  const vb = room.view('b');
  assert.deepEqual(vb.state.draftPlan, { w: [], b: [] });
  assert.deepEqual(vb.state.cards.w.offer, []);
  for (let i = 0; i < 6; i++) playFirst(room, room.state.turn === 'w' ? 1 : 2);
  const r = replay({ seed: room.seed, mirror: true, actions: room.actions });
  assert.equal(toPlacement(r), toPlacement(room.state));
  assert.deepEqual(r.cards, room.state.cards);
  room.dispose();
});

test('parseMove rejects junk', () => {
  assert.equal(parseMove(null), null);
  assert.equal(parseMove({ from: 1, to: 64 }), null);
  assert.equal(parseMove({ from: 1, to: 2, promotion: 'K' }), null);
  assert.deepEqual(parseMove({ from: 1, to: 2, promotion: 'Q', extra: 1 }), { from: 1, to: 2, promotion: 'Q' });
});
