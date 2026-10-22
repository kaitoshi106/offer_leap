import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { type StoryCopy, storyCopy } from '@/stories/copy';

import { cn } from '@/lib/cn';

import { Button, Icon } from '../../atoms';
import { Drawer } from './Drawer';

const meta = {
  title: 'Organisms/Drawer',
  component: Drawer,
  args: { open: false, onClose: () => {}, label: '', closeLabel: '', children: null },
  argTypes: { children: { control: false }, header: { control: false }, footer: { control: false } },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

function Menu({ copy }: { copy: StoryCopy['drawer'] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label={copy.open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        label={copy.title}
        closeLabel={copy.close}
        header={<span className="font-bold">OfferLeap</span>}
        footer={
          <Button variant="outline" fullWidth onClick={() => setOpen(false)}>
            {copy.signOut}
          </Button>
        }
      >
        <ul className="flex flex-col gap-1">
          {copy.items.map((item, index) => (
            <li key={item}>
              <a
                href={`#${index}`}
                aria-current={index === 0 ? 'page' : undefined}
                className={cn(
                  'flex h-11 items-center rounded-md px-3 font-medium',
                  index === 0
                    ? 'bg-primary-soft text-primary-soft-fg'
                    : 'text-fg-muted hover:bg-surface-muted',
                )}
              >
                {item}
              </a>
            </li>
          ))}
        </ul>
      </Drawer>
    </>
  );
}

export const Playground: Story = {
  render: (_args, { globals }) => <Menu copy={storyCopy(globals).drawer} />,
};
