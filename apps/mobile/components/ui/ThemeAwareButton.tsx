import { Button, ButtonSpinner, ButtonText } from '@gluestack-ui/themed';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';

import { useThemeAwareButtonPaletteIndex } from '@/components/ui/ThemeAwareButtonPalette';
import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { useThemeAwareTypography } from '@/components/ui/useThemeAwareTypography';
import { COLORS } from '@/constants/colors';

const BUTTON_MIN_HEIGHTS = {
  xs: '$8',
  sm: '$9',
  md: '$10',
  lg: '$11',
  xl: '$12',
} as const;

type ThemeAwareButtonProps = Omit<ComponentProps<typeof Button>, 'onPress'> & {
  children: ReactNode;
  darkBackground?: string;
  lightBackground?: string;
  onPress?: ((event: GestureResponderEvent) => void | Promise<unknown>) | null;
};

export function ThemeAwareButton({
  children,
  darkBackground,
  lightBackground,
  variant = 'solid',
  bg,
  onPress,
  disabled,
  isDisabled,
  size = 'md',
  h,
  height,
  minHeight,
  py,
  ...props
}: ThemeAwareButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isPressInProgress = useRef(false);
  const buttonId = useId();
  const paletteIndex = useThemeAwareButtonPaletteIndex(buttonId);
  const { colorScheme, getTextColor } = useThemeAwareColors();
  const { fontFamily } = useThemeAwareTypography();
  const resolvedVariant = variant === 'outline' ? 'solid' : variant;
  const shouldApplyDefaultBackground = resolvedVariant !== 'link';
  const buttonBackgrounds = COLORS[colorScheme].buttonBackgrounds;
  const background = colorScheme === 'dark' ? darkBackground : lightBackground;
  const paletteBackground =
    buttonBackgrounds[paletteIndex % buttonBackgrounds.length];
  const resolvedBackground =
    bg ??
    (shouldApplyDefaultBackground
      ? background ?? paletteBackground
      : '$transparent');
  const resolvedHeight = height ?? h ?? 'auto';
  const resolvedMinHeight =
    minHeight ??
    (resolvedHeight === 'auto'
      ? BUTTON_MIN_HEIGHTS[size] ?? BUTTON_MIN_HEIGHTS.md
      : resolvedHeight);
  const textColor = shouldApplyDefaultBackground
    ? getTextColor(true)
    : paletteBackground;
  const buttonChildren =
    typeof children === 'string' || typeof children === 'number' ? (
      <ButtonText
        color={textColor}
        flexShrink={1}
        fontFamily={fontFamily}
        textAlign="center"
      >
        {children}
      </ButtonText>
    ) : (
      children
    );
  const isButtonDisabled = Boolean(disabled || isDisabled || isLoading);

  async function handlePress(event: GestureResponderEvent) {
    if (!onPress || isButtonDisabled || isPressInProgress.current) {
      return;
    }

    isPressInProgress.current = true;
    setIsLoading(true);

    try {
      await onPress(event);
    } finally {
      isPressInProgress.current = false;
      setIsLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      isPressInProgress.current = false;
      setIsLoading(false);
    };
  }, []);

  return (
    <Button
      {...props}
      size={size}
      height={resolvedHeight}
      minHeight={resolvedMinHeight}
      py={py ?? '$2'}
      variant={resolvedVariant}
      bg={resolvedBackground}
      disabled={isButtonDisabled}
      isDisabled={isButtonDisabled}
      onPress={handlePress}
    >
      {isLoading ? <ButtonSpinner /> : buttonChildren}
    </Button>
  );
}
