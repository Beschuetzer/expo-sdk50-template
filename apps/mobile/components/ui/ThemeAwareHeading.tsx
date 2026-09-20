import { Text } from '@gluestack-ui/themed';
import type { ComponentProps } from 'react';

import { useThemeAwareTypography } from '@/components/ui/useThemeAwareTypography';

type ThemeAwareHeadingProps = ComponentProps<typeof Text>;

export function ThemeAwareHeading(props: ThemeAwareHeadingProps) {
  const { color, fontFamily } = useThemeAwareTypography();

  return (
    <Text
      {...props}
      color={color}
      fontFamily={fontFamily}
      fontSize="$xl"
      letterSpacing="$sm"
      style={[props.style, { fontFamily }]}
    />
  );
}
