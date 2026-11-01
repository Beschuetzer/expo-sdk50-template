import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { useColorScheme } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  ThemeModeProvider,
  resolveColorScheme,
  themeModes,
  useThemeMode,
} from './theme';

import { renderWithAct } from '@/test-utils/renderWithAct';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

describe('theme', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('supports system, light, and dark modes', () => {
    expect(Object.keys(themeModes)).toEqual(['system', 'light', 'dark']);
  });

  it('follows the system scheme only in system mode', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', 'light')).toBe('light');
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
  });

  it('hydrates the persisted theme mode and exposes the active mode', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('light');

    let current: ReturnType<typeof useThemeMode> | undefined;

    const TestConsumer = () => {
      current = useThemeMode();
      return null;
    };

    await act(async () => {
      renderer.create(
        React.createElement(
          ThemeModeProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.mode).toBe('light');
    expect(current?.colorScheme).toBe('light');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@mobile/theme-mode');
  });

  it('updates the theme mode and persists it', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    let current: ReturnType<typeof useThemeMode> | undefined;

    const TestConsumer = () => {
      current = useThemeMode();
      return null;
    };

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        React.createElement(
          ThemeModeProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      current?.setMode('dark');
      await Promise.resolve();
    });

    expect(current?.mode).toBe('dark');
    expect(current?.colorScheme).toBe('dark');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@mobile/theme-mode',
      'dark',
    );
    act(() => tree.unmount());
  });

  it('provides the system fallback when no provider is present', () => {
    (useColorScheme as jest.Mock).mockReturnValue('light');

    let current: ReturnType<typeof useThemeMode> | undefined;

    const TestConsumer = () => {
      current = useThemeMode();
      return null;
    };

    renderWithAct(React.createElement(TestConsumer));

    expect(current).toEqual({
      colorScheme: 'light',
      mode: 'system',
      modes: themeModes,
      setMode: expect.any(Function),
    });
  });

  it('falls back to light when the system scheme is unavailable', async () => {
    (useColorScheme as jest.Mock).mockReturnValue(null);

    let current: ReturnType<typeof useThemeMode> | undefined;

    const TestConsumer = () => {
      current = useThemeMode();
      return null;
    };

    await act(async () => {
      renderer.create(
        React.createElement(
          ThemeModeProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveColorScheme('system', 'light')).toBe('light');
    expect(current).toEqual({
      colorScheme: 'light',
      mode: 'system',
      modes: themeModes,
      setMode: expect.any(Function),
    });
  });

  it('hydrates valid persisted themes and ignores invalid values', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid');
    let current: ReturnType<typeof useThemeMode> | undefined;

    const TestConsumer = () => {
      current = useThemeMode();
      return null;
    };

    await act(async () => {
      renderer.create(
        React.createElement(
          ThemeModeProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.mode).toBe('system');

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

    await act(async () => {
      renderer.create(
        React.createElement(
          ThemeModeProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.mode).toBe('dark');
  });

  it('accepts system and dark persisted values and keeps the fallback setter safe without a provider', async () => {
    const persistedModes: ('system' | 'dark')[] = ['system', 'dark'];

    for (const persistedMode of persistedModes) {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(persistedMode);

      let current: ReturnType<typeof useThemeMode> | undefined;
      const TestConsumer = () => {
        current = useThemeMode();
        return null;
      };

      await act(async () => {
        renderer.create(
          React.createElement(
            ThemeModeProvider,
            null,
            React.createElement(TestConsumer, null),
          ),
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(current?.mode).toBe(persistedMode);
      expect(current?.colorScheme).toBe('dark');
    }

    (useColorScheme as jest.Mock).mockReturnValue('light');

    let fallback: ReturnType<typeof useThemeMode> | undefined;
    const FallbackConsumer = () => {
      fallback = useThemeMode();
      return null;
    };

    renderWithAct(React.createElement(FallbackConsumer));

    expect(fallback).toEqual({
      colorScheme: 'light',
      mode: 'system',
      modes: themeModes,
      setMode: expect.any(Function),
    });
    expect(() => fallback?.setMode('dark')).not.toThrow();
  });

  it('honors a persisted system mode before falling back to the device scheme', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('system');
    (useColorScheme as jest.Mock).mockReturnValue('dark');

    let current: ReturnType<typeof useThemeMode> | undefined;

    const TestConsumer = () => {
      current = useThemeMode();
      return null;
    };

    await act(async () => {
      renderer.create(
        React.createElement(
          ThemeModeProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.mode).toBe('system');
    expect(current?.colorScheme).toBe('dark');
  });

  it('ignores storage failures while updating the theme mode', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
      new Error('read failed'),
    );
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
      new Error('set failed'),
    );

    let current: ReturnType<typeof useThemeMode> | undefined;

    const TestConsumer = () => {
      current = useThemeMode();
      return null;
    };

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        React.createElement(
          ThemeModeProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      expect(() => current?.setMode('dark')).not.toThrow();
      await Promise.resolve();
    });

    expect(current?.mode).toBe('dark');
    expect(current?.colorScheme).toBe('dark');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@mobile/theme-mode',
      'dark',
    );
    act(() => tree.unmount());
  });
});
