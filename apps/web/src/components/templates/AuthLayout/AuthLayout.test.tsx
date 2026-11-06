import { screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { AuthLayout } from './AuthLayout';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/login',
  Link: ({ href, locale, ...rest }: ComponentProps<'a'> & { locale?: string }) => (
    <a href={`/${locale ?? 'vi'}${href}`} {...rest} />
  ),
}));

const PHOTOS = { morning: '/landing/morning.jpg', night: '/landing/night.jpg' };
const SCENE = {
  line: 'Good morning.',
  nightLine: 'Tonight: upload your CV.',
  chips: ['75 · Good match'],
  credit: 'Illustrative photos generated with AI.',
};

describe('AuthLayout', () => {
  it('renders the page content and keeps the scene decorative', () => {
    renderWithProviders(
      <AuthLayout title="Sign in" homeLabel="Back to home" scene={SCENE} photos={PHOTOS}>
        <p>Form</p>
      </AuthLayout>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('Form')).toBeInTheDocument();
    // The scene's line is real text (in the panel and the small-screen strip)…
    expect(screen.getAllByText('Good morning.').length).toBeGreaterThan(0);
    // …its photos are mood, not content, and its chips are hidden from assistive tech.
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.getByText('75 · Good match').closest('[aria-hidden]')).not.toBeNull();
    // A morning scene has no night line.
    expect(screen.queryByText('Tonight: upload your CV.')).not.toBeInTheDocument();
  });

  it('shows tonight and tomorrow morning side by side on the split scene', () => {
    renderWithProviders(
      <AuthLayout title="Sign up" homeLabel="Back to home" scene={SCENE} photos={PHOTOS} sceneVariant="split">
        <p>Form</p>
      </AuthLayout>,
    );

    expect(screen.getAllByText('Tonight: upload your CV.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Good morning.').length).toBeGreaterThan(0);
  });
});
