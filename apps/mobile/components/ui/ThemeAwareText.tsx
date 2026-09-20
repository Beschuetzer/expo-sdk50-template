import { Text } from '@gluestack-ui/themed';
import type { ComponentProps } from 'react';

import { useThemeAwareTypography } from '@/components/ui/useThemeAwareTypography';

type ThemeAwareTextProps = ComponentProps<typeof Text>;

export function ThemeAwareText(props: ThemeAwareTextProps) {
  const typographyProps = useThemeAwareTypography();

  return <Text {...typographyProps} {...props} />;
}

export { ThemeAwareHeading } from './ThemeAwareHeading';
