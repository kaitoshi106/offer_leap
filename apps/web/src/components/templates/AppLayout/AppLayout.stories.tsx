import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { storyCopy } from '@/stories/copy';

import { Button, Heading, Icon, Text } from '../../atoms';
import { AppLayout, navLinkClasses } from './AppLayout';

const meta = {
  title: 'Templates/AppLayout',
  component: AppLayout,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  // The header's ThemeToggle needs the provider (not global in Storybook, see preview.tsx).
  decorators: [(Story) => <ThemeProvider>{Story()}</ThemeProvider>],
  args: { children: null },
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals).appLayout;
    return (
      <AppLayout
        navLabel={copy.navLabel}
        nav={
          <>
            <li>
              <a href="#overview" aria-current="page" className={navLinkClasses(true)}>
                {copy.overview}
              </a>
            </li>
            <li>
              <a href="#analyses" className={navLinkClasses(false)}>
                <Icon name="target" size="sm" />
                {copy.analyses}
              </a>
            </li>
          </>
        }
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
      </AppLayout>
    );
  },
};
