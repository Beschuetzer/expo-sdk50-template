import { createContext, useCallback, useContext, useRef } from 'react';
import type { ReactNode } from 'react';

const ThemeAwareButtonPaletteContext = createContext<
  ((buttonId: string) => number) | null
>(null);

export function ThemeAwareButtonPaletteProvider({
  children,
}: {
  children: ReactNode;
}) {
  const indexes = useRef(new Map<string, number>());
  const getIndex = useCallback((buttonId: string) => {
    const existingIndex = indexes.current.get(buttonId);
    if (existingIndex !== undefined) return existingIndex;

    const nextIndex = indexes.current.size;
    indexes.current.set(buttonId, nextIndex);
    return nextIndex;
  }, []);

  return (
    <ThemeAwareButtonPaletteContext.Provider value={getIndex}>
      {children}
    </ThemeAwareButtonPaletteContext.Provider>
  );
}

export function useThemeAwareButtonPaletteIndex(buttonId: string) {
  const getIndex = useContext(ThemeAwareButtonPaletteContext);
  return getIndex?.(buttonId) ?? 0;
}
