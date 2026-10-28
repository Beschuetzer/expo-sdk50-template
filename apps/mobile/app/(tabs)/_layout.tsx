import { Image } from 'expo-image';
import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { useClientOnlyValue } from '@/components/hooks/useClientOnlyValue';
import { useColorScheme } from '@/components/hooks/useColorScheme';
import { ThemeAwareIcon } from '@/components/ui/ThemeAwareIcon';
import { COLORS } from '@/constants/colors';
import { Routes } from '@/constants/navigation';
import { useOAuth2Auth } from '@/features/auth/OAuth2AuthProvider';
import { getProfilePictureFromClaims } from '@/features/auth/client';
import { useI18n } from '@/utils/i18n';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof ThemeAwareIcon>['name'];
  color: string;
}) {
  return <ThemeAwareIcon size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const router = useRouter();
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
        name="(home)"
        options={{
          title: t('tabs.home'),
          headerShown: false,
          headerTitleAlign: 'center',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name={Routes.AccountScreen}
        options={{
          title: t('tabs.account'),
          headerTitleAlign: 'center',
          headerRightContainerStyle: { paddingRight: 12 },
          headerRight: () => (
            <Pressable
              accessibilityLabel={t('tabs.settings')}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => router.push('/settings')}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                padding: 8,
              })}
            >
              <ThemeAwareIcon name="cog" size={20} />
            </Pressable>
          ),
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
