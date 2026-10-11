import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { storyCopy } from '@/stories/copy';

import { Button, Input } from '../../atoms';
import { FormField } from '../../molecules';
import { AuthLayout } from './AuthLayout';

const meta = {
  title: 'Templates/AuthLayout',
  component: AuthLayout,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  // The header's ThemeToggle needs the provider (not global in Storybook, see preview.tsx).
  decorators: [(Story) => <ThemeProvider>{Story()}</ThemeProvider>],
  args: { title: '', highlights: [], homeLabel: '', children: null },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = {
  render: (_args, { globals }) => {
    const copy = storyCopy(globals);
    const icons = ['file-text', 'target', 'message-square'] as const;
    return (
      <AuthLayout
        title={copy.authLayout.title}
        description={copy.authLayout.description}
        homeLabel={copy.authLayout.home}
        highlights={copy.authLayout.highlights.map((text, index) => ({ icon: icons[index]!, text }))}
      >
        <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
          <FormField label={copy.formField.email} required>
            {(field) => <Input {...field} type="email" />}
          </FormField>
          <Button type="submit" fullWidth size="lg">
            {copy.authLayout.title}
          </Button>
        </form>
      </AuthLayout>
    );
  },
};
