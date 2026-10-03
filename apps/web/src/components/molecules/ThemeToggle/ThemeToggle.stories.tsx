import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ThemeProvider } from '@/providers/ThemeProvider';

import { ThemeToggle } from './ThemeToggle';

const meta = {
  title: 'Molecules/ThemeToggle',
  component: ThemeToggle,
  decorators: [(Story) => <ThemeProvider>{Story()}</ThemeProvider>],
  parameters: {
    docs: {
      description: { component: 'Cycles light → dark → system. Overrides the toolbar theme when clicked.' },
    },
  },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
