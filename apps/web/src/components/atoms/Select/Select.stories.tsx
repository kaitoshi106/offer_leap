import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Select } from './Select';

const meta = {
  title: 'Atoms/Select',
  component: Select,
  decorators: [(Story) => <div className="w-72">{Story()}</div>],
  render: (args, { globals }) => {
    const copy = storyCopy(globals).select;
    return (
      <Select aria-label={copy.label} placeholder={copy.placeholder} defaultValue="" {...args}>
        {copy.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Invalid: Story = { args: { invalid: true } };
export const Disabled: Story = { args: { disabled: true } };
