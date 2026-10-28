import React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { ThemeAwareIcon } from './ThemeAwareIcon';

let mockColorScheme = 'light';

jest.mock('@react-native-vector-icons/fontawesome', () => {
  const actualReact = jest.requireActual('react') as typeof import('react');

  return {
    FontAwesome: (props: Record<string, unknown>) =>
      actualReact.createElement('FontAwesomeMock', props),
  };
});

jest.mock('@/components/ui/useThemeAwareColors', () => ({
  useThemeAwareColors: () => ({ colorScheme: mockColorScheme }),
}));

function findMockIcon(tree: ReactTestRenderer) {
  const icon = tree.root.findAll(
    (instance) => String(instance.type) === 'FontAwesomeMock',
  )[0];

  if (!icon) {
    throw new Error('Expected the mocked icon to be rendered.');
  }

  return icon;
}

describe('ThemeAwareIcon', () => {
  let mountedTree: ReactTestRenderer | undefined;

  afterEach(() => {
    if (mountedTree) {
      act(() => mountedTree?.unmount());
      mountedTree = undefined;
    }

    mockColorScheme = 'light';
  });

  it.each([
    { colorScheme: 'light', expectedColor: '#2f95dc' },
    { colorScheme: 'dark', expectedColor: '#fff' },
  ])('uses the $colorScheme theme color by default', ({
    colorScheme,
    expectedColor,
  }) => {
    mockColorScheme = colorScheme;
    act(() => {
      mountedTree = renderer.create(
        <ThemeAwareIcon name="bars" size={20} testID="themed-icon" />,
      );
    });

    const tree = mountedTree;
    if (!tree) {
      throw new Error('Expected the icon renderer to be initialized.');
    }

    expect(findMockIcon(tree).props).toEqual(
      expect.objectContaining({
        color: expectedColor,
        name: 'bars',
        size: 20,
        testID: 'themed-icon',
      }),
    );
  });

  it('supports theme-specific colors and explicit color overrides', () => {
    mockColorScheme = 'dark';
    act(() => {
      mountedTree = renderer.create(
        <ThemeAwareIcon
          darkColor="#123456"
          lightColor="#abcdef"
          name="shield"
          size={32}
          style={{ margin: 4 }}
          testID="themed-icon"
        />,
      );
    });

    const tree = mountedTree;
    if (!tree) {
      throw new Error('Expected the icon renderer to be initialized.');
    }

    const icon = findMockIcon(tree);
    expect(icon.props.color).toBe('#123456');
    expect(icon.props.style).toEqual({ margin: 4 });

    act(() => {
      tree.update(
        <ThemeAwareIcon
          color="#00ff00"
          darkColor="#123456"
          name="shield"
          size={32}
          testID="themed-icon"
        />,
      );
    });

    expect(findMockIcon(tree).props.color).toBe('#00ff00');
  });
});
