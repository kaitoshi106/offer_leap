import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { hiddenControl, iconOptionControl, type IconOption, renderIconOption } from '@/stories/controls';
import { storyCopy } from '@/stories/copy';

import { Icon } from '../Icon';
import { Button, type ButtonProps } from './Button';

type StoryArgs = ButtonProps & { leftIconName?: IconOption; rightIconName?: IconOption };

const meta = {
  title: 'Atoms/Button',
  component: Button,
  args: { onClick: fn(), leftIconName: 'none', rightIconName: 'none' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'outline', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'icon'] },
    leftIcon: hiddenControl,
    rightIcon: hiddenControl,
    leftIconName: iconOptionControl('Icon before the label (sets `leftIcon`)'),
    rightIconName: iconOptionControl('Icon after the label (sets `rightIcon`)'),
  },
  render: ({ leftIconName, rightIconName, ...args }, { globals }) => (
    <Button {...args} leftIcon={renderIconOption(leftIconName)} rightIcon={renderIconOption(rightIconName)}>
      {args.children ?? storyCopy(globals).button.upload}
    </Button>
  ),
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Variants: Story = {
  render: ({ leftIconName, rightIconName, ...args }) => (
    <div className="flex flex-wrap gap-3">
      {(['primary', 'secondary', 'outline', 'ghost', 'danger'] as const).map((variant) => (
        <Button
          key={variant}
          {...args}
          variant={variant}
          leftIcon={renderIconOption(leftIconName)}
          rightIcon={renderIconOption(rightIconName)}
        >
          {args.children ?? variant[0]!.toUpperCase() + variant.slice(1)}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: ({ leftIconName: _left, rightIconName: _right, ...args }, { globals }) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
      <Button {...args} size="icon" aria-label={storyCopy(globals).button.upload}>
        <Icon name="upload" />
      </Button>
    </div>
  ),
};

/** Icon-only button: `size="icon"` + an `aria-label` (the icon itself is decorative). */
export const IconOnly: Story = {
  args: { size: 'icon', variant: 'outline' },
  render: ({ leftIconName: _left, rightIconName: _right, ...args }, { globals }) => (
    <Button {...args} aria-label={storyCopy(globals).button.upload}>
      <Icon name="upload" />
    </Button>
  ),
};

export const WithIcons: Story = {
  args: { leftIconName: 'upload', rightIconName: 'arrow-right' },
};

export const Loading: Story = {
  args: { loading: true },
  render: ({ leftIconName, rightIconName, ...args }, { globals }) => (
    <Button {...args} leftIcon={renderIconOption(leftIconName)} rightIcon={renderIconOption(rightIconName)}>
      {args.children ?? storyCopy(globals).button.uploading}
    </Button>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
