import { Button, ButtonText } from '@gluestack-ui/themed';
import type { ComponentProps, ReactNode } from 'react';

import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { useThemeAwareTypography } from '@/components/ui/useThemeAwareTypography';

type ThemeAwareButtonProps = ComponentProps<typeof Button> & {
  children: ReactNode;
  darkBackground?: string;
  lightBackground?: string;
};

export function ThemeAwareButton({
  children,
  darkBackground = '$primary600',
  lightBackground = '$primary500',
  variant = 'solid',
  bg,
  ...props
}: ThemeAwareButtonProps) {
  const { colorScheme, getTextColor } = useThemeAwareColors();
  const { fontFamily } = useThemeAwareTypography();
  const shouldApplyDefaultBackground =
    variant !== 'outline' && variant !== 'link';
  const background = colorScheme === 'dark' ? darkBackground : lightBackground;
  const resolvedBackground =
    bg ?? (shouldApplyDefaultBackground ? background : '$transparent');
  const textColor = getTextColor(shouldApplyDefaultBackground);
  const buttonChildren =
    typeof children === 'string' || typeof children === 'number' ? (
      <ButtonText color={textColor} fontFamily={fontFamily}>
        {children}
      </ButtonText>
    ) : (
      children
    );

  return (
    <Button {...props} variant={variant} bg={resolvedBackground}>
      {buttonChildren}
    </Button>
  );
}
