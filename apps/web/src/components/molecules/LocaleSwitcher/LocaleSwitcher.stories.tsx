import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { LocaleSwitcher } from './LocaleSwitcher';

const meta = {
  title: 'Molecules/LocaleSwitcher',
  component: LocaleSwitcher,
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/vi' } } },
} satisfies Meta<typeof LocaleSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
