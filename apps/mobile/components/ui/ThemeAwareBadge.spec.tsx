import React from 'react';
import renderer from 'react-test-renderer';

import { ThemeAwareBadge } from './ThemeAwareBadge';

let mockColorScheme = 'light';

jest.mock('@gluestack-ui/themed', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createComponent =
    (name: string) =>
    ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(name, props, children as React.ReactNode);

  return {
    Badge: createComponent('Badge'),
    BadgeText: createComponent('BadgeText'),
  };
});

jest.mock('@/components/ui/useThemeAwareColors', () => ({
  useThemeAwareColors: () => ({ colorScheme: mockColorScheme }),
}));

jest.mock('@/components/ui/useThemeAwareTypography', () => ({
  useThemeAwareTypography: () => ({ fontFamily: 'test-font' }),
}));

describe('ThemeAwareBadge', () => {
  afterEach(() => {
    mockColorScheme = 'light';
  });

  it('uses dark background and text colors', () => {
    mockColorScheme = 'dark';
    const tree = renderer.create(
      <ThemeAwareBadge
        darkBackground="$error900"
        darkTextColor="$error100"
        lightBackground="$error100"
        lightTextColor="$error800"
      >
        Rejected
      </ThemeAwareBadge>,
    );
    const badge = tree.root.find(
      (instance) => String(instance.type) === 'Badge',
    );
    const badgeText = tree.root.find(
      (instance) => String(instance.type) === 'BadgeText',
    );

    expect(badge.props.bg).toBe('$error900');
    expect(badgeText.props.color).toBe('$error100');
    expect(badgeText.props.fontFamily).toBe('test-font');
  });

  it('uses light background and text colors', () => {
    const tree = renderer.create(
      <ThemeAwareBadge
        darkBackground="$error900"
        darkTextColor="$error100"
        lightBackground="$error100"
        lightTextColor="$error800"
      >
        Rejected
      </ThemeAwareBadge>,
    );
    const badge = tree.root.find(
      (instance) => String(instance.type) === 'Badge',
    );
    const badgeText = tree.root.find(
      (instance) => String(instance.type) === 'BadgeText',
    );

    expect(badge.props.bg).toBe('$error100');
    expect(badgeText.props.color).toBe('$error800');
    expect(badgeText.props.fontFamily).toBe('test-font');
  });
});
