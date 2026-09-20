import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';

type ThemeAwareViewProps = ComponentProps<typeof View> & {
  darkColor?: string;
  lightColor?: string;
};

export function ThemeAwareView({
  darkColor,
  lightColor,
  style,
  ...props
}: ThemeAwareViewProps) {
  const { backgroundColor: defaultBackgroundColor, colorScheme } =
    useThemeAwareColors();
  const backgroundColor =
    colorScheme === 'dark'
      ? darkColor ?? defaultBackgroundColor
      : lightColor ?? defaultBackgroundColor;

  return <View {...props} style={[{ backgroundColor }, style]} />;
}
