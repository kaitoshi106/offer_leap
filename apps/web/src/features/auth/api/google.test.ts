import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** `API_URL` is read once when the module loads, so each case loads it with its own env. */
async function loadWithApiUrl(apiUrl: string) {
  vi.stubEnv('NEXT_PUBLIC_API_URL', apiUrl);
  vi.resetModules();
  return import('./google');
}

describe('googleSignInUrl', () => {
  it('points at the API on its own host', async () => {
    const { googleSignInUrl } = await loadWithApiUrl('https://api.example.com/api/v1');
    expect(googleSignInUrl('vi', '/applications')).toBe(
      'https://api.example.com/api/v1/auth/google?locale=vi&next=%2Fapplications',
    );
  });

  it('works when the API is served from the same site under /api/v1 (also while rendering on the server)', async () => {
    const { googleSignInUrl } = await loadWithApiUrl('/api/v1');
    expect(googleSignInUrl('en')).toBe('/api/v1/auth/google?locale=en');
  });
});
