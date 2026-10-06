# Engine (MVP)

Pure TypeScript rules engine (no dependencies at runtime; Node >= 22.18 runs `.ts` directly).

- King-capture win, no check rule. Castling, en passant, promotion. Loss on no moves; draw at 400 plies.
- Drafting: 3-card offers at own moves 0/10/20, weighted by rarity (higher stars = rarer).
- Cards are data + hooks (`src/cards.ts`): passives add moves, actives validate/activate without consuming the turn.
- `src/sim.ts`: self-play to estimate per-card win rates. `npm run sim -- 5000 1`.

```
npm install
npm test        # node:test
npm run typecheck
```

MVP cards use original names/effects (not copied from any existing game).
Next: more cards by effect class (see docs/classification.md), shielded/hidden-info state, smarter bot (search) for credible win rates.
