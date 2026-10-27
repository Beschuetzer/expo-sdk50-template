import React, { type ReactNode } from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemeAwareDatePicker } from './ThemeAwareDatePicker';

let mockColorScheme = 'light';
let mockPlatformOS = 'ios';
let mockTextColor = '$textLight900';
const mockAndroidOpen = jest.fn();

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    __esModule: true,
    DateTimePickerAndroid: {
      open: (props: unknown) => mockAndroidOpen(props),
    },
    default: (props: Record<string, unknown>) =>
      React.createElement('NativeDateTimePicker', props),
  };
}, { virtual: true });

jest.mock('@gluestack-ui/themed', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createComponent =
    (name: string) =>
    ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) =>
      React.createElement(name, props, children);

  return {
    CalendarDaysIcon: (props: Record<string, unknown>) =>
      React.createElement('CalendarDaysIcon', props),
    CloseIcon: (props: Record<string, unknown>) =>
      React.createElement('CloseIcon', props),
    Input: createComponent('Input'),
    InputField: createComponent('InputField'),
    InputSlot: createComponent('InputSlot'),
  };
});

jest.mock('@/components/ui/ThemedModal', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    ThemedModal: ({
      children,
      confirmButton,
      isVisible,
      onClose,
      title,
    }: {
      children: ReactNode;
      confirmButton?: { onPress?: () => void };
      isVisible: boolean;
      onClose?: () => void;
      title?: ReactNode;
    }) =>
      isVisible
        ? React.createElement(
            'ThemedModal',
            {
              onClose,
              onConfirm: confirmButton?.onPress,
              title,
            },
            children,
          )
        : null,
  };
});

jest.mock('@/components/ui/useThemeAwareColors', () => ({
  useThemeAwareColors: () => ({
    colorScheme: mockColorScheme,
    textColor: mockTextColor,
  }),
}));

jest.mock('@/components/ui/useThemeAwareTypography', () => ({
  useThemeAwareTypography: () => ({ fontFamily: 'test-font' }),
}));

jest.mock('@/utils/i18n', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

describe('ThemeAwareDatePicker', () => {
  afterEach(() => {
    mockColorScheme = 'light';
    mockPlatformOS = 'ios';
    mockTextColor = '$textLight900';
    jest.clearAllMocks();
  });

  it('passes native picker props and theme colors on iOS', () => {
    mockColorScheme = 'dark';
    const onChange = jest.fn();
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const minimumDate = new Date(2024, 0, 1);
    const maximumDate = new Date(2024, 11, 31);
    const tree = renderer.create(
      <ThemeAwareDatePicker
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        onChange={onChange}
        onClose={onClose}
        onOpen={onOpen}
        testID="purchase-date-picker"
        value={new Date(2024, 0, 15)}
      />,
    );
    const calendarIcon = tree.root.find(
      (instance) =>
        String(instance.type) === 'InputSlot' &&
        instance.props.accessibilityLabel === 'datePicker.open',
    );

    act(() => calendarIcon.props.onPress());

    expect(onOpen).toHaveBeenCalledTimes(1);
    const picker = tree.root.find(
      (instance) => String(instance.type) === 'NativeDateTimePicker',
    );
    expect(picker.props).toEqual(
      expect.objectContaining({
        accentColor: '#fff',
        display: 'inline',
        locale: 'en',
        maximumDate,
        minimumDate,
        mode: 'date',
        testID: 'purchase-date-picker',
        textColor: '#fff',
        themeVariant: 'dark',
      }),
    );

    const event = {
      type: 'set',
      nativeEvent: { timestamp: 1705708800000, utcOffset: 0 },
    };
    const pickedDate = new Date(2024, 0, 20);
    act(() => picker.props.onChange(event, pickedDate));

    expect(onChange).toHaveBeenCalledWith(event, pickedDate);
    expect(
      tree.root.findAll(
        (instance) => String(instance.type) === 'NativeDateTimePicker',
      ),
    ).toHaveLength(1);

    const modal = tree.root.find(
      (instance) => String(instance.type) === 'ThemedModal',
    );
    act(() => modal.props.onConfirm());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the native Android picker after selection', () => {
    mockPlatformOS = 'android';
    const onClose = jest.fn();
    function ControlledPicker() {
      const [value, setValue] = React.useState(new Date(2024, 0, 15));

      return (
        <ThemeAwareDatePicker
          onChange={(event, date) => {
            if (event.type === 'set' && date) {
              setValue(date);
            }
          }}
          onClose={onClose}
          value={value}
        />
      );
    }
    const tree = renderer.create(<ControlledPicker />);
    const calendarIcon = tree.root.find(
      (instance) => String(instance.type) === 'InputSlot',
    );

    act(() => calendarIcon.props.onPress());

    expect(mockAndroidOpen).toHaveBeenCalledTimes(1);
    const pickerProps = mockAndroidOpen.mock.calls[0][0];
    expect(pickerProps.positiveButton).toEqual({
      label: 'datePicker.confirm',
      textColor: '#2f95dc',
    });
    expect(pickerProps.negativeButton).toEqual({
      label: 'datePicker.cancel',
      textColor: '#000',
    });

    const event = {
      type: 'set',
      nativeEvent: { timestamp: 1705708800000, utcOffset: 0 },
    };
    const pickedDate = new Date(2024, 0, 20);
    act(() => pickerProps.onChange(event, pickedDate));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockAndroidOpen).toHaveBeenCalledTimes(1);
    expect(
      tree.root.findAll(
        (instance) => String(instance.type) === 'NativeDateTimePicker',
      ),
    ).toHaveLength(0);
  });

  it('reports dismissed native picker events as cancellations', () => {
    mockPlatformOS = 'android';
    const onCancel = jest.fn();
    const onClose = jest.fn();
    const tree = renderer.create(
      <ThemeAwareDatePicker onCancel={onCancel} onClose={onClose} />,
    );
    const calendarIcon = tree.root.find(
      (instance) => String(instance.type) === 'InputSlot',
    );

    act(() => calendarIcon.props.onPress());

    const pickerProps = mockAndroidOpen.mock.calls[0][0];
    act(() =>
      pickerProps.onChange({
        type: 'dismissed',
        nativeEvent: { timestamp: Date.now(), utcOffset: 0 },
      }),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes after a native neutral button event', () => {
    mockPlatformOS = 'android';
    const onChange = jest.fn();
    const onClose = jest.fn();
    const tree = renderer.create(
      <ThemeAwareDatePicker
        neutralButton={{ label: 'Clear' }}
        onChange={onChange}
        onClose={onClose}
      />,
    );
    const calendarIcon = tree.root.find(
      (instance) => String(instance.type) === 'InputSlot',
    );

    act(() => calendarIcon.props.onPress());

    const pickerProps = mockAndroidOpen.mock.calls[0][0];
    const event = {
      type: 'neutralButtonPressed',
      nativeEvent: { timestamp: Date.now(), utcOffset: 0 },
    };
    act(() => pickerProps.onChange(event));

    expect(onChange).toHaveBeenCalledWith(event, undefined);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clears the selected date from the calendar field', () => {
    const onClear = jest.fn();
    const tree = renderer.create(
      <ThemeAwareDatePicker
        clearable
        onClear={onClear}
        value={new Date(2024, 0, 15)}
      />,
    );
    const clearButton = tree.root.find(
      (instance) =>
        String(instance.type) === 'InputSlot' &&
        instance.props.accessibilityLabel === 'datePicker.clear',
    );

    act(() => clearButton.props.onPress());

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('uses a browser date input on web', () => {
    mockPlatformOS = 'web';
    const onChange = jest.fn();
    const onClose = jest.fn();
    const minimumDate = new Date(2024, 0, 1);
    const maximumDate = new Date(2024, 11, 31);
    const tree = renderer.create(
      <ThemeAwareDatePicker
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        onChange={onChange}
        onClose={onClose}
        value={new Date(2024, 0, 15)}
      />,
    );
    const dateInput = tree.root.find(
      (instance) => String(instance.type) === 'input',
    );

    expect(dateInput.props).toEqual(
      expect.objectContaining({
        max: '2024-12-31',
        min: '2024-01-01',
        type: 'date',
        value: '2024-01-15',
      }),
    );
    expect(
      tree.root.findAll(
        (instance) => String(instance.type) === 'NativeDateTimePicker',
      ),
    ).toHaveLength(0);

    const pickedDate = new Date(2024, 0, 20);
    act(() =>
      dateInput.props.onChange({
        currentTarget: { value: '2024-01-20' },
      }),
    );

    expect(onChange).toHaveBeenCalledWith(
      {
        type: 'set',
        nativeEvent: {
          timestamp: pickedDate.getTime(),
          utcOffset: -pickedDate.getTimezoneOffset(),
        },
      },
      pickedDate,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the browser date picker from the calendar button', () => {
    mockPlatformOS = 'web';
    const onOpen = jest.fn();
    const tree = renderer.create(<ThemeAwareDatePicker onOpen={onOpen} />);
    const calendarIcon = tree.root.find(
      (instance) =>
        String(instance.type) === 'InputSlot' &&
        instance.props.accessibilityLabel === 'datePicker.open',
    );

    act(() => calendarIcon.props.onPress());

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(mockAndroidOpen).not.toHaveBeenCalled();
  });

  it.each([
    { label: 'empty', value: '' },
    { label: 'invalid', value: '2024-02-31' },
  ])('ignores $label browser date values', ({ value }) => {
    mockPlatformOS = 'web';
    const onChange = jest.fn();
    const onClose = jest.fn();
    const tree = renderer.create(
      <ThemeAwareDatePicker onChange={onChange} onClose={onClose} />,
    );
    const dateInput = tree.root.find(
      (instance) => String(instance.type) === 'input',
    );

    act(() =>
      dateInput.props.onChange({
        currentTarget: { value },
      }),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not open or clear a disabled picker', () => {
    mockPlatformOS = 'android';
    const onOpen = jest.fn();
    const onClear = jest.fn();
    const tree = renderer.create(
      <ThemeAwareDatePicker
        clearable
        isDisabled
        onClear={onClear}
        onOpen={onOpen}
        value={new Date(2024, 0, 15)}
      />,
    );
    const clearButton = tree.root.find(
      (instance) =>
        String(instance.type) === 'InputSlot' &&
        instance.props.accessibilityLabel === 'datePicker.clear',
    );
    const openButton = tree.root.find(
      (instance) =>
        String(instance.type) === 'InputSlot' &&
        instance.props.accessibilityLabel === 'datePicker.open',
    );

    act(() => {
      clearButton.props.onPress();
      openButton.props.onPress();
    });

    expect(onClear).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(mockAndroidOpen).not.toHaveBeenCalled();
  });

  it('reports cancellation when the iOS picker modal is dismissed', () => {
    const onCancel = jest.fn();
    const onClose = jest.fn();
    const tree = renderer.create(
      <ThemeAwareDatePicker onCancel={onCancel} onClose={onClose} />,
    );
    const calendarIcon = tree.root.find(
      (instance) => String(instance.type) === 'InputSlot',
    );

    act(() => calendarIcon.props.onPress());

    const modal = tree.root.find(
      (instance) => String(instance.type) === 'ThemedModal',
    );
    act(() => modal.props.onClose());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
