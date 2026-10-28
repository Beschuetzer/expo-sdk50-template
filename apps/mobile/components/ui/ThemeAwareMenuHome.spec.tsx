import React, { type ReactNode } from 'react';
import renderer, { act } from 'react-test-renderer';

import type { ThemeAwareMenuAction } from './ThemeAwareMenu';

import HomeScreen from '@/app/(tabs)/(home)/index';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({
      options,
    }: {
      options: { headerRight?: () => ReactNode };
    }) => {
      const React = jest.requireActual('react') as typeof import('react');

      return React.createElement(
        'StackScreen',
        { options },
        options.headerRight?.(),
      );
    },
  },
  useRouter: () => ({ push: mockRouterPush }),
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

describe('HomeScreen menu showcase', () => {
  afterEach(() => {
    mockRouterPush.mockClear();
  });

  it('shows unique highlights and sample content with quick navigation actions', () => {
    const tree = renderer.create(<HomeScreen />);
    const menu = tree.root.find(
      (instance) => String(instance.type) === 'ThemeAwareMenu',
    );
    const stackScreen = tree.root.find(
      (instance) => String(instance.type) === 'StackScreen',
    );
    const screenOptions = stackScreen.props.options as {
      headerRight?: () => ReactNode;
    };
    const quickActions = menu.props.quickActions as ThemeAwareMenuAction[];
    const headings = tree.root
      .findAll((instance) => String(instance.type) === 'ThemeAwareHeading')
      .map((instance) => instance.props.children);

    expect(screenOptions.headerRight).toEqual(expect.any(Function));
    expect(
      stackScreen.findAll(
        (instance) => String(instance.type) === 'ThemeAwareMenu',
      ),
    ).toHaveLength(1);
    expect(menu.props.side).toBe('right');
    expect(menu.props.width).toBe('85%');
    expect(quickActions.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: 'account', label: 'menu.accountAction' },
      { id: 'settings', label: 'menu.settingsAction' },
    ]);
    const expectedHighlightTitles = [
      'menu.themeAwareTitle',
      'menu.quickActionsTitle',
      'menu.responsiveTitle',
    ];
    const expectedSampleTitles = [
      'sampleContent.morningBriefTitle',
      'sampleContent.readingListTitle',
      'sampleContent.recentActivityTitle',
      'sampleContent.weeklyPlanTitle',
      'sampleContent.fieldNotesTitle',
      'sampleContent.communityBoardTitle',
      'sampleContent.photoJournalTitle',
    ];
    const highlightTitles = headings.filter((heading) =>
      expectedHighlightTitles.includes(heading),
    );
    const sampleTitles = headings.filter((heading) =>
      expectedSampleTitles.includes(heading),
    );

    expect(headings).toEqual(
      expect.arrayContaining([
        'menu.showcaseTitle',
        'menu.highlightsTitle',
        'sampleContent.sectionTitle',
      ]),
    );
    expect(highlightTitles).toEqual(expectedHighlightTitles);
    expect(new Set(highlightTitles).size).toBe(highlightTitles.length);
    expect(sampleTitles).toEqual(expectedSampleTitles);
    expect(new Set(sampleTitles).size).toBe(sampleTitles.length);
  });

  it('opens from the home call to action and closes before navigation', () => {
    const tree = renderer.create(<HomeScreen />);
    const getMenu = () =>
      tree.root.find((instance) => String(instance.type) === 'ThemeAwareMenu');
    const exploreButton = tree.root.find(
      (instance) => String(instance.type) === 'ThemeAwareButton',
    );

    act(() => exploreButton.props.onPress({}));
    expect(getMenu().props.open).toBe(true);

    for (const [actionId, route] of [
      ['account', '/AccountScreen'],
      ['settings', '/settings'],
    ]) {
      act(() => getMenu().props.onOpenChange(true));
      const quickActions = getMenu().props
        .quickActions as ThemeAwareMenuAction[];
      const action = quickActions.find(({ id }) => id === actionId);
      if (!action) {
        throw new Error(`Missing quick action: ${actionId}`);
      }

      act(() => action.onSelect());

      expect(mockRouterPush).toHaveBeenLastCalledWith(route);
      expect(getMenu().props.open).toBe(false);
    }
  });
});
