import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Alert } from './Alert';

const meta = {
  title: 'Molecules/Alert',
  component: Alert,
  argTypes: { tone: { control: 'inline-radio', options: ['info', 'success', 'warning', 'danger'] } },
  decorators: [(Story) => <div className="w-96">{Story()}</div>],
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals).alert;
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="info" title={copy.infoTitle}>
          {copy.info}
        </Alert>
        <Alert tone="success">{copy.success}</Alert>
        <Alert tone="warning">{copy.warning}</Alert>
        <Alert tone="danger">{copy.danger}</Alert>
      </div>
    );
  },
};
