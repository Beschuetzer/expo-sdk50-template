import { Stack } from 'expo-router';

import { useClientOnlyValue } from '@/components/hooks/useClientOnlyValue';
import { useI18n } from '@/utils/i18n';
import { stackPageTitleScreenOptions } from '@/utils/pageHeaderOptions';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function HomeStackLayout() {
  const { t } = useI18n();

  return (
    <Stack
      screenOptions={{
        ...stackPageTitleScreenOptions,
        headerShown: false,
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: useClientOnlyValue(false, true),
          headerTitleAlign: 'center',
          title: t('tabs.home'),
        }}
      />
    </Stack>
  );
}
