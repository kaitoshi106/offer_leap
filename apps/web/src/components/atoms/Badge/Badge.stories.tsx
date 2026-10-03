import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { hiddenControl, iconOptionControl, type IconOption, renderIconOption } from '@/stories/controls';
import { storyCopy } from '@/stories/copy';

import { Icon } from '../Icon';
import { Badge, type BadgeProps } from './Badge';

type StoryArgs = BadgeProps & { iconName?: IconOption };

const meta = {
  title: 'Atoms/Badge',
  component: Badge,
  args: { tone: 'ai', iconName: 'sparkles' },
  argTypes: {
    tone: {
      control: 'select',
      options: ['neutral', 'primary', 'success', 'warning', 'danger', 'info', 'ai'],
    },
    icon: hiddenControl,
    iconName: iconOptionControl('Icon before the label (sets `icon`)'),
  },
  render: ({ iconName, ...args }, { globals }) => (
    <Badge {...args} icon={renderIconOption(iconName, 'xs')}>
      {args.children ?? storyCopy(globals).badge.ai}
    </Badge>
  ),
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals).badge;
    return (
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{copy.draft}</Badge>
        <Badge tone="primary">{copy.applied}</Badge>
        <Badge tone="success">{copy.offer}</Badge>
        <Badge tone="warning">{copy.review}</Badge>
        <Badge tone="danger">{copy.rejected}</Badge>
        <Badge tone="info">{copy.interview}</Badge>
        <Badge tone="ai" icon={<Icon name="sparkles" size="xs" />}>
          {copy.ai}
        </Badge>
      </div>
    );
  },
};
