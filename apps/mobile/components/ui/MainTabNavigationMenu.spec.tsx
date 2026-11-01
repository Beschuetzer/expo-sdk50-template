import React, { type ReactNode } from 'react';
import renderer, { act } from 'react-test-renderer';

import { MainTabNavigationMenu } from './MainTabNavigationMenu';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@gluestack-ui/themed', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    VStack: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => React.createElement('VStackHost', props, children),
  };
});

jest.mock('@/components/ui/ThemeAwareButton', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareButton: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => React.createElement('ThemeAwareButtonHost', props, children),
  };
});

jest.mock('@/components/ui/ThemeAwareMenu', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareMenu: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => React.createElement('ThemeAwareMenuHost', props, children),
  };
});

jest.mock('@/components/ui/ThemeAwareText', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareHeading: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => React.createElement('ThemeAwareHeadingHost', props, children),
  };
});

jest.mock('@/utils/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('MainTabNavigationMenu', () => {
  afterEach(() => {
    mockPush.mockClear();
  });

  it('lists additional destinations alphabetically and closes before navigating', () => {
    const screen = renderer.create(<MainTabNavigationMenu />);
    const getMenu = () =>
      screen.root.find(
        (instance) => String(instance.type) === 'ThemeAwareMenuHost',
      );
    const menu = getMenu();

    expect(menu.props.side).toBe('left');
    expect(menu.props.header.props.children).toBe('menu.navigation');

    const actions = screen.root.findAll(
      (instance) => String(instance.type) === 'ThemeAwareButtonHost',
    );
    expect(actions.map((action) => action.props.children)).toEqual([
      'tabs.settings',
    ]);

    act(() => {
      getMenu().props.onOpenChange(true);
    });
    expect(getMenu().props.open).toBe(true);

    act(() => {
      actions[0].props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/settings');
    expect(getMenu().props.open).toBe(false);
    act(() => screen.unmount());
  });
});
