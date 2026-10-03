import type { ArgTypes } from '@storybook/nextjs-vite';

import { Icon, ICON_NAMES, type IconName, type IconProps } from '@/components/atoms';

export const ICON_OPTIONS = ['none', ...ICON_NAMES] as const;
export type IconOption = (typeof ICON_OPTIONS)[number];

/**
 * @description Dropdown control for picking an icon by name. Used instead of exposing `ReactNode` props
 * (Storybook would show a raw JSON editor for them, and any edit crashes the story).
 * @param description - Text shown in the Controls table.
 * @returns An argType config.
 */
export function iconOptionControl(description: string): ArgTypes[string] {
  return { control: 'select', options: ICON_OPTIONS, description, table: { category: 'Story controls' } };
}

/** Hides a `ReactNode` prop from the Controls table (it is driven by an icon option instead). */
export const hiddenControl: ArgTypes[string] = { table: { disable: true } };

/**
 * @description Turns an icon option into an element.
 * @param option - Icon name or `'none'`.
 * @param size - Icon size.
 * @returns `<Icon>` or `undefined`.
 */
export function renderIconOption(option: IconOption | undefined, size: IconProps['size'] = 'sm') {
  return option && option !== 'none' ? <Icon name={option as IconName} size={size} /> : undefined;
}
