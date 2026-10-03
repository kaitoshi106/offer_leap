import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { storyCopy } from '@/stories/copy';

import { Radio } from './Radio';

const meta = {
  title: 'Atoms/Radio',
  component: Radio,
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Group: Story = {
  render: (args, { globals }) => {
    const copy = storyCopy(globals).radio;
    return (
      <fieldset className="flex flex-col gap-2 text-sm text-fg">
        <legend className="mb-2 font-medium">{copy.legend}</legend>
        {copy.options.map((label, index) => (
          <label key={label} className="flex cursor-pointer items-center gap-2">
            <Radio {...args} name="workType" value={String(index)} defaultChecked={index === 0} />
            {label}
          </label>
        ))}
      </fieldset>
    );
  },
};

export const Invalid: Story = {
  args: { invalid: true },
  render: (args, { globals }) => <Radio aria-label={storyCopy(globals).radio.options[1]} {...args} />,
};
