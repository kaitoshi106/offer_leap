import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { storyCopy } from '@/stories/copy';

import { FileDropzone } from './FileDropzone';

const meta = {
  title: 'Molecules/FileDropzone',
  component: FileDropzone,
  args: {
    title: '',
    accept: ['application/pdf', '.docx', 'image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 10 * 1024 * 1024,
    onFile: () => {},
  },
  argTypes: { title: { control: false }, hint: { control: false }, onFile: { control: false } },
  decorators: [(Story) => <div className="w-[28rem]">{Story()}</div>],
} satisfies Meta<typeof FileDropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick or drop a file: the story shows what was accepted or why it was rejected. */
export const Playground: Story = {
  render: function Render(args, { globals }) {
    const copy = storyCopy(globals).dropzone;
    const [message, setMessage] = useState<string>();
    const [error, setError] = useState<string>();
    return (
      <div className="flex flex-col gap-3">
        <FileDropzone
          {...args}
          title={copy.title}
          hint={copy.hint}
          error={error}
          onFile={(file) => {
            setError(undefined);
            setMessage(`${copy.accepted}: ${file.name}`);
          }}
          onReject={(reason) => {
            setMessage(undefined);
            setError(reason === 'size' ? copy.tooLarge : copy.wrongType);
          }}
        />
        {message && <p className="text-sm text-fg-muted">{message}</p>}
      </div>
    );
  },
};

export const WithError: Story = {
  render: (args, { globals }) => {
    const copy = storyCopy(globals).dropzone;
    return <FileDropzone {...args} title={copy.title} hint={copy.hint} error={copy.wrongType} />;
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args, { globals }) => {
    const copy = storyCopy(globals).dropzone;
    return <FileDropzone {...args} title={copy.title} hint={copy.hint} />;
  },
};
