import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { type StoryCopy, storyCopy } from '@/stories/copy';

import { Label } from '../../atoms';
import { Combobox, type ComboboxOption } from './Combobox';

const PROVINCES: ComboboxOption[] = [
  { value: 'ha-noi', label: 'Hà Nội', keywords: 'Hanoi' },
  { value: 'ho-chi-minh', label: 'TP. Hồ Chí Minh', keywords: 'Ho Chi Minh City Saigon' },
  { value: 'da-nang', label: 'Đà Nẵng', keywords: 'Da Nang' },
  { value: 'hai-phong', label: 'Hải Phòng', keywords: 'Hai Phong' },
  { value: 'can-tho', label: 'Cần Thơ', keywords: 'Can Tho' },
  { value: 'hue', label: 'Huế', keywords: 'Hue' },
  { value: 'dak-lak', label: 'Đắk Lắk', keywords: 'Dak Lak' },
];

const meta = {
  title: 'Organisms/Combobox',
  component: Combobox,
  args: { options: PROVINCES, value: null, onChange: () => {}, noResultsLabel: '' },
  decorators: [(Story) => <div className="h-80 w-80">{Story()}</div>],
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

function Demo({ copy, invalid }: { copy: StoryCopy['combobox']; invalid?: boolean }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="province">{copy.label}</Label>
      <Combobox
        id="province"
        options={PROVINCES}
        value={value}
        onChange={setValue}
        placeholder={copy.placeholder}
        noResultsLabel={copy.noResults}
        invalid={invalid}
      />
    </div>
  );
}

/** Try typing without accents ("da nang", "saigon"), ↑/↓, Enter, Escape. */
export const SearchWithoutAccents: Story = {
  render: (_args, { globals }) => <Demo copy={storyCopy(globals).combobox} />,
};

export const Invalid: Story = {
  render: (_args, { globals }) => <Demo copy={storyCopy(globals).combobox} invalid />,
};
