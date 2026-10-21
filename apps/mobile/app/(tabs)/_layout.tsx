import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import React from 'react';

import { useClientOnlyValue } from '@/components/hooks/useClientOnlyValue';
import { useColorScheme } from '@/components/hooks/useColorScheme';
import { COLORS } from '@/constants/colors';
import { Routes } from '@/constants/navigation';
import { useOAuth2Auth } from '@/features/auth/OAuth2AuthProvider';
import { getProfilePictureFromClaims } from '@/features/auth/client';
import { useI18n } from '@/utils/i18n';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useI18n();
  const { user } = useOAuth2Auth();
  const picture = user ? getProfilePictureFromClaims(user.claims) : undefined;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name={Routes.DashboardScreen}
        options={{
          title: t('tabs.home'),
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name={Routes.OptionsScreen}
        options={{
          title: t('tabs.settings'),
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
      <Tabs.Screen
        name={Routes.AccountScreen}
        options={{
          title: t('tabs.account'),
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) =>
            picture ? (
              <Image
                contentFit="cover"
                source={picture}
                style={{ borderRadius: 14, height: 28, width: 28 }}
              />
            ) : (
              <TabBarIcon name="user" color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
