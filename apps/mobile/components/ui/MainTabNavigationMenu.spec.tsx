import React, { type ReactNode } from 'react';
import renderer, { act } from 'react-test-renderer';

import { MainTabNavigationMenu } from './MainTabNavigationMenu';

const mockPush = jest.fn();
const mockTabsNavigate = jest.fn();

jest.mock('expo-router', () => ({
  useNavigation: () => ({ navigate: mockTabsNavigate }),
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
      'jointAccountCharges.create',
      'rules.create',
      'home.findRelationship',
      'paymentRequests.createRequest',
      'tabs.settings',
      'paymentRequests.viewAllRequests',
      'rules.viewAll',
      'jointAccountCharges.viewAll',
      'paymentRequests.awaitingDecision',
    ]);

    const destinations = [
      { tab: '(requests)', screen: 'NewJointAccountChargeScreen' },
      { tab: '(rules)', screen: 'NewRelationshipRuleScreen' },
      { route: '/search-relationships' },
      { tab: '(requests)', screen: 'NewPaymentRequestScreen' },
      { route: '/settings' },
      { tab: '(requests)', screen: 'ViewAllRequestsScreen' },
      { tab: '(rules)', screen: 'ViewAllRulesScreen' },
      { tab: '(requests)', screen: 'JointAccountChargesScreen' },
      { tab: '(requests)', screen: 'AwaitingDecisionScreen' },
    ];

    act(() => {
      getMenu().props.onOpenChange(true);
    });
    expect(getMenu().props.open).toBe(true);

    let tabNavigationCall = 0;
    let routerPushCall = 0;
    actions.forEach((action, index) => {
      act(() => {
        action.props.onPress();
      });

      const destination = destinations[index];
      if ('tab' in destination) {
        tabNavigationCall += 1;
        expect(mockTabsNavigate).toHaveBeenNthCalledWith(
          tabNavigationCall,
          destination.tab,
          { initial: false, screen: destination.screen },
        );
      } else {
        routerPushCall += 1;
        expect(mockPush).toHaveBeenNthCalledWith(
          routerPushCall,
          destination.route,
        );
      }
      expect(getMenu().props.open).toBe(false);
    });

    act(() => screen.unmount());
  });
});
