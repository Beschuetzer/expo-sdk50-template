import React from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { ThemeAwareMenu } from './ThemeAwareMenu';

let mockColorScheme = 'light';

jest.mock('@react-native-vector-icons/fontawesome', () => {
  const actualReact = jest.requireActual('react') as typeof import('react');

  return {
    FontAwesome: ({ name, ...props }: Record<string, unknown>) =>
      actualReact.createElement(String(name), props),
  };
});

jest.mock('zeego/dropdown-menu', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createComponent =
    (name: string) =>
    ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(name, props, children as React.ReactNode);

  return {
    Content: createComponent('ZeegoContent'),
    Item: createComponent('ZeegoItem'),
    ItemTitle: createComponent('ZeegoItemTitle'),
    Root: createComponent('ZeegoRoot'),
    Trigger: createComponent('ZeegoTrigger'),
  };
});

jest.mock('@/components/ui/useThemeAwareColors', () => ({
  useThemeAwareColors: () => ({ colorScheme: mockColorScheme }),
}));

jest.mock('@/utils/i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'menu.close': 'Close menu',
        'menu.moreActions': 'More menu actions',
        'menu.open': 'Open menu',
      })[key] ?? key,
  }),
}));

type PanResponderConfig = Parameters<typeof PanResponder.create>[0];
type PanResponderMoveHandler = NonNullable<
  PanResponderConfig['onMoveShouldSetPanResponder']
>;
type PanResponderEvent = Parameters<PanResponderMoveHandler>[0];
type PanResponderGestureState = Parameters<PanResponderMoveHandler>[1];

function capturePanResponderConfig() {
  let config: PanResponderConfig | undefined;
  const originalCreate = PanResponder.create.bind(PanResponder);
  jest.spyOn(PanResponder, 'create').mockImplementation((nextConfig) => {
    config = nextConfig;
    return originalCreate(nextConfig);
  });
  return () => config;
}

function createGestureState(
  dx: number,
  dy: number,
  vx = 0,
): PanResponderGestureState {
  return { dx, dy, vx } as PanResponderGestureState;
}

describe('ThemeAwareMenu', () => {
  let mountedTree: ReactTestRenderer | undefined;
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
    Platform,
    'OS',
  );

  afterEach(() => {
    if (mountedTree) {
      act(() => mountedTree?.unmount());
      mountedTree = undefined;
    }

    mockColorScheme = 'light';
    if (originalPlatformDescriptor) {
      Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    }
    jest.restoreAllMocks();
  });

  it('renders a translated hamburger trigger and opens the drawer', () => {
    const onOpenChange = jest.fn();
    act(() => {
      mountedTree = renderer.create(
        <ThemeAwareMenu onOpenChange={onOpenChange}>
          <Text>Menu content</Text>
        </ThemeAwareMenu>,
      );
    });
    const tree = mountedTree;
    if (!tree) {
      throw new Error('Expected the menu renderer to be initialized.');
    }
    const trigger = tree.root.findByProps({ accessibilityLabel: 'Open menu' });

    expect(trigger.props.accessibilityState).toEqual({ expanded: false });

    act(() => {
      trigger.props.onPress();
    });

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    expect(tree.root.findByType(Text).props.children).toBe('Menu content');
    const menuContent = tree.root.findByType(ScrollView);
    expect(menuContent.props.style).toEqual({ flex: 1 });
    expect(menuContent.props.contentContainerStyle).toEqual({ flexGrow: 1 });
    expect(menuContent.props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('provides default padding and spacing for the menu header', () => {
    act(() => {
      mountedTree = renderer.create(
        <ThemeAwareMenu
          defaultOpen
          header={
            <>
              <Text>Menu title</Text>
              <Text>Menu description</Text>
            </>
          }
        >
          <Text>Drawer content</Text>
        </ThemeAwareMenu>,
      );
    });
    const tree = mountedTree;
    if (!tree) {
      throw new Error('Expected the menu renderer to be initialized.');
    }

    const header = tree.root.findAllByType(View).find((instance) => {
      const style = StyleSheet.flatten(instance.props.style);
      return style?.borderBottomWidth === StyleSheet.hairlineWidth;
    });
    const headerContent = tree.root.findAllByType(View).find((instance) => {
      const style = StyleSheet.flatten(instance.props.style);
      return style?.gap === 4;
    });

    expect(StyleSheet.flatten(header?.props.style)).toEqual(
      expect.objectContaining({
        paddingLeft: 16,
        paddingRight: 8,
        paddingVertical: 8,
      }),
    );
    expect(StyleSheet.flatten(headerContent?.props.style)).toEqual(
      expect.objectContaining({ flex: 1, gap: 4 }),
    );
    expect(headerContent?.children).toHaveLength(2);
  });

  it('applies dark colors, width, and right-side positioning', () => {
    mockColorScheme = 'dark';
    act(() => {
      mountedTree = renderer.create(
        <ThemeAwareMenu
          darkBackground="#123456"
          darkBorderColor="#abcdef"
          darkIconColor="#fedcba"
          darkTextColor="#ffffff"
          open
          side="right"
          width={240}
        >
          <Text>Drawer content</Text>
        </ThemeAwareMenu>,
      );
    });
    const tree = mountedTree;
    if (!tree) {
      throw new Error('Expected the menu renderer to be initialized.');
    }
    const panel = tree.root
      .findAllByType(Animated.View)
      .find((instance) => Boolean(instance.props.accessibilityViewIsModal));

    expect(tree.root.findByType(Modal).props.visible).toBe(true);
    expect(panel).toBeDefined();
    const panelStyle = StyleSheet.flatten(panel?.props.style);

    expect(panelStyle?.right).toBe(0);
    expect(panelStyle?.width).toBe(240);
    expect(panelStyle?.backgroundColor).toBe('#123456');
    expect(panelStyle?.borderLeftColor).toBe('#abcdef');

    const trigger = tree.root.findByProps({ accessibilityLabel: 'Open menu' });
    expect(trigger.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: 'transparent' }),
      ]),
    );
  });

  it.each([
    { side: 'left' as const, closeDelta: -80, openDelta: 80 },
    { side: 'right' as const, closeDelta: 80, openDelta: -80 },
  ])('closes the $side menu when swiped toward its edge', ({
    side,
    closeDelta,
    openDelta,
  }) => {
    const onOpenChange = jest.fn();
    const getPanResponderConfig = capturePanResponderConfig();
    act(() => {
      mountedTree = renderer.create(
        <ThemeAwareMenu defaultOpen onOpenChange={onOpenChange} side={side}>
          <Text>Drawer content</Text>
        </ThemeAwareMenu>,
      );
    });
    const tree = mountedTree;
    if (!tree) {
      throw new Error('Expected the menu renderer to be initialized.');
    }
    const panel = tree.root
      .findAllByType(Animated.View)
      .find((instance) => Boolean(instance.props.accessibilityViewIsModal));
    if (!panel) {
      throw new Error('Expected the drawer panel to be rendered.');
    }
    const config = getPanResponderConfig();
    if (!config?.onMoveShouldSetPanResponder || !config.onPanResponderRelease) {
      throw new Error('Expected swipe handlers to be configured.');
    }
    const event = {} as PanResponderEvent;

    expect(
      config.onMoveShouldSetPanResponder(
        event,
        createGestureState(openDelta, 0),
      ),
    ).toBe(false);
    expect(
      config.onMoveShouldSetPanResponder(
        event,
        createGestureState(closeDelta / 4, 60),
      ),
    ).toBe(false);
    expect(
      config.onMoveShouldSetPanResponder(
        event,
        createGestureState(closeDelta / 4, 0),
      ),
    ).toBe(true);
    expect(panel.props.onMoveShouldSetResponder).toEqual(
      expect.any(Function),
    );

    act(() => {
      config.onPanResponderRelease?.(
        event,
        createGestureState(closeDelta, 0),
      );
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on a quick flick toward the closing edge', () => {
    const onOpenChange = jest.fn();
    const getPanResponderConfig = capturePanResponderConfig();
    act(() => {
      mountedTree = renderer.create(
        <ThemeAwareMenu defaultOpen onOpenChange={onOpenChange} side="left">
          <Text>Drawer content</Text>
        </ThemeAwareMenu>,
      );
    });
    const tree = mountedTree;
    if (!tree) {
      throw new Error('Expected the menu renderer to be initialized.');
    }
    const panel = tree.root
      .findAllByType(Animated.View)
      .find((instance) => Boolean(instance.props.accessibilityViewIsModal));
    if (!panel) {
      throw new Error('Expected the drawer panel to be rendered.');
    }
    const config = getPanResponderConfig();
    if (!config?.onMoveShouldSetPanResponder || !config.onPanResponderRelease) {
      throw new Error('Expected swipe handlers to be configured.');
    }
    const event = {} as PanResponderEvent;
    const gestureState = createGestureState(-20, 0, -0.6);

    expect(
      config.onMoveShouldSetPanResponder(event, gestureState),
    ).toBe(true);
    expect(panel.props.onResponderRelease).toEqual(expect.any(Function));
    act(() => {
      config.onPanResponderRelease?.(event, gestureState);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('runs native quick actions and closes their action list', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    const onSelect = jest.fn();
    act(() => {
      mountedTree = renderer.create(
        <ThemeAwareMenu
          defaultOpen
          quickActions={[{ id: 'settings', label: 'Settings', onSelect }]}
        >
          <Text>Drawer content</Text>
        </ThemeAwareMenu>,
      );
    });
    const tree = mountedTree;
    if (!tree) {
      throw new Error('Expected the menu renderer to be initialized.');
    }
    const quickActionsTrigger = tree.root.findByProps({
      accessibilityLabel: 'More menu actions',
    });

    act(() => {
      quickActionsTrigger.props.onPress();
    });

    const header = tree.root.findAllByType(View).find((instance) => {
      const style = StyleSheet.flatten(instance.props.style);
      return style?.borderBottomWidth === StyleSheet.hairlineWidth;
    });
    const quickActionsPanel = tree.root.findAllByType(View).find((instance) => {
      const style = StyleSheet.flatten(instance.props.style);
      return style?.minWidth === 180;
    });

    expect(StyleSheet.flatten(header?.props.style)).toEqual(
      expect.objectContaining({ elevation: 1, zIndex: 1 }),
    );
    expect(StyleSheet.flatten(quickActionsPanel?.props.style)).toEqual(
      expect.objectContaining({
        backgroundColor: '#000',
        elevation: 12,
        zIndex: 2,
      }),
    );
    const actionLabel = tree.root
      .findAllByType(Text)
      .find((instance) => instance.props.children === 'Settings');
    expect(actionLabel?.props.style).toEqual({ color: '#fff' });

    const actionButton = tree.root.findByProps({
      accessibilityLabel: 'Settings',
    });

    act(() => {
      actionButton?.props.onPress();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(
      tree.root.findAll(
        (instance) => instance.props.accessibilityLabel === 'Settings',
      ),
    ).toHaveLength(0);
  });

  it.each([
    {
      label: 'defaults to inverted colors',
      quickActionsColorSchemeInversion: undefined,
      expectedBackgroundColor: '#fedcba',
      expectedTextColor: '#123456',
    },
    {
      label: 'matches menu colors when inversion is disabled',
      quickActionsColorSchemeInversion: false,
      expectedBackgroundColor: '#123456',
      expectedTextColor: '#fedcba',
    },
  ])(
    '$label for web quick actions',
    ({
      quickActionsColorSchemeInversion,
      expectedBackgroundColor,
      expectedTextColor,
    }) => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: 'web',
      });
      mockColorScheme = 'dark';
      act(() => {
        mountedTree = renderer.create(
          <ThemeAwareMenu
            darkBackground="#123456"
            darkTextColor="#fedcba"
            defaultOpen
            quickActionsColorSchemeInversion={
              quickActionsColorSchemeInversion
            }
            quickActions={[
              { id: 'settings', label: 'Settings', onSelect: jest.fn() },
            ]}
            side="right"
          >
            <Text>Drawer content</Text>
          </ThemeAwareMenu>,
        );
      });
      const tree = mountedTree;
      if (!tree) {
        throw new Error('Expected the menu renderer to be initialized.');
      }
      const menuContent = tree.root.find(
        (instance) => String(instance.type) === 'ZeegoContent',
      );
      const menuItem = tree.root.find(
        (instance) => String(instance.type) === 'ZeegoItem',
      );
      const menuItemTitle = tree.root.find(
        (instance) => String(instance.type) === 'ZeegoItemTitle',
      );

      expect(menuContent.props.side).toBe('left');
      expect(menuContent.props.style.backgroundColor).toBe(
        expectedBackgroundColor,
      );
      expect(menuItem.props.onSelect).toEqual(expect.any(Function));
      expect(menuItemTitle.props.style.color).toBe(expectedTextColor);
    },
  );

  it('uses menu colors for native quick actions when inversion is disabled', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    act(() => {
      mountedTree = renderer.create(
        <ThemeAwareMenu
          defaultOpen
          quickActionsColorSchemeInversion={false}
          quickActions={[
            { id: 'settings', label: 'Settings', onSelect: jest.fn() },
          ]}
        >
          <Text>Drawer content</Text>
        </ThemeAwareMenu>,
      );
    });
    const tree = mountedTree;
    if (!tree) {
      throw new Error('Expected the menu renderer to be initialized.');
    }
    const quickActionsTrigger = tree.root.findByProps({
      accessibilityLabel: 'More menu actions',
    });

    act(() => {
      quickActionsTrigger.props.onPress();
    });

    const quickActionsPanel = tree.root.findAllByType(View).find((instance) => {
      const style = StyleSheet.flatten(instance.props.style);
      return style?.minWidth === 180;
    });
    const actionLabel = tree.root
      .findAllByType(Text)
      .find((instance) => instance.props.children === 'Settings');

    expect(
      StyleSheet.flatten(quickActionsPanel?.props.style)?.backgroundColor,
    ).toBe('#fff');
    expect(actionLabel?.props.style).toEqual({ color: '#000' });
  });
});
