import { Badge, BadgeText } from '@gluestack-ui/themed';
import type { ReactNode } from 'react';

import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { useThemeAwareTypography } from '@/components/ui/useThemeAwareTypography';

type ThemeAwareBadgeProps = {
  children: ReactNode;
  darkBackground?: string;
  darkTextColor?: string;
  lightBackground?: string;
  lightTextColor?: string;
};

export function ThemeAwareBadge({
  children,
  darkBackground = '$backgroundDark800',
  darkTextColor = '$textDark50',
  lightBackground = '$coolGray100',
  lightTextColor = '$textLight900',
}: ThemeAwareBadgeProps) {
  const { colorScheme } = useThemeAwareColors();
  const { fontFamily } = useThemeAwareTypography();
  const isDark = colorScheme === 'dark';

  return (
    <Badge
      bg={isDark ? darkBackground : lightBackground}
      borderRadius="$sm"
      px="$2"
      py="$1"
    >
      <BadgeText
        color={isDark ? darkTextColor : lightTextColor}
        fontFamily={fontFamily}
        fontWeight="$semibold"
        size="xs"
      >
        {children}
      </BadgeText>
    </Badge>
  );
}
