import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { THEME_STORAGE_KEY } from '@/lib/theme';
import { renderWithProviders } from '@/test/render';

import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('follows the OS (light in tests) until the user chooses', () => {
    renderWithProviders(<ThemeToggle />);
    expect(screen.getByRole('switch', { name: 'Giao diện tối' })).not.toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('switches between light and dark and remembers the choice', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);
    const toggle = screen.getByRole('switch', { name: 'Giao diện tối' });

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('starts from a stored choice and is translated', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderWithProviders(<ThemeToggle />, { locale: 'en' });
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
  });

  it('takes its look from <html data-theme>, so it is right before React knows the theme', () => {
    renderWithProviders(<ThemeToggle />);
    const thumb = screen.getByRole('switch').firstElementChild!;
    // Styled by the attribute the init script sets before the first paint, not by React state.
    expect(thumb).toHaveClass('[[data-theme=dark]_&]:translate-x-6');
  });
});
