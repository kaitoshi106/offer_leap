import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Label } from '../Label';
import { Input } from './Input';

describe('Input', () => {
  it('is reachable through its label and accepts typing', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" />
      </>,
    );
    const input = screen.getByLabelText('Email');

    await user.type(input, 'a@b.co');
    expect(input).toHaveValue('a@b.co');
  });

  it('exposes the invalid state to assistive tech', () => {
    render(<Input aria-label="Email" invalid />);
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('omits aria-invalid when valid', () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });
});

describe('Input clearable', () => {
  it('shows the clear button only while there is a value', async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Search" clearable clearLabel="Xoá nội dung" />);

    expect(screen.queryByRole('button', { name: 'Xoá nội dung' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), 'react');
    expect(screen.getByRole('button', { name: 'Xoá nội dung' })).toBeInTheDocument();
  });

  it('clears an uncontrolled value, refocuses the input and calls onChange/onClear', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <Input aria-label="Search" clearable defaultValue="react" onChange={onChange} onClear={onClear} />,
    );
    const input = screen.getByRole('textbox');

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ target: input }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('notifies a controlled parent through onChange', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState('nestjs');
      return (
        <>
          <Input aria-label="Search" clearable value={value} onChange={(e) => setValue(e.target.value)} />
          <output>{value || 'empty'}</output>
        </>
      );
    }
    render(<Controlled />);

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('status')).toHaveTextContent('empty');
  });

  it('clears with the Escape key', async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Search" clearable defaultValue="react" />);

    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('hides the clear button when disabled or read-only', () => {
    render(
      <>
        <Input aria-label="A" clearable defaultValue="x" disabled />
        <Input aria-label="B" clearable defaultValue="x" readOnly />
      </>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
