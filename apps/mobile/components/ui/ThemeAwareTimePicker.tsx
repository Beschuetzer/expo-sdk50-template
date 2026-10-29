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

export type ThemeAwareTimePickerMode = 'date' | 'datetime';

type TimePickerDisplay =
  | NonNullable<IOSNativeProps['display']>
  | Extract<NonNullable<AndroidNativeProps['display']>, 'calendar'>;

export type ThemeAwareTimePickerProps = NativeDateTimePickerProps & {
  accessibilityLabel?: string;
  accentColor?: IOSNativeProps['accentColor'];
  clearable?: boolean;
  display?: TimePickerDisplay;
  formatDate?: (date: Date, locale: Locale) => string;
  isDisabled?: boolean;
  locale?: IOSNativeProps['locale'];
  minuteInterval?: IOSNativeProps['minuteInterval'];
  mode?: ThemeAwareTimePickerMode;
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

function formatInputDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatInputDate(date)}T${hours}:${minutes}`;
}

function formatInputValue(date: Date, mode: ThemeAwareTimePickerMode) {
  return mode === 'datetime'
    ? formatInputDateTime(date)
    : formatInputDate(date);
}

function parseInputValue(
  value: string,
  mode: ThemeAwareTimePickerMode,
): Date | undefined {
  const [dateValue, timeValue] = value.split('T');
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue?.split(':').map(Number) ?? [];
  const date =
    mode === 'datetime'
      ? timeValue
        ? new Date(year, month - 1, day, hours, minutes)
        : undefined
      : new Date(year, month - 1, day);

  if (!isValidDate(date) || formatInputValue(date, mode) !== value) {
    return undefined;
  }

  return date;
}

export function ThemeAwareTimePicker({
  accessibilityLabel,
  accentColor,
  clearable = false,
  display,
  formatDate,
  isDisabled = false,
  locale: pickerLocale,
  mode = 'date',
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
}: ThemeAwareTimePickerProps) {
  const { locale, t } = useI18n();
  const { colorScheme, textColor } = useThemeAwareColors();
  const { fontFamily } = useThemeAwareTypography();
  const [isVisible, setIsVisible] = useState(false);
  const webDateInputRef = useRef<HTMLInputElement>(null);
  const selectedDate = isValidDate(value) ? value : undefined;
  const pickerValue = selectedDate ?? new Date();
  const fieldValue = selectedDate
    ? formatDate?.(selectedDate, locale) ??
      (mode === 'datetime'
        ? selectedDate.toLocaleString(locale)
        : selectedDate.toLocaleDateString(locale))
    : '';
  const pickerLabels =
    mode === 'datetime'
      ? {
          cancel: t('dateTimePicker.cancel'),
          clear: t('dateTimePicker.clear'),
          confirm: t('dateTimePicker.confirm'),
          open: t('dateTimePicker.open'),
          placeholder: t('dateTimePicker.placeholder'),
          title: t('dateTimePicker.title'),
        }
      : {
          cancel: t('datePicker.cancel'),
          clear: t('datePicker.clear'),
          confirm: t('datePicker.confirm'),
          open: t('datePicker.open'),
          placeholder: t('datePicker.placeholder'),
          title: t('datePicker.title'),
        };
  const themeColors = COLORS[colorScheme];
  const resolvedTextColor = pickerTextColor ?? themeColors.text;
  const resolvedAccentColor = accentColor ?? themeColors.tint;
  const iosDisplay: IOSNativeProps['display'] =
    display === 'calendar' ? 'inline' : display ?? 'inline';
  const androidDisplay: AndroidNativeProps['display'] =
    display === 'compact' || display === 'inline'
      ? 'default'
      : display ?? 'default';
  const androidTimeDisplay: AndroidNativeProps['display'] =
    display === 'spinner' ? 'spinner' : 'default';

  function closePicker(wasCancelled: boolean) {
    setIsVisible(false);
    if (wasCancelled) {
      onCancel?.();
    }
    onClose?.();
  }

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    onChange?.(event, date);
  }

  function handleAndroidChange(
    event: DateTimePickerEvent,
    date: Date | undefined,
    pickerMode: 'date' | 'time',
  ) {
    if (
      mode === 'datetime' &&
      pickerMode === 'date' &&
      event.type === 'set' &&
      date
    ) {
      openAndroidPicker('time', date);
      return;
    }

    onChange?.(event, date);

    if (event.type === 'set' || event.type === 'neutralButtonPressed') {
      closePicker(false);
    } else if (event.type === 'dismissed') {
      closePicker(true);
    }
  }

  function openAndroidPicker(pickerMode: 'date' | 'time', value: Date) {
    DateTimePickerAndroid.open({
      ...nativePickerProps,
      value,
      onChange: (event, date) => handleAndroidChange(event, date, pickerMode),
      mode: pickerMode,
      display: pickerMode === 'time' ? androidTimeDisplay : androidDisplay,
      minuteInterval,
      positiveButton: {
        label: pickerLabels.confirm,
        textColor: resolvedAccentColor,
        ...positiveButton,
      },
      negativeButton: {
        label: pickerLabels.cancel,
        textColor: resolvedTextColor,
        ...negativeButton,
      },
      neutralButton,
      onError,
    });
  }

  function openPicker() {
    if (isDisabled) return;

    onOpen?.();
    if (Platform.OS === 'web') {
      webDateInputRef.current?.click();
      return;
    }
    if (Platform.OS === 'android') {
      openAndroidPicker('date', pickerValue);
      return;
    }
    setIsVisible(true);
  }

  function handleWebInputChange(event: ChangeEvent<HTMLInputElement>) {
    const date = parseInputValue(event.currentTarget.value, mode);
    if (!date) return;

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
          placeholder={placeholder ?? pickerLabels.placeholder}
          value={fieldValue}
          color={textColor}
        />
        {clearable && selectedDate && onClear ? (
          <InputSlot
            accessibilityLabel={pickerLabels.clear}
            accessibilityRole="button"
            disabled={isDisabled}
            onPress={clearSelection}
            px="$2"
          >
            <CloseIcon color={textColor} />
          </InputSlot>
        ) : null}
        <InputSlot
          accessibilityLabel={accessibilityLabel ?? pickerLabels.open}
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
              ? formatInputValue(nativePickerProps.maximumDate, mode)
              : undefined,
            min: nativePickerProps.minimumDate
              ? formatInputValue(nativePickerProps.minimumDate, mode)
              : undefined,
            onChange: handleWebInputChange,
            ref: webDateInputRef,
            style: {
              height: 1,
              opacity: 0,
              position: 'absolute',
              width: 1,
            },
            tabIndex: -1,
            step: mode === 'datetime' ? 60 : undefined,
            type: mode === 'datetime' ? 'datetime-local' : 'date',
            value: selectedDate ? formatInputValue(selectedDate, mode) : '',
          })
        : null}

      {Platform.OS === 'ios' ? (
        <ThemedModal
          isVisible={isVisible}
          onClose={() => closePicker(true)}
          title={pickerLabels.title}
          scrollable={false}
          cancelButton={{
            isVisible: false,
            text: pickerLabels.cancel,
          }}
          confirmButton={{
            onPress: () => closePicker(false),
            text: pickerLabels.confirm,
          }}
        >
          {isVisible ? (
            <DateTimePicker
              {...nativePickerProps}
              value={pickerValue}
              onChange={handleChange}
              mode={mode}
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
