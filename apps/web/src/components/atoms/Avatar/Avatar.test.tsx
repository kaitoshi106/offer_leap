import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar, getInitials } from './Avatar';

describe('getInitials', () => {
  it.each([
    ['Trần Minh', 'TM'],
    ['Nguyễn Văn An', 'NA'],
    ['  minh  ', 'M'],
    ['', ''],
  ])('%s → %s', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});

describe('Avatar', () => {
  it('shows initials when there is no image', () => {
    render(<Avatar name="Trần Minh" />);
    expect(screen.getByRole('img', { name: 'Trần Minh' })).toHaveTextContent('TM');
  });

  it('falls back to initials when the image fails to load', () => {
    render(<Avatar name="Trần Minh" src="https://example.com/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Trần Minh' }));
    expect(screen.getByRole('img', { name: 'Trần Minh' })).toHaveTextContent('TM');
  });
});
