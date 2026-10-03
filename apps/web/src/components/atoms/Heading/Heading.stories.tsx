import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Heading } from './Heading';

const meta = {
  title: 'Atoms/Heading',
  component: Heading,
  args: { level: 2 },
  argTypes: {
    level: { control: 'inline-radio', options: [1, 2, 3, 4, 5, 6] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] },
  },
  render: (args, { globals }) => (
    <Heading {...args}>{args.children ?? storyCopy(globals).heading.title}</Heading>
  ),
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Scale: Story = {
  render: (_args, { globals }) => (
    <div className="flex flex-col gap-3">
      {([1, 2, 3, 4, 5, 6] as const).map((level) => (
        <Heading key={level} level={level}>
          {storyCopy(globals).heading.level} {level}
        </Heading>
      ))}
    </div>
  ),
};
