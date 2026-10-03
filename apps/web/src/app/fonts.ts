import { Roboto } from 'next/font/google';

/** Variable font (all weights) with the Vietnamese subset. Shared by the app layout and Storybook. */
export const roboto = Roboto({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-roboto',
  display: 'swap',
});
