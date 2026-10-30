const PATTERNS: Array<{ re: RegExp; msg: string }> = [
  // --- Auth / login ---
  {
    re: /login.*required|not logged in|sign in to|login to watch|requires.*authentication/i,
    msg: 'Login required — this content needs authentication on the server.',
  },
  {
    re: /no csrf token|empty media response|check if this post is accessible/i,
    msg: 'Instagram requires login — the server needs valid Instagram cookies.',
  },
  {
    re: /cannot parse data.*facebook|facebook.*cannot parse/i,
    msg: 'Facebook requires login — the server needs valid Facebook cookies.',
  },
  {
    re: /cookies.*required|use --cookies|pass cookies/i,
    msg: 'This platform requires cookies — configure cookies on the server.',
  },

  // --- Impersonation / curl-cffi ---
  {
    re: /attempting impersonation.*no impersonate target|no impersonate target.*available/i,
    msg: 'Missing dependency (curl-cffi) — update yt-dlp on the server.',
  },
  {
    re: /impersonate.*firefox|impersonate.*chrome|none of these impersonate targets/i,
    msg: 'Missing dependency (curl-cffi) — update yt-dlp on the server.',
  },

  // --- IP / access blocks ---
  {
    re: /your ip.*blocked|ip.*blocked.*accessing|ip address.*blocked/i,
    msg: "The server's IP is blocked by this platform. Try using a VPN on the server.",
  },
  {
    re: /geo.?block|not available.*country|not available.*region|geo.?restrict/i,
    msg: 'This video is not available in the server region.',
  },

  // --- Content issues ---
  {
    re: /no video could be found|no video.*in this tweet|no video.*post/i,
    msg: 'No video found — this post does not contain a downloadable video.',
  },
  {
    re: /clip is no longer available|clip.*not available|no longer available/i,
    msg: 'This clip is no longer available.',
  },
  {
    re: /private.*video|video.*private|this video is private/i,
    msg: 'This video is private.',
  },
  {
    re: /age.?restrict|age.?gate|confirm your age/i,
    msg: 'Age-restricted — authentication is required on the server.',
  },
  {
    re: /video.*unavailable|this video is unavailable|has been removed/i,
    msg: 'This video is unavailable or has been removed.',
  },
  {
    re: /copyright|matched third.party/i,
    msg: 'This video was removed for copyright reasons.',
  },
  {
    re: /account.*terminated|channel.*removed|user.*not found/i,
    msg: 'The channel or account no longer exists.',
  },

  // --- Extractors / yt-dlp ---
  {
    re: /no formats?.*available|unable to extract/i,
    msg: 'Unable to extract video — the URL may not be supported.',
  },
  {
    re: /429|rate.?limit|too many requests/i,
    msg: 'Rate-limited by the platform — wait a moment and try again.',
  },
  {
    re: /marked as broken|extractor.*broken/i,
    msg: 'The extractor for this platform is broken — update yt-dlp on the server.',
  },

  // --- Server connectivity ---
  {
    re: /failed to fetch|network request failed|connection refused|could not connect/i,
    msg: 'Cannot reach the server — check the server URL in Settings.',
  },
];

export function parseYtdlpError(raw: string): string {
  for (const { re, msg } of PATTERNS) {
    if (re.test(raw)) return msg;
  }
  // Extract last meaningful ERROR line, stripping WARNING/debug noise
  const errorLine = raw
    .split('\n')
    .filter((l) => l.trim() && l.includes('ERROR:') && !l.startsWith('[debug]'))
    .at(-1);
  if (errorLine) {
    return errorLine.replace(/^ERROR:\s*(\[\w+\]\s*)?[\w-]+:\s*/i, '').trim() || errorLine.trim();
  }
  const meaningful = raw
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('[debug]') && !l.startsWith('WARNING'))
    .at(-1);
  return meaningful?.trim() || raw.trim();
}
