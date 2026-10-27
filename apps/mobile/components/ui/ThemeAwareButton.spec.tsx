import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemeAwareButton } from './ThemeAwareButton';

let mockColorScheme = 'light';

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
    colorScheme: mockColorScheme,
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

  it('uses dark-theme backgrounds and supports custom button backgrounds', () => {
    mockColorScheme = 'dark';
    const darkTree = renderer.create(
      <ThemeAwareButton darkBackground="$dark-custom">Dark</ThemeAwareButton>,
    );
    const darkButton = darkTree.root.find(
      (instance) => String(instance.type) === 'Button',
    );

    expect(darkButton.props.bg).toBe('$dark-custom');

    const customTree = renderer.create(
      <ThemeAwareButton bg="$explicit">Custom</ThemeAwareButton>,
    );
    const customButton = customTree.root.find(
      (instance) => String(instance.type) === 'Button',
    );

    expect(customButton.props.bg).toBe('$explicit');
    mockColorScheme = 'light';
  });

  it.each(['outline', 'link'] as const)(
    'uses a transparent background for the %s variant',
    (variant) => {
      const tree = renderer.create(
        <ThemeAwareButton variant={variant}>
          {React.createElement('Icon')}
        </ThemeAwareButton>,
      );
      const button = tree.root.find(
        (instance) => String(instance.type) === 'Button',
      );

      expect(button.props.bg).toBe('$transparent');
      expect(
        tree.root.findAll((instance) => String(instance.type) === 'ButtonText'),
      ).toHaveLength(0);
    },
  );

  it('ignores presses when no handler is provided or the button is disabled', () => {
    const withoutHandler = renderer.create(
      <ThemeAwareButton>Static</ThemeAwareButton>,
    );
    const disabled = renderer.create(
      <ThemeAwareButton disabled onPress={jest.fn()}>
        Disabled
      </ThemeAwareButton>,
    );

    act(() => {
      withoutHandler.root
        .find((instance) => String(instance.type) === 'Button')
        .props.onPress({});
      disabled.root
        .find((instance) => String(instance.type) === 'Button')
        .props.onPress({});
    });

    expect(
      disabled.root.find((instance) => String(instance.type) === 'Button').props
        .isDisabled,
    ).toBe(true);
  });

  it('resets loading state when a press callback rejects and unmounts cleanly', async () => {
    const failure = new Error('save failed');
    const tree = renderer.create(
      <ThemeAwareButton onPress={() => Promise.reject(failure)}>
        Save
      </ThemeAwareButton>,
    );
    const button = tree.root.find(
      (instance) => String(instance.type) === 'Button',
    );
    let pressPromise!: Promise<void>;

    act(() => {
      pressPromise = button.props.onPress({});
    });

    await act(async () => {
      await expect(pressPromise).rejects.toBe(failure);
    });

    expect(
      tree.root.find((instance) => String(instance.type) === 'Button').props
        .isDisabled,
    ).toBe(false);
    act(() => tree.unmount());
  });
});
