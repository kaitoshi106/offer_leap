import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { type StoryCopy, storyCopy } from '@/stories/copy';

import { Button } from '../../atoms';
import { Dialog } from './Dialog';

const meta = {
  title: 'Organisms/Dialog',
  component: Dialog,
  args: { open: false, onClose: () => {}, title: '', closeLabel: '' },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

function ConfirmDelete({ copy }: { copy: StoryCopy['dialog'] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        {copy.open}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={copy.title}
        description={copy.description}
        closeLabel={copy.close}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              {copy.cancel}
            </Button>
            <Button variant="danger" onClick={close}>
              {copy.confirm}
            </Button>
          </>
        }
      />
    </>
  );
}

/** Open it, then try Tab (focus stays inside), Escape and clicking the backdrop. */
export const Confirmation: Story = {
  render: (_args, { globals }) => <ConfirmDelete copy={storyCopy(globals).dialog} />,
};
