import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { type StoryCopy, storyCopy } from '@/stories/copy';

import { TagInput } from './TagInput';

const meta = {
  title: 'Organisms/TagInput',
  component: TagInput,
  args: { value: [], onChange: () => {}, removeLabel: (tag: string) => tag },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof TagInput>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo({
  copy,
  initial,
  maxTags,
}: {
  copy: StoryCopy['tagInput'];
  initial: string[];
  maxTags?: number;
}) {
  const [tags, setTags] = useState(initial);
  return (
    <TagInput
      aria-label={copy.label}
      placeholder={copy.placeholder}
      value={tags}
      onChange={setTags}
      maxTags={maxTags}
      removeLabel={(tag) => `${copy.remove} ${tag}`}
    />
  );
}

/** Enter or comma adds, Backspace removes the last tag, pasting "a, b, c" adds several. */
export const Skills: Story = {
  render: (_args, { globals }) => (
    <Demo copy={storyCopy(globals).tagInput} initial={['React', 'TypeScript', 'NestJS']} />
  ),
};

export const MaxReached: Story = {
  render: (_args, { globals }) => (
    <Demo copy={storyCopy(globals).tagInput} initial={['React', 'NestJS']} maxTags={2} />
  ),
};
