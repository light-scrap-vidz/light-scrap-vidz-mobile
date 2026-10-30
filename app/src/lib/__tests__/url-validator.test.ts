import { getPlatform, isPlaylistUrl, getUrlKind, isValidUrl } from '@/lib/url-validator';

describe('getPlatform', () => {
  it('detects single-video URLs across platforms', () => {
    expect(getPlatform('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
    expect(getPlatform('https://youtu.be/abc123')).toBe('youtube');
    expect(getPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube');
    expect(getPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
    expect(getPlatform('https://www.instagram.com/reel/abc/')).toBe('instagram');
    expect(getPlatform('https://x.com/user/status/123')).toBe('twitter');
    expect(getPlatform('https://vimeo.com/123456')).toBe('vimeo');
  });

  it('detects profile / playlist URLs', () => {
    expect(getPlatform('https://www.youtube.com/@channel')).toBe('youtube');
    expect(getPlatform('https://www.youtube.com/playlist?list=PL123')).toBe('youtube');
    expect(getPlatform('https://www.tiktok.com/@user')).toBe('tiktok');
  });

  it('returns "unknown" for unsupported or malformed URLs', () => {
    expect(getPlatform('https://example.com/video.mp4')).toBe('unknown');
    expect(getPlatform('not a url')).toBe('unknown');
  });
});

describe('isPlaylistUrl', () => {
  it('is true for profile / channel / playlist URLs', () => {
    expect(isPlaylistUrl('https://www.youtube.com/@channel')).toBe(true);
    expect(isPlaylistUrl('https://www.youtube.com/playlist?list=PL123')).toBe(true);
    expect(isPlaylistUrl('https://www.tiktok.com/@user')).toBe(true);
  });

  it('is false for single videos and malformed input', () => {
    expect(isPlaylistUrl('https://www.youtube.com/watch?v=abc123')).toBe(false);
    expect(isPlaylistUrl('https://youtu.be/abc123')).toBe(false);
    expect(isPlaylistUrl('garbage')).toBe(false);
    expect(isPlaylistUrl('')).toBe(false);
  });
});

describe('getUrlKind', () => {
  it('maps to "playlist" or "single"', () => {
    expect(getUrlKind('https://www.youtube.com/@channel')).toBe('playlist');
    expect(getUrlKind('https://www.youtube.com/watch?v=abc')).toBe('single');
  });
});

describe('isValidUrl', () => {
  it('accepts known platforms and rejects the rest', () => {
    expect(isValidUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isValidUrl('https://youtu.be/abc')).toBe(true);
    expect(isValidUrl('https://example.com/x')).toBe(false);
    expect(isValidUrl('ftp://nope')).toBe(false);
  });
});
