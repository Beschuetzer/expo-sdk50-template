import React from 'react';
import renderer from 'react-test-renderer';

import { ThemeAwareDropdown } from './ThemeAwareDropdown';

let mockTextColor = '$textLight900';

jest.mock('@gluestack-ui/themed', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createComponent =
    (name: string) =>
    ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(name, props, children as React.ReactNode);

  return {
    ChevronDownIcon: () => React.createElement('ChevronDownIcon'),
    Select: createComponent('Select'),
    SelectBackdrop: createComponent('SelectBackdrop'),
    SelectContent: createComponent('SelectContent'),
    SelectIcon: createComponent('SelectIcon'),
    SelectInput: createComponent('SelectInput'),
    SelectItem: createComponent('SelectItem'),
    SelectPortal: createComponent('SelectPortal'),
    SelectTrigger: createComponent('SelectTrigger'),
  };
});

jest.mock('@/components/ui/useThemeAwareColors', () => ({
  useThemeAwareColors: () => ({ textColor: mockTextColor }),
}));

jest.mock('@/components/ui/useThemeAwareTypography', () => ({
  useThemeAwareTypography: () => ({ fontFamily: 'test-font' }),
}));

describe('ThemeAwareDropdown', () => {
  afterEach(() => {
    mockTextColor = '$textLight900';
  });

  it('applies theme-aware text and displays the selected option label', () => {
    mockTextColor = '$textDark50';
    const onValueChange = jest.fn();
    const tree = renderer.create(
      <ThemeAwareDropdown
        onValueChange={onValueChange}
        options={[
          { label: 'Shared', value: 'shared' },
          { label: 'Personal', value: 'personal' },
        ]}
        placeholder="Choose a space"
        selectedValue="personal"
      />,
    );
    const selectInput = tree.root.find(
      (instance) => String(instance.type) === 'SelectInput',
    );
    const selectIcon = tree.root.find(
      (instance) => String(instance.type) === 'SelectIcon',
    );
    const select = tree.root.find(
      (instance) => String(instance.type) === 'Select',
    );

    expect(selectInput.props.color).toBe('$textDark50');
    expect(selectInput.props.fontFamily).toBe('test-font');
    expect(selectInput.props.value).toBe('Personal');
    expect(selectIcon.props.color).toBe('$textDark50');
    expect(select.props.selectedValue).toBe('personal');

    select.props.onValueChange('shared');
    expect(onValueChange).toHaveBeenCalledWith('shared');
  });
});
