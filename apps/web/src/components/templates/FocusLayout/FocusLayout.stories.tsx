import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { storyCopy } from '@/stories/copy';

import { Button, Heading, Text } from '../../atoms';
import { FocusLayout } from './FocusLayout';

const meta = {
  title: 'Templates/FocusLayout',
  component: FocusLayout,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  // The header's ThemeToggle needs the provider (not global in Storybook, see preview.tsx).
  decorators: [(Story) => <ThemeProvider>{Story()}</ThemeProvider>],
  args: { children: null },
} satisfies Meta<typeof FocusLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals).focusLayout;
    return (
      <FocusLayout
        actions={
          <Button variant="ghost" size="sm">
            {copy.signOut}
          </Button>
        }
      >
        <Heading level={1} size="lg">
          {copy.title}
        </Heading>
        <Text tone="muted" className="mt-2">
          {copy.body}
        </Text>
      </FocusLayout>
    );
  },
};
