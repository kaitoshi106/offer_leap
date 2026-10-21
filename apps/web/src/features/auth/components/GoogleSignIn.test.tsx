import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '@/test/render';

import { GoogleSignIn } from './GoogleSignIn';

const fetchMock = vi.fn<typeof fetch>();

describe('GoogleSignIn', () => {
  beforeEach(() => vi.stubGlobal('fetch', fetchMock));
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('links to the API sign-in with the page language and where to go next', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { google: true }));
    renderWithProviders(<GoogleSignIn next="/applications" />);

    const link = await screen.findByRole('link', { name: 'Tiếp tục với Google' });
    const url = new URL(link.getAttribute('href')!);
    expect(url.pathname).toBe('/api/v1/auth/google');
    expect(Object.fromEntries(url.searchParams)).toEqual({ locale: 'vi', next: '/applications' });
    expect(screen.getByText('hoặc')).toBeInTheDocument();
  });

  it('stays hidden when the API has no Google credentials', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { google: false }));
    renderWithProviders(<GoogleSignIn />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
