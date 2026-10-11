import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { PasswordInput } from './PasswordInput';

const meta = {
  title: 'Molecules/PasswordInput',
  component: PasswordInput,
  args: { showLabel: '', hideLabel: '' },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
  render: (args, { globals }) => {
    const copy = storyCopy(globals).password;
    return (
      <PasswordInput
        {...args}
        aria-label={copy.label}
        showLabel={args.showLabel || copy.show}
        hideLabel={args.hideLabel || copy.hide}
      />
    );
  },
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Filled: Story = { args: { defaultValue: 'leap2026' } };
export const Invalid: Story = { args: { invalid: true, defaultValue: 'short' } };
