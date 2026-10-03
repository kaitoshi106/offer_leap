import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { themeInitScript } from '@/lib/theme';

import { ThemeScript } from './ThemeScript';

describe('ThemeScript', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is executable in server-rendered HTML', () => {
    vi.stubGlobal('window', undefined);
    const html = renderToString(<ThemeScript />);

    expect(html).toContain('type="text/javascript"');
    expect(html).toContain(themeInitScript);
  });

  it('renders inert on the client so React does not warn about a script that never runs', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<ThemeScript />);

    expect(container.querySelector('script')).toHaveAttribute('type', 'text/plain');
    expect(consoleError).not.toHaveBeenCalled();
  });
});
