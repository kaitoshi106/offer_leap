import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Combobox, type ComboboxOption } from './Combobox';

const PROVINCES: ComboboxOption[] = [
  { value: 'ha-noi', label: 'Hà Nội', keywords: 'Hanoi' },
  { value: 'ho-chi-minh', label: 'TP. Hồ Chí Minh', keywords: 'Ho Chi Minh City Saigon' },
  { value: 'da-nang', label: 'Đà Nẵng', keywords: 'Da Nang' },
];

function Harness({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="province">Tỉnh/thành</label>
      <Combobox
        id="province"
        options={PROVINCES}
        value={value}
        onChange={setValue}
        noResultsLabel="Không có kết quả"
      />
      <output>{value ?? 'none'}</output>
    </form>
  );
}

describe('Combobox', () => {
  it('filters without accents and picks with the keyboard (without submitting the form)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const input = screen.getByRole('combobox', { name: 'Tỉnh/thành' });

    await user.type(input, 'da nang');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Đà Nẵng']);
    expect(input).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('da-nang');
    expect(input).toHaveValue('Đà Nẵng');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('matches keywords and moves the active option with arrow keys', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'saigon');
    expect(screen.getByRole('option', { name: 'TP. Hồ Chí Minh' })).toBeInTheDocument();

    // Erasing the text lists every option with the first one active; ↓ moves to the next.
    await user.clear(input);
    const activeOption = () => document.getElementById(input.getAttribute('aria-activedescendant')!);
    expect(activeOption()).toHaveTextContent('Hà Nội');
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toHaveTextContent('TP. Hồ Chí Minh');
  });

  it('closes on Escape and shows a message when nothing matches', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');

    await user.type(input, 'xyz');
    expect(screen.getByText('Không có kết quả')).toBeVisible();

    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('');
  });

  it('picks with the mouse and clears when the text is erased', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('combobox');

    await user.click(input);
    await user.click(screen.getByRole('option', { name: 'Hà Nội' }));
    expect(screen.getByRole('status')).toHaveTextContent('ha-noi');

    await user.clear(input);
    await user.tab();
    expect(screen.getByRole('status')).toHaveTextContent('none');
  });
});
