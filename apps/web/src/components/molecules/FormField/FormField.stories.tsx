import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Input } from '../../atoms';
import { FormField } from './FormField';

const meta = {
  title: 'Molecules/FormField',
  component: FormField,
  args: { label: '', children: () => null },
  argTypes: { label: { control: false }, children: { control: false } },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHint: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals).formField;
    return (
      <FormField label={copy.email} hint={copy.hint} required>
        {(field) => <Input {...field} type="email" />}
      </FormField>
    );
  },
};

export const WithError: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals).formField;
    return (
      <FormField label={copy.email} hint={copy.hint} error={copy.error} required>
        {(field) => <Input {...field} type="email" defaultValue="minh@" />}
      </FormField>
    );
  },
};
