import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { BarChart } from './BarChart';

const data = Array.from({ length: 30 }, (_, index) => {
  const value = Math.round(8 + 6 * Math.sin(index / 3) + (index % 4));
  return { label: `${(index % 30) + 1}/10`, value, highlight: index % 7 === 0 ? 2 : 0 };
});

const meta = {
  title: 'Molecules/BarChart',
  component: BarChart,
  args: { data, title: '', summary: '', columns: ['', ''] },
  argTypes: { data: { control: false }, columns: { control: false } },
  decorators: [(Story) => <div className="w-[36rem]">{Story()}</div>],
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThirtyDays: Story = {
  render: (args, { globals }) => {
    const copy = storyCopy(globals).barChart;
    return (
      <BarChart
        {...args}
        title={copy.title}
        summary={copy.summary}
        columns={[copy.day, copy.calls, copy.failed]}
      />
    );
  },
};
