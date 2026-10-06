import type { Move } from '../src/index.ts';
import { parseSquare } from '../src/index.ts';
export { solveDemo } from '../src/index.ts';

export const P = parseSquare;
export const mv = (from: string, to: string, extra: Partial<Move> = {}): Move => ({ from: P(from), to: P(to), ...extra });
