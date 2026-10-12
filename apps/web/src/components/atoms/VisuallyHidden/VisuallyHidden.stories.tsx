import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Icon } from '../Icon';
import { VisuallyHidden } from './VisuallyHidden';

const meta = {
  title: 'Atoms/VisuallyHidden',
  component: VisuallyHidden,
} satisfies Meta<typeof VisuallyHidden>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The extra text is invisible but announced by screen readers. */
export const ExtraContextForLink: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals).visuallyHidden;
    return (
      <a href="#" className="inline-flex items-center gap-1 text-primary-text underline">
        {copy.profile}
        <Icon name="arrow-right" size="sm" />
        <VisuallyHidden>{copy.newTab}</VisuallyHidden>
      </a>
    );
  },
};
