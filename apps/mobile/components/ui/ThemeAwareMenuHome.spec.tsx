import React, { type ReactNode } from 'react';

import HomeScreen from '@/app/(tabs)/(home)/index';
import { renderWithAct } from '@/test-utils/renderWithAct';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({
      options,
    }: {
      options?: { headerRight?: () => ReactNode };
    }) => {
      const React = jest.requireActual('react') as typeof import('react');

      return React.createElement(
        'StackScreen',
        { options },
        options?.headerRight?.(),
      );
    },
  },
}));

jest.mock('@gluestack-ui/themed', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createComponent =
    (name: string) =>
    ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) =>
      React.createElement(name, props, children);

  return {
    HStack: createComponent('HStack'),
    VStack: createComponent('VStack'),
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
    }) => React.createElement('ThemeAwareButton', props, children),
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
    }) => React.createElement('ThemeAwareMenu', props, children),
  };
});

jest.mock('@/components/ui/ThemeAwareScreen', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    ThemeAwareScreen: ({ children }: { children?: ReactNode }) =>
      React.createElement('ThemeAwareScreen', null, children),
  };
});

jest.mock('@/components/ui/ThemeAwareSurface', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    ThemeAwareSurface: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => React.createElement('ThemeAwareSurface', props, children),
  };
});

jest.mock('@/components/ui/ThemeAwareText', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createText =
    (name: string) =>
    ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) =>
      React.createElement(name, props, children);

  return {
    ThemeAwareHeading: createText('ThemeAwareHeading'),
    ThemeAwareText: createText('ThemeAwareText'),
  };
});

jest.mock('@/utils/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('HomeScreen landing page', () => {
  it('renders the localized starter content without a menu', () => {
    const tree = renderWithAct(<HomeScreen />);
    const stackScreen = tree.root.find(
      (instance) => String(instance.type) === 'StackScreen',
    );
    const headings = tree.root
      .findAll((instance) => String(instance.type) === 'ThemeAwareHeading')
      .map((instance) => instance.props.children);

    expect(stackScreen.props.options).toBeUndefined();
    expect(headings).toEqual(['app.title', 'menu.showcaseTitle']);
    expect(
      tree.root
        .findAll((instance) => String(instance.type) === 'ThemeAwareText')
        .map((instance) => instance.props.children),
    ).toEqual(['app.description', 'menu.showcaseDescription']);
    expect(
      tree.root.findAll(
        (instance) => String(instance.type) === 'ThemeAwareMenu',
      ),
    ).toHaveLength(0);
  });
});
