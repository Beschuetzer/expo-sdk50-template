import React from 'react';
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { ThemeAwareMenu } from './ThemeAwareMenu';

let mockColorScheme = 'light';

jest.mock('@expo/vector-icons/FontAwesome', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return ({ name, ...props }: Record<string, unknown>) =>
    React.createElement(String(name), props);
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

  it('uses inverted theme colors for web quick actions', () => {
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
    expect(menuContent.props.style.backgroundColor).toBe('#fedcba');
    expect(menuItem.props.onSelect).toEqual(expect.any(Function));
    expect(menuItemTitle.props.style.color).toBe('#123456');
  });
});
