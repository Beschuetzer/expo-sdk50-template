import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemeAwareButton } from './ThemeAwareButton';

let mockColorScheme: 'light' | 'dark' = 'light';

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
  beforeEach(() => {
    mockColorScheme = 'light';
  });

  it.each(['outline', 'link'] as const)(
    'keeps the %s variant transparent by default',
    async (variant) => {
      const tree = renderer.create(
        <ThemeAwareButton variant={variant}>Open</ThemeAwareButton>,
      );
      const button = tree.root.find(
        (instance) => String(instance.type) === 'Button',
      );

      expect(button.props.bg).toBe('$transparent');
      await act(async () => tree.unmount());
    },
  );

  it('uses an explicit background and preserves compound children', async () => {
    const tree = renderer.create(
      <ThemeAwareButton bg="$success500">
        <>Continue</>
      </ThemeAwareButton>,
    );
    const button = tree.root.find(
      (instance) => String(instance.type) === 'Button',
    );

    expect(button.props.bg).toBe('$success500');
    expect(
      tree.root.findAll((instance) => String(instance.type) === 'ButtonText'),
    ).toHaveLength(0);
    await act(async () => tree.unmount());
  });

  it('wraps numeric labels in the themed button text', async () => {
    const tree = renderer.create(<ThemeAwareButton>{42}</ThemeAwareButton>);
    const buttonTexts = tree.root.findAll(
      (instance) => String(instance.type) === 'ButtonText',
    );

    expect(buttonTexts).toHaveLength(1);
    expect(buttonTexts[0].props.children).toBe(42);
    await act(async () => tree.unmount());
  });

  it('uses the dark theme background in dark mode', async () => {
    mockColorScheme = 'dark';
    const tree = renderer.create(<ThemeAwareButton>Save</ThemeAwareButton>);
    const button = tree.root.find(
      (instance) => String(instance.type) === 'Button',
    );

    expect(button.props.bg).toBe('$primary600');
    await act(async () => tree.unmount());
  });

  it('does not invoke the press callback when disabled', async () => {
    const onPress = jest.fn();
    const tree = renderer.create(
      <ThemeAwareButton disabled onPress={onPress}>
        Save
      </ThemeAwareButton>,
    );
    const button = tree.root.find(
      (instance) => String(instance.type) === 'Button',
    );

    await act(async () => {
      await button.props.onPress({});
    });

    expect(onPress).not.toHaveBeenCalled();
    expect(
      tree.root.findAll(
        (instance) => String(instance.type) === 'ButtonSpinner',
      ),
    ).toHaveLength(0);
    await act(async () => tree.unmount());
  });

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
