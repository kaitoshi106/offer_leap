import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Checkbox } from './Checkbox';

const meta = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
  render: (args, { globals }) => <Checkbox aria-label={storyCopy(globals).checkbox.remote} {...args} />,
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Indeterminate: Story = { args: { indeterminate: true } };
export const Invalid: Story = { args: { invalid: true } };
export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };

export const WithLabel: Story = {
  render: (args, { globals }) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
      <Checkbox {...args} />
      {storyCopy(globals).checkbox.remote}
    </label>
  ),
};
