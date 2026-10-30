import { parseYtdlpError } from '@/lib/error-parser';

describe('parseYtdlpError', () => {
  it('maps known yt-dlp failures to friendly messages', () => {
    expect(parseYtdlpError('ERROR: Private video. Sign in if you...')).toMatch(/private/i);
    expect(parseYtdlpError('This video is unavailable')).toMatch(/unavailable/i);
    expect(parseYtdlpError('HTTP Error 429: Too Many Requests')).toMatch(/rate-limited/i);
    expect(parseYtdlpError('This video is age restricted')).toMatch(/age-restricted/i);
    expect(parseYtdlpError('Network request failed')).toMatch(/cannot reach the server/i);
  });

  it('prefers the first matching rule (login wins over age for sign-in prompts)', () => {
    expect(parseYtdlpError('Sign in to confirm your age')).toMatch(/login required/i);
  });

  it('falls back to the last meaningful line, skipping debug/warning noise', () => {
    const raw = ['[debug] some internal trace', 'WARNING: deprecated flag', 'Boom: it broke'].join(
      '\n',
    );
    expect(parseYtdlpError(raw)).toBe('Boom: it broke');
  });

  it('returns the trimmed raw string when nothing matches', () => {
    expect(parseYtdlpError('  some unexpected message  ')).toBe('some unexpected message');
  });
});
