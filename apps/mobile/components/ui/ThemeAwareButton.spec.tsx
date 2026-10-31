import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemeAwareButton } from './ThemeAwareButton';
import { ThemeAwareButtonPaletteProvider } from './ThemeAwareButtonPalette';

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

  it('allows multiline labels to wrap and expand the button height', () => {
    const label =
      'Continue after reviewing the details below. This text should wrap on a narrow screen.';
    const tree = renderer.create(
      <ThemeAwareButton size="sm">{label}</ThemeAwareButton>,
    );
    const button = tree.root.find(
      (instance) => String(instance.type) === 'Button',
    );
    const buttonText = tree.root.find(
      (instance) => String(instance.type) === 'ButtonText',
    );

    expect(button.props.height).toBe('auto');
    expect(button.props.minHeight).toBe('$9');
    expect(button.props.py).toBe('$2');
    expect(buttonText.props.flexShrink).toBe(1);
    expect(buttonText.props.textAlign).toBe('center');
    expect(buttonText.props.children).toBe(label);
  });

  it('preserves explicitly configured button heights', () => {
    const tree = renderer.create(
      <ThemeAwareButton h="$8">Custom height</ThemeAwareButton>,
    );
    const button = tree.root.find(
      (instance) => String(instance.type) === 'Button',
    );

    expect(button.props.height).toBe('$8');
    expect(button.props.minHeight).toBe('$8');
  });

  it('renders outline requests as solid buttons', () => {
    const tree = renderer.create(
      <ThemeAwareButton variant="outline">
        {React.createElement('Icon')}
      </ThemeAwareButton>,
    );
    const button = tree.root.find(
      (instance) => String(instance.type) === 'Button',
    );

    expect(button.props.variant).toBe('solid');
    expect(button.props.bg).toBe('#1769aa');
  });

  it('gives buttons on the same screen distinct palette colors', () => {
    const tree = renderer.create(
      <ThemeAwareButtonPaletteProvider>
        <ThemeAwareButton>First</ThemeAwareButton>
        <ThemeAwareButton>Second</ThemeAwareButton>
        <ThemeAwareButton>Third</ThemeAwareButton>
      </ThemeAwareButtonPaletteProvider>,
    );
    const backgrounds = tree.root
      .findAll((instance) => String(instance.type) === 'Button')
      .map((button) => button.props.bg);

    expect(new Set(backgrounds).size).toBe(3);
  });

  it('keeps link buttons transparent', () => {
    const tree = renderer.create(
      <ThemeAwareButton variant="link">Link</ThemeAwareButton>,
    );
    const button = tree.root.find(
      (instance) => String(instance.type) === 'Button',
    );
    const buttonText = tree.root.find(
      (instance) => String(instance.type) === 'ButtonText',
    );

    expect(button.props.bg).toBe('$transparent');
    expect(buttonText.props.color).toBe('#1769aa');
  });

  it('gives link buttons on the same screen distinct text colors', () => {
    const tree = renderer.create(
      <ThemeAwareButtonPaletteProvider>
        <ThemeAwareButton variant="link">First</ThemeAwareButton>
        <ThemeAwareButton variant="link">Second</ThemeAwareButton>
      </ThemeAwareButtonPaletteProvider>,
    );
    const textColors = tree.root
      .findAll((instance) => String(instance.type) === 'ButtonText')
      .map((text) => text.props.color);

    expect(new Set(textColors).size).toBe(2);
  });

  it('keeps link icon buttons transparent', () => {
    const tree = renderer.create(
      <ThemeAwareButton variant="link">
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
  });

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
});
