import { useThemeAwareColors } from './useThemeAwareColors';

import { useFont } from '@/utils/font';

export function useThemeAwareTypography() {
  const { getTextColor, textColor } = useThemeAwareColors();
  const { font, fonts } = useFont();

  return {
    color: textColor,
    fontFamily: fonts[font],
    getTextColor,
  } as const;
}
