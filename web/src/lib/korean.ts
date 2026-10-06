/**
 * Korean particles that depend on the final consonant (받침) of the previous word.
 * Handles Hangul syllables, digits (as read in Korean) and Latin letters (as read aloud).
 */
const DIGIT_FINAL: Record<string, 'none' | 'rieul' | 'other'> = {
  '0': 'other', '1': 'rieul', '2': 'none', '3': 'other', '4': 'none', '5': 'none', '6': 'other', '7': 'rieul', '8': 'rieul', '9': 'none',
};
// Letters whose English name ends in a consonant sound when read in Korean (엘, 엠, 엔, 알...)
const LETTER_FINAL: Record<string, 'none' | 'rieul' | 'other'> = { l: 'rieul', r: 'rieul', m: 'other', n: 'other' };

function finalOf(word: string): 'none' | 'rieul' | 'other' {
  const ch = word.trim().replace(/[)"'”’\]]+$/, '').slice(-1);
  if (!ch) return 'none';
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 ? 'none' : jong === 8 ? 'rieul' : 'other';
  }
  if (DIGIT_FINAL[ch]) return DIGIT_FINAL[ch]!;
  return LETTER_FINAL[ch.toLowerCase()] ?? 'none';
}

type Pair = '을/를' | '이/가' | '은/는' | '과/와' | '으로/로' | '이에요/예요';

/** Append the right particle: josa('나이트', '을/를') === '나이트를'. */
export function josa(word: string, pair: Pair): string {
  const f = finalOf(word);
  const [withFinal, without] = pair.split('/') as [string, string];
  if (pair === '으로/로') return word + (f === 'other' ? '으로' : '로');
  return word + (f === 'none' ? without : withFinal);
}
