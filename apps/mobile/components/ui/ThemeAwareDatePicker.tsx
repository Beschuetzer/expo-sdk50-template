import { ThemeAwareTimePicker } from './ThemeAwareTimePicker';
import type { ThemeAwareTimePickerProps } from './ThemeAwareTimePicker';

export type ThemeAwareDatePickerProps = Omit<ThemeAwareTimePickerProps, 'mode'>;

export function ThemeAwareDatePicker(props: ThemeAwareDatePickerProps) {
  return <ThemeAwareTimePicker {...props} mode="date" />;
}
