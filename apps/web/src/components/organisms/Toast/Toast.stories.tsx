import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { type StoryCopy, storyCopy } from '@/stories/copy';

import { Button } from '../../atoms';
import { ToastProvider, useToast } from './Toast';

const meta = {
  title: 'Organisms/Toast',
  component: ToastProvider,
  args: { dismissLabel: '', children: null },
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

function Triggers({ copy }: { copy: StoryCopy['toast'] }) {
  const toast = useToast();
  return (
    <div className="flex gap-3">
      <Button
        onClick={() => toast.show({ tone: 'success', title: copy.success, description: copy.description })}
      >
        {copy.show}
      </Button>
      <Button variant="danger" onClick={() => toast.show({ tone: 'danger', title: copy.error })}>
        {copy.error}
      </Button>
    </div>
  );
}

export const Playground: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals).toast;
    return (
      <ToastProvider dismissLabel={copy.dismiss}>
        <Triggers copy={copy} />
      </ToastProvider>
    );
  },
};
