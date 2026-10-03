import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { THEME_STORAGE_KEY } from '@/lib/theme';
import { renderWithProviders } from '@/test/render';

import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('cycles light → dark → system and applies the theme to <html>', async () => {
    const user = userEvent.setup();
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderWithProviders(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Giao diện: Sáng' });

    await user.click(button);
    expect(button).toHaveAccessibleName('Giao diện: Tối');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(button);
    expect(button).toHaveAccessibleName('Giao diện: Theo hệ thống');
    // matchMedia is mocked to a light OS theme.
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('is translated', () => {
    renderWithProviders(<ThemeToggle />, { locale: 'en' });
    expect(screen.getByRole('button', { name: 'Theme: System' })).toBeInTheDocument();
  });
});
