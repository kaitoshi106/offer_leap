import { composeStories, setProjectAnnotations } from '@storybook/react';
import { act, render } from '@testing-library/react';
import type { ComponentProps, ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as preview from '../../.storybook/preview';

/**
 * Smoke test: every story renders in both languages without throwing, including the argTypes `mapping`
 * used by icon controls. Catches broken stories before anyone opens Storybook.
 */
// Storybook's Next.js framework mocks the router in the browser; in jsdom we stub the locale-aware navigation.
vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/',
  Link: ({ href, locale, ...rest }: ComponentProps<'a'> & { locale: string }) => (
    <a href={`/${locale}${href}`} {...rest} />
  ),
}));

// next/font needs the Next.js compiler; the class name is irrelevant here.
vi.mock('@/app/fonts', () => ({ roboto: { variable: 'font-roboto', className: 'font-roboto' } }));

const annotations = setProjectAnnotations([preview]);

type StoryModule = Parameters<typeof composeStories>[0];
// Cast instead of a type argument: Next's ImportMeta typings shadow Vite's generic `glob` signature here.
const modules = import.meta.glob('../components/**/*.stories.tsx', { eager: true }) as Record<
  string,
  StoryModule
>;

describe.each(['vi', 'en'])('stories (%s)', (locale) => {
  for (const [path, module] of Object.entries(modules)) {
    const stories = composeStories(module, { ...annotations, initialGlobals: { locale } });
    for (const [name, Story] of Object.entries(stories) as [string, ComponentType][]) {
      it(`${path.replace('../components/', '')} › ${name}`, async () => {
        const { container } = render(<Story />);
        await act(async () => {});
        expect(container).not.toBeEmptyDOMElement();
        expect(document.documentElement.lang).toBe(locale);
      });
    }
  }
});

describe('story controls', () => {
  it('maps icon control values to real icons instead of rendering the raw string', async () => {
    const buttonStories = await import('../components/atoms/Button/Button.stories');
    const { WithIcons } = composeStories(buttonStories, annotations);
    const { container } = render(<WithIcons />);

    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(container).not.toHaveTextContent('upload');
  });

  it('follows the Language toolbar', async () => {
    const buttonStories = await import('../components/atoms/Button/Button.stories');
    const { Primary } = composeStories(buttonStories, { ...annotations, initialGlobals: { locale: 'en' } });
    const { getByRole } = render(<Primary />);

    expect(getByRole('button')).toHaveTextContent('Upload CV');
  });
});
