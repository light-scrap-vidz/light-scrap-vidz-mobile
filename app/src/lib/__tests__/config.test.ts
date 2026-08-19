import { normalizeServerUrl, getServerUrl, setServerUrl } from '@/lib/config';

describe('normalizeServerUrl', () => {
  it('trims, strips trailing slashes and defaults the scheme to http', () => {
    expect(normalizeServerUrl('  192.168.1.5:8787  ')).toBe('http://192.168.1.5:8787');
    expect(normalizeServerUrl('http://host:8787/')).toBe('http://host:8787');
    expect(normalizeServerUrl('https://host:8787///')).toBe('https://host:8787');
    expect(normalizeServerUrl('HTTPS://Host')).toBe('HTTPS://Host');
  });

  it('keeps an empty string empty', () => {
    expect(normalizeServerUrl('   ')).toBe('');
  });
});

describe('getServerUrl / setServerUrl', () => {
  it('returns the empty default before anything is stored', async () => {
    await expect(getServerUrl()).resolves.toBe('');
  });

  it('persists a normalized URL and reads it back', async () => {
    const saved = await setServerUrl('192.168.1.20:8787/');
    expect(saved).toBe('http://192.168.1.20:8787');
    await expect(getServerUrl()).resolves.toBe('http://192.168.1.20:8787');
  });
});
