import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { storyCopy } from '@/stories/copy';

import { Label } from '../Label';
import { Input } from './Input';

const meta = {
  title: 'Atoms/Input',
  component: Input,
  args: { onChange: fn(), onClear: fn() },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
  render: (args, { globals }) => {
    const copy = storyCopy(globals).input;
    return (
      <Input aria-label={copy.email} placeholder={copy.emailPlaceholder} clearLabel={copy.clear} {...args} />
    );
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args, { globals }) => {
    const copy = storyCopy(globals).input;
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" required>
          {copy.email}
        </Label>
        <Input
          id="email"
          type="email"
          required
          placeholder={copy.emailPlaceholder}
          clearLabel={copy.clear}
          {...args}
        />
      </div>
    );
  },
};

/** Type something: a ✕ button appears; click it or press Escape to clear. */
export const Clearable: Story = { args: { clearable: true, defaultValue: 'React, NestJS, Tailwind' } };

export const Invalid: Story = { args: { invalid: true, defaultValue: 'not-an-email' } };

export const Disabled: Story = { args: { disabled: true, defaultValue: 'root@offerleap.local' } };
