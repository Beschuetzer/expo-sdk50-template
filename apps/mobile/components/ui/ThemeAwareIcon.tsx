import { FontAwesome } from '@react-native-vector-icons/fontawesome';
import type { ComponentProps } from 'react';

import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { COLORS } from '@/constants/colors';

type FontAwesomeProps = ComponentProps<typeof FontAwesome>;

export type ThemeAwareIconProps = Omit<FontAwesomeProps, 'color'> & {
  color?: FontAwesomeProps['color'];
  darkColor?: FontAwesomeProps['color'];
  lightColor?: FontAwesomeProps['color'];
};

export function ThemeAwareIcon({
  color,
  darkColor = COLORS.dark.tint,
  lightColor = COLORS.light.tint,
  ...iconProps
}: ThemeAwareIconProps) {
  const { colorScheme } = useThemeAwareColors();
  const resolvedColor =
    color ?? (colorScheme === 'dark' ? darkColor : lightColor);

  return <FontAwesome {...iconProps} color={resolvedColor} />;
}
