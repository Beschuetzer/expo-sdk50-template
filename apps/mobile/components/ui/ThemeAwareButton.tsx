import { Button, ButtonSpinner, ButtonText } from '@gluestack-ui/themed';
import type { ComponentProps, ReactNode } from 'react';
import { useRef, useState, useEffect } from 'react';
import type { GestureResponderEvent } from 'react-native';

import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { useThemeAwareTypography } from '@/components/ui/useThemeAwareTypography';

type ThemeAwareButtonProps = Omit<ComponentProps<typeof Button>, 'onPress'> & {
  children: ReactNode;
  darkBackground?: string;
  lightBackground?: string;
  onPress?: ((event: GestureResponderEvent) => void | Promise<unknown>) | null;
};

export function ThemeAwareButton({
  children,
  darkBackground = '$primary600',
  lightBackground = '$primary500',
  variant = 'solid',
  bg,
  onPress,
  disabled,
  isDisabled,
  ...props
}: ThemeAwareButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isPressInProgress = useRef(false);
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
      variant={variant}
      bg={resolvedBackground}
      disabled={isButtonDisabled}
      isDisabled={isButtonDisabled}
      onPress={handlePress}
    >
      {isLoading ? <ButtonSpinner /> : buttonChildren}
    </Button>
  );
}
