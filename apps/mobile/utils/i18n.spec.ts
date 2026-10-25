import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { I18nProvider, getMessage, locales, useI18n } from './i18n';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

describe('i18n', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('provides the supported locales', () => {
    expect(locales).toEqual({
      en: 'English',
      es: 'Español',
    });
  });

  it('returns localized messages', () => {
    expect(getMessage('es', 'tabs.home')).toBe('Inicio');
    expect(getMessage('en', 'tabs.home')).toBe('Home');
  });

  it('localizes authenticated API timeout errors', () => {
    expect(getMessage('en', 'errors.apiRequestTimedOut')).toBe(
      'The API request timed out. Check the API connection.',
    );
    expect(getMessage('es', 'errors.apiRequestTimedOut')).toBe(
      'La solicitud a la API superó el tiempo de espera. Comprueba la conexión con la API.',
    );
  });

  it('localizes missing refresh token errors', () => {
    expect(getMessage('en', 'errors.noRefreshToken')).toBe(
      'No refresh token is available.',
    );
    expect(getMessage('es', 'errors.noRefreshToken')).toBe(
      'No hay un token de actualización disponible.',
    );
  });

  it('falls back to english strings for missing locale values', () => {
    expect(getMessage('es', 'tabs.missing' as never)).toBe('tabs.missing');
    expect(getMessage('es', 'settings.title')).toBe('Configuración');
  });

  it('loads a stored locale and exposes a translation function', async () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'es' }]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('en');

    let current: ReturnType<typeof useI18n> | undefined;

    const TestConsumer = () => {
      current = useI18n();
      return null;
    };

    await act(async () => {
      renderer.create(
        React.createElement(
          I18nProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.locale).toBe('en');
    expect(current?.t('tabs.home')).toBe('Home');
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@mobile/locale');
  });

  it('updates locale and persists it to storage', async () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    let current: ReturnType<typeof useI18n> | undefined;

    const TestConsumer = () => {
      current = useI18n();
      return null;
    };

    await act(async () => {
      const tree = renderer.create(
        React.createElement(
          I18nProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      act(() => {
        current?.setLocale('es');
      });
      tree.update(
        React.createElement(
          I18nProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
    });

    expect(current?.locale).toBe('es');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@mobile/locale', 'es');
  });

  it('throws when useI18n is called outside a provider', () => {
    const TestConsumer = () => {
      useI18n();
      return null;
    };
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      expect(() => {
        renderer.create(React.createElement(TestConsumer));
      }).toThrow('useI18n must be used within an I18nProvider');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('falls back to the device locale when a stored locale is invalid', async () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'fr' }]);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('fr');

    let current: ReturnType<typeof useI18n> | undefined;

    const TestConsumer = () => {
      current = useI18n();
      return null;
    };

    await act(async () => {
      renderer.create(
        React.createElement(
          I18nProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(current?.locale).toBe('en');
  });

  it('ignores locale storage failures when hydrating and updating locale', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(
      new Error('read failed'),
    );
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(
      new Error('write failed'),
    );

    let current: ReturnType<typeof useI18n> | undefined;

    const TestConsumer = () => {
      current = useI18n();
      return null;
    };

    await act(async () => {
      const tree = renderer.create(
        React.createElement(
          I18nProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(() => current?.setLocale('es')).not.toThrow();
      tree.update(
        React.createElement(
          I18nProvider,
          null,
          React.createElement(TestConsumer, null),
        ),
      );
    });

    expect(current?.locale).toBe('es');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@mobile/locale', 'es');
  });
});
