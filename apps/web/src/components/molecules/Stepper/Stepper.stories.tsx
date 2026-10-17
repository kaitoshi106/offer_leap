import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Stepper } from './Stepper';

const meta = {
  title: 'Molecules/Stepper',
  component: Stepper,
  args: { steps: [], current: 1, label: '', completedLabel: '' },
  argTypes: { current: { control: { type: 'range', min: 0, max: 3 } } },
  decorators: [(Story) => <div className="w-[36rem]">{Story()}</div>],
  render: (args, { globals }) => {
    const copy = storyCopy(globals).stepper;
    return (
      <Stepper
        {...args}
        label={copy.label}
        completedLabel={copy.completed}
        steps={copy.steps.map((label, index) => ({ key: String(index), label }))}
      />
    );
  },
} satisfies Meta<typeof Stepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};
export const LastStep: Story = { args: { current: 3 } };
