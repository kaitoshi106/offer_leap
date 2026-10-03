import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Text } from './Text';

const TONES = ['default', 'muted', 'subtle', 'primary', 'success', 'danger'] as const;

const meta = {
  title: 'Atoms/Text',
  component: Text,
  argTypes: {
    as: { control: 'inline-radio', options: ['p', 'span', 'div'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg'] },
    tone: { control: 'select', options: TONES },
    weight: { control: 'inline-radio', options: ['regular', 'medium', 'semibold'] },
  },
  render: (args, { globals }) => <Text {...args}>{args.children ?? storyCopy(globals).text.body}</Text>,
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: (args, { globals }) => (
    <div className="flex flex-col gap-2">
      {TONES.map((tone) => (
        <Text key={tone} {...args} tone={tone}>
          {tone}: {args.children ?? storyCopy(globals).text.body}
        </Text>
      ))}
    </div>
  ),
};
