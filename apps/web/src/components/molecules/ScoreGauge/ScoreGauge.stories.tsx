import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { ScoreGauge } from './ScoreGauge';

const meta = {
  title: 'Molecules/ScoreGauge',
  component: ScoreGauge,
  args: { score: 72, label: '', valueText: '', tone: 'primary', size: 'lg' },
  argTypes: {
    score: { control: { type: 'range', min: 0, max: 100 } },
    tone: { control: 'inline-radio', options: ['success', 'primary', 'warning', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'lg'] },
    label: { control: false },
    valueText: { control: false },
  },
} satisfies Meta<typeof ScoreGauge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args, { globals }) => {
    const copy = storyCopy(globals).scoreGauge;
    return <ScoreGauge {...args} label={copy.label} valueText={`${args.score} / 100`} />;
  },
};

/** Bands used by the CV ↔ job analysis. */
export const Bands: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals).scoreGauge;
    const bands = [
      [88, 'success'],
      [72, 'primary'],
      [51, 'warning'],
      [30, 'danger'],
    ] as const;
    return (
      <div className="flex gap-6">
        {bands.map(([score, tone]) => (
          <div key={score} className="flex flex-col items-center gap-2">
            <ScoreGauge score={score} tone={tone} label={copy.label} valueText={`${score} / 100`} />
            <ScoreGauge score={score} tone={tone} size="sm" label={copy.label} valueText={`${score} / 100`} />
          </div>
        ))}
      </div>
    );
  },
};
