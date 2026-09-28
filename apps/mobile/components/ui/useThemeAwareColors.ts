import { useColorScheme } from '@/components/hooks/useColorScheme';
import { COLORS } from '@/constants/colors';

export function useThemeAwareColors() {
  const colorScheme = useColorScheme() ?? 'light';
  const palette = COLORS[colorScheme];

  const getTextColor = (onSolidBackground = false) => {
    if (onSolidBackground) {
      return colorScheme === 'dark' ? '$textDark0' : '$textLight0';
    }

    return colorScheme === 'dark' ? '$textDark50' : '$textLight900';
  };

  return {
    backgroundColor: palette.background,
    colorScheme,
    getTextColor,
    textColor: getTextColor(),
  } as const;
}
