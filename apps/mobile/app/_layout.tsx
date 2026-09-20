import FontAwesome from '@expo/vector-icons/FontAwesome';
import { config } from '@gluestack-ui/config';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MenuProvider } from 'react-native-popup-menu';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { DiagnosticErrorBoundary } from '@/app/ErrorBoundary';
import { useAppState } from '@/components/hooks/tanstack/useAppState';
import { useOnlineManager } from '@/components/hooks/tanstack/useOnlineManager';
import { ErrorModal } from '@/components/modals/ErrorModal';
import { ThemeAwareText } from '@/components/ui/ThemeAwareText';
import { queryClient, queryPersistOptions } from '@/state/queryClient';
import { persistor, store } from '@/state/store';
import { FontProvider } from '@/utils/font';
import { I18nProvider, useI18n } from '@/utils/i18n';
import { ThemeModeProvider, useThemeMode } from '@/utils/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Codex: require('../assets/fonts/Codex.ttf'),
    CodexItalic: require('../assets/fonts/CodexItalic.ttf'),
    FallingSkySemibold: require('../assets/fonts/FallingSkySemibold.otf'),
    FallingSkyMediumOblique: require('../assets/fonts/FallingSkyMediumOblique.otf'),
    FallingSkyLight: require('../assets/fonts/FallingSkyLight.otf'),
    FallingSkyBlack: require('../assets/fonts/FallingSkyBlack.otf'),
    Fashionvictim: require('../assets/fonts/Fashionvictim.ttf'),
    Kindred: require('../assets/fonts/Kindred.ttf'),
    KindredItalic: require('../assets/fonts/KindredItalic.ttf'),
    Nesathoberyl: require('../assets/fonts/Nesathoberyl.ttf'),
    TimeburnerBold: require('../assets/fonts/TimeburnerBold.ttf'),
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    TypeLightSans: require('../assets/fonts/TypeLightSans.otf'),
    Zomboid: require('../assets/fonts/Zomboid.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <I18nProvider>
      <FontProvider>
        <ThemeModeProvider>
          <RootLayoutNav />
        </ThemeModeProvider>
      </FontProvider>
    </I18nProvider>
  );
}

function RootLayoutNav() {
  const { t } = useI18n();
  const { colorScheme: resolvedColorScheme } = useThemeMode();

  useOnlineManager();
  useAppState();

  return (
    <GluestackUIProvider config={config} colorMode={resolvedColorScheme}>
      <DiagnosticErrorBoundary>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={queryPersistOptions}
        >
          <ThemeProvider
            value={resolvedColorScheme === 'dark' ? DarkTheme : DefaultTheme}
          >
            <Provider store={store}>
              <PersistGate
                loading={<ThemeAwareText>{t('common.loading')}</ThemeAwareText>}
                persistor={persistor}
              >
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <MenuProvider>
                    <BottomSheetModalProvider>
                      <Stack>
                        <Stack.Screen
                          name="(tabs)"
                          options={{
                            headerShown: false,
                            headerTitleAlign: 'center',
                          }}
                        />
                      </Stack>
                      <ErrorModal />
                    </BottomSheetModalProvider>
                  </MenuProvider>
                </GestureHandlerRootView>
              </PersistGate>
            </Provider>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </DiagnosticErrorBoundary>
    </GluestackUIProvider>
  );
}
