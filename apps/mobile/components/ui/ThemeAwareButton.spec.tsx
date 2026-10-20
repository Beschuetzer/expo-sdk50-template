import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemeAwareButton } from './ThemeAwareButton';

jest.mock('@gluestack-ui/themed', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    Button: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement('Button', props, children as React.ReactNode),
    ButtonSpinner: () => React.createElement('ButtonSpinner'),
    ButtonText: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement('ButtonText', props, children as React.ReactNode),
  };
});

jest.mock('@/components/ui/useThemeAwareColors', () => ({
  useThemeAwareColors: () => ({
    colorScheme: 'light',
    getTextColor: () => '$black',
  }),
}));

jest.mock('@/components/ui/useThemeAwareTypography', () => ({
  useThemeAwareTypography: () => ({ fontFamily: 'test-font' }),
}));

describe('ThemeAwareButton', () => {
  it('shows a spinner and blocks repeat presses until the callback finishes', async () => {
    let resolveCallback: (() => void) | undefined;
    const onPress = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCallback = resolve;
        }),
    );
    const tree = renderer.create(
      <ThemeAwareButton onPress={onPress}>Save</ThemeAwareButton>,
    );
    const findButton = () =>
      tree.root.find((instance) => String(instance.type) === 'Button');
    const findSpinners = () =>
      tree.root.findAll(
        (instance) => String(instance.type) === 'ButtonSpinner',
      );
    const findButtonText = () =>
      tree.root.findAll((instance) => String(instance.type) === 'ButtonText');
    const initialButton = findButton();
    let pressPromise!: Promise<void>;

    expect(findButtonText()).toHaveLength(1);

    act(() => {
      pressPromise = initialButton.props.onPress({});
      initialButton.props.onPress({});
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(findButton().props.isDisabled).toBe(true);
    expect(findSpinners()).toHaveLength(1);
    expect(findButtonText()).toHaveLength(0);

    await act(async () => {
      resolveCallback?.();
      await pressPromise;
    });

    expect(findButton().props.isDisabled).toBe(false);
    expect(findSpinners()).toHaveLength(0);
    expect(findButtonText()).toHaveLength(1);
    expect(findButtonText()[0].props.children).toBe('Save');
  });
});
