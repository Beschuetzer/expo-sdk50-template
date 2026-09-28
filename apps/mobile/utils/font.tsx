import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const FONT_STORAGE_KEY = '@mobile/font-family';

export const fontFamilies = {
  codex: 'Codex',
  codexItalic: 'CodexItalic',
  fallingSkySemibold: 'FallingSkySemibold',
  fallingSkyMediumOblique: 'FallingSkyMediumOblique',
  fallingSkyLight: 'FallingSkyLight',
  fallingSkyBlack: 'FallingSkyBlack',
  fashionvictim: 'Fashionvictim',
  kindred: 'Kindred',
  kindredItalic: 'KindredItalic',
  nesathoberyl: 'Nesathoberyl',
  timeburnerBold: 'TimeburnerBold',
  spaceMono: 'SpaceMono',
  typeLightSans: 'TypeLightSans',
  zomboid: 'Zomboid',
} as const;

export type FontFamily = keyof typeof fontFamilies;

type FontContextValue = {
  font: FontFamily;
  fonts: typeof fontFamilies;
  setFont: (font: FontFamily) => void;
};

const FontContext = createContext<FontContextValue | undefined>(undefined);

export function FontProvider({ children }: { children: ReactNode }) {
  const [font, setFontState] = useState<FontFamily>('spaceMono');

  useEffect(() => {
    AsyncStorage.getItem(FONT_STORAGE_KEY)
      .then((storedFont) => {
        if (storedFont && storedFont in fontFamilies) {
          setFontState(storedFont as FontFamily);
        }
      })
      .catch(() => undefined);
  }, []);

  const setFont = (nextFont: FontFamily) => {
    setFontState(nextFont);
    AsyncStorage.setItem(FONT_STORAGE_KEY, nextFont).catch(() => undefined);
  };

  const value = useMemo(() => ({ font, fonts: fontFamilies, setFont }), [font]);

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>;
}

export function useFont() {
  const context = useContext(FontContext);
  if (!context) {
    return {
      font: 'spaceMono' as const,
      fonts: fontFamilies,
      setFont: (_font: FontFamily) => undefined,
    };
  }

  return context;
}
