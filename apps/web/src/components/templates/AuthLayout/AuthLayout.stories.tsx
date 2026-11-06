import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ThemeProvider } from '@/providers/ThemeProvider';
import { storyCopy } from '@/stories/copy';

import { Button, Input } from '../../atoms';
import { FormField } from '../../molecules';
import { AuthLayout } from './AuthLayout';

const PHOTOS = { morning: '/landing/morning.jpg', night: '/landing/night.jpg' };

const meta = {
  title: 'Templates/AuthLayout',
  component: AuthLayout,
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
  // The header's ThemeToggle needs the provider (not global in Storybook, see preview.tsx).
  decorators: [(Story) => <ThemeProvider>{Story()}</ThemeProvider>],
  args: {
    title: '',
    homeLabel: '',
    scene: { line: '', chips: [], credit: '' },
    photos: PHOTOS,
    children: null,
  },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

function renderLayout(variant: 'morning' | 'split', globals: Record<string, unknown>) {
  const copy = storyCopy(globals);
  return (
    <AuthLayout
      title={copy.authLayout.title}
      description={copy.authLayout.description}
      homeLabel={copy.authLayout.home}
      photos={PHOTOS}
      sceneVariant={variant}
      scene={{
        line: copy.authLayout.line,
        nightLine: copy.authLayout.line,
        chips: copy.authLayout.chips,
        credit: copy.authLayout.credit,
      }}
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
}

export const SignIn: Story = {
  render: (_args, { globals }) => renderLayout('morning', globals),
};

export const SignUp: Story = {
  render: (_args, { globals }) => renderLayout('split', globals),
};
