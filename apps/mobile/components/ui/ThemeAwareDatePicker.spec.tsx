import React from 'react';
import { act } from 'react-test-renderer';

import { ThemeAwareDatePicker } from './ThemeAwareDatePicker';

import { renderWithAct } from '@/test-utils/renderWithAct';

jest.mock('./ThemeAwareTimePicker', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareTimePicker: (props: Record<string, unknown>) =>
      React.createElement('ThemeAwareTimePickerHost', props),
  };
});

describe('ThemeAwareDatePicker', () => {
  it('forwards picker props with date-only mode', () => {
    const value = new Date('2025-01-03T00:00:00.000Z');
    const tree = renderWithAct(
      <ThemeAwareDatePicker accessibilityLabel="Choose date" value={value} />,
    );
    const picker = tree.root.find(
      (instance) => String(instance.type) === 'ThemeAwareTimePickerHost',
    );

    expect(picker.props).toEqual(
      expect.objectContaining({
        accessibilityLabel: 'Choose date',
        mode: 'date',
        value,
      }),
    );

    act(() => tree.unmount());
  });
});
