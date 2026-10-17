import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { TagInput } from './TagInput';

function Harness({ initial = [] as string[], maxTags }: { initial?: string[]; maxTags?: number }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <TagInput
        aria-label="Skills"
        value={tags}
        onChange={setTags}
        removeLabel={(tag) => `Remove ${tag}`}
        maxTags={maxTags}
      />
      <output>{tags.join('|')}</output>
    </>
  );
}

describe('TagInput', () => {
  it('adds with Enter and comma, ignoring duplicates and blanks', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Skills' });

    await user.type(input, 'React{Enter}TypeScript,react{Enter}   {Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('React|TypeScript');
  });

  it('removes with the button or Backspace on an empty input', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['React', 'NestJS', 'Prisma']} />);

    await user.click(screen.getByRole('button', { name: 'Remove NestJS' }));
    expect(screen.getByRole('status')).toHaveTextContent('React|Prisma');

    await user.click(screen.getByRole('textbox'));
    await user.keyboard('{Backspace}');
    expect(screen.getByRole('status')).toHaveTextContent('React');
  });

  it('splits pasted lists and respects the maximum', () => {
    render(<Harness maxTags={2} />);
    fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { getData: () => 'Docker, AWS, GCP' } });

    expect(screen.getByRole('status')).toHaveTextContent('Docker|AWS');
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('commits pending text on blur', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole('textbox'), 'Figma');
    await user.tab();
    expect(screen.getByRole('status')).toHaveTextContent('Figma');
  });
});
