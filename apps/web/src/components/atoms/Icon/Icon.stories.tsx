import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Icon, ICON_NAMES } from './Icon';

const meta = {
  title: 'Atoms/Icon',
  component: Icon,
  args: { name: 'sparkles' },
  argTypes: {
    name: { control: 'select', options: ICON_NAMES },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Gallery: Story = {
  render: () => (
    <ul className="grid grid-cols-4 gap-4 text-fg sm:grid-cols-6">
      {ICON_NAMES.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2 text-xs text-fg-muted">
          <Icon name={name} size="lg" className="text-fg" />
          {name}
        </li>
      ))}
    </ul>
  ),
};
