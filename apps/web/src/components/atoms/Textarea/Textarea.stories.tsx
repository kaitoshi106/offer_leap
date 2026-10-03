import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Textarea } from './Textarea';

const meta = {
  title: 'Atoms/Textarea',
  component: Textarea,
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
  render: (args, { globals }) => {
    const copy = storyCopy(globals).textarea;
    return <Textarea aria-label={copy.label} placeholder={copy.placeholder} {...args} />;
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Invalid: Story = { args: { invalid: true } };
export const Disabled: Story = { args: { disabled: true } };
