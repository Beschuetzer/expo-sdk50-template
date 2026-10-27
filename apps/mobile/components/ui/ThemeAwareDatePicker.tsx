import {
  CalendarDaysIcon,
  CloseIcon,
  Input,
  InputField,
  InputSlot,
} from '@gluestack-ui/themed';
import DateTimePicker, {
  DateTimePickerAndroid,
  type AndroidNativeProps,
  type DateTimePickerEvent,
  type IOSNativeProps,
} from '@react-native-community/datetimepicker';
import { createElement, useRef, useState } from 'react';
import type { ChangeEvent, ComponentProps } from 'react';
import { Platform } from 'react-native';

import { ThemedModal } from '@/components/ui/ThemedModal';
import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { useThemeAwareTypography } from '@/components/ui/useThemeAwareTypography';
import { COLORS } from '@/constants/colors';
import { useI18n, type Locale } from '@/utils/i18n';

type NativeDateTimePickerProps = Omit<
  ComponentProps<typeof DateTimePicker>,
  | 'accentColor'
  | 'display'
  | 'locale'
  | 'minuteInterval'
  | 'mode'
  | 'negativeButton'
  | 'neutralButton'
  | 'onChange'
  | 'onError'
  | 'positiveButton'
  | 'textColor'
  | 'themeVariant'
  | 'value'
>;

type DatePickerDisplay =
  | NonNullable<IOSNativeProps['display']>
  | Extract<NonNullable<AndroidNativeProps['display']>, 'calendar'>;

export type ThemeAwareDatePickerProps = NativeDateTimePickerProps & {
  accessibilityLabel?: string;
  accentColor?: IOSNativeProps['accentColor'];
  clearable?: boolean;
  display?: DatePickerDisplay;
  formatDate?: (date: Date, locale: Locale) => string;
  isDisabled?: boolean;
  locale?: IOSNativeProps['locale'];
  minuteInterval?: IOSNativeProps['minuteInterval'];
  negativeButton?: AndroidNativeProps['negativeButton'];
  neutralButton?: AndroidNativeProps['neutralButton'];
  onCancel?: () => void;
  onChange?: (event: DateTimePickerEvent, date?: Date) => void;
  onClear?: () => void;
  onClose?: () => void;
  onError?: AndroidNativeProps['onError'];
  onOpen?: () => void;
  placeholder?: string;
  positiveButton?: AndroidNativeProps['positiveButton'];
  textColor?: IOSNativeProps['textColor'];
  themeVariant?: IOSNativeProps['themeVariant'];
  value?: Date | null;
};

function isValidDate(date: Date | null | undefined): date is Date {
  return date instanceof Date && Number.isFinite(date.getTime());
}

function formatInputDate(date: Date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ThemeAwareDatePicker({
  accessibilityLabel,
  accentColor,
  clearable = false,
  display,
  formatDate,
  isDisabled = false,
  locale: pickerLocale,
  minuteInterval,
  negativeButton,
  neutralButton,
  onCancel,
  onChange,
  onClear,
  onClose,
  onError,
  onOpen,
  placeholder,
  positiveButton,
  textColor: pickerTextColor,
  themeVariant,
  value,
  ...nativePickerProps
}: ThemeAwareDatePickerProps) {
  const { locale, t } = useI18n();
  const { colorScheme, textColor } = useThemeAwareColors();
  const { fontFamily } = useThemeAwareTypography();
  const [isVisible, setIsVisible] = useState(false);
  const webDateInputRef = useRef<HTMLInputElement>(null);
  const selectedDate = isValidDate(value) ? value : undefined;
  const pickerValue = selectedDate ?? new Date();
  const fieldValue = selectedDate
    ? formatDate?.(selectedDate, locale) ??
      selectedDate.toLocaleDateString(locale)
    : '';
  const themeColors = COLORS[colorScheme];
  const resolvedTextColor = pickerTextColor ?? themeColors.text;
  const resolvedAccentColor = accentColor ?? themeColors.tint;
  const iosDisplay: IOSNativeProps['display'] =
    display === 'calendar' ? 'inline' : display ?? 'inline';
  const androidDisplay: AndroidNativeProps['display'] =
    display === 'compact' || display === 'inline'
      ? 'default'
      : display ?? 'default';

  function closePicker(wasCancelled: boolean) {
    setIsVisible(false);
    if (wasCancelled) {
      onCancel?.();
    }
    onClose?.();
  }

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    onChange?.(event, date);

    if (Platform.OS === 'ios') return;

    if (event.type === 'set') {
      closePicker(false);
    } else if (event.type === 'dismissed') {
      closePicker(true);
    } else if (event.type === 'neutralButtonPressed') {
      closePicker(false);
    }
  }

  function openPicker() {
    if (isDisabled) return;

    onOpen?.();
    if (Platform.OS === 'web') {
      webDateInputRef.current?.click();
      return;
    }
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        ...nativePickerProps,
        value: pickerValue,
        onChange: handleChange,
        mode: 'date',
        display: androidDisplay,
        minuteInterval,
        positiveButton: {
          label: t('datePicker.confirm'),
          textColor: resolvedAccentColor,
          ...positiveButton,
        },
        negativeButton: {
          label: t('datePicker.cancel'),
          textColor: resolvedTextColor,
          ...negativeButton,
        },
        neutralButton,
        onError,
      });
      return;
    }
    setIsVisible(true);
  }

  function handleWebDateChange(event: ChangeEvent<HTMLInputElement>) {
    const dateValue = event.currentTarget.value;
    if (!dateValue) return;

    const [year, month, day] = dateValue.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    if (
      !Number.isFinite(date.getTime()) ||
      formatInputDate(date) !== dateValue
    ) {
      return;
    }

    onChange?.(
      {
        type: 'set',
        nativeEvent: {
          timestamp: date.getTime(),
          utcOffset: -date.getTimezoneOffset(),
        },
      },
      date,
    );
    onClose?.();
  }

  function clearSelection() {
    if (isDisabled) return;

    onClear?.();
  }

  return (
    <>
      <Input variant="outline" size="md" isDisabled={isDisabled}>
        <InputField
          accessibilityLabel={accessibilityLabel}
          editable={false}
          fontFamily={fontFamily}
          onPressIn={openPicker}
          placeholder={placeholder ?? t('datePicker.placeholder')}
          value={fieldValue}
          color={textColor}
        />
        {clearable && selectedDate && onClear ? (
          <InputSlot
            accessibilityLabel={t('datePicker.clear')}
            accessibilityRole="button"
            disabled={isDisabled}
            onPress={clearSelection}
            px="$2"
          >
            <CloseIcon color={textColor} />
          </InputSlot>
        ) : null}
        <InputSlot
          accessibilityLabel={accessibilityLabel ?? t('datePicker.open')}
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={openPicker}
          px="$3"
        >
          <CalendarDaysIcon color={textColor} />
        </InputSlot>
      </Input>

      {Platform.OS === 'web'
        ? createElement('input', {
            'aria-hidden': true,
            max: nativePickerProps.maximumDate
              ? formatInputDate(nativePickerProps.maximumDate)
              : undefined,
            min: nativePickerProps.minimumDate
              ? formatInputDate(nativePickerProps.minimumDate)
              : undefined,
            onChange: handleWebDateChange,
            ref: webDateInputRef,
            style: {
              height: 1,
              opacity: 0,
              position: 'absolute',
              width: 1,
            },
            tabIndex: -1,
            type: 'date',
            value: selectedDate ? formatInputDate(selectedDate) : '',
          })
        : null}

      {Platform.OS === 'ios' ? (
        <ThemedModal
          isVisible={isVisible}
          onClose={() => closePicker(true)}
          title={t('datePicker.title')}
          scrollable={false}
          cancelButton={{
            isVisible: false,
            text: t('datePicker.cancel'),
          }}
          confirmButton={{
            onPress: () => closePicker(false),
            text: t('datePicker.confirm'),
          }}
        >
          {isVisible ? (
            <DateTimePicker
              {...nativePickerProps}
              value={pickerValue}
              onChange={handleChange}
              mode="date"
              display={iosDisplay}
              minuteInterval={minuteInterval}
              locale={pickerLocale ?? locale}
              themeVariant={themeVariant ?? colorScheme}
              textColor={resolvedTextColor}
              accentColor={resolvedAccentColor}
              disabled={isDisabled}
            />
          ) : null}
        </ThemedModal>
      ) : null}
    </>
  );
}
