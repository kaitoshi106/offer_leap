import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Label } from './Label';

const meta = {
  title: 'Atoms/Label',
  component: Label,
  args: { htmlFor: 'name' },
  render: (args, { globals }) => (
    <Label {...args}>{args.children ?? storyCopy(globals).label.fullName}</Label>
  ),
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Required: Story = { args: { required: true } };
