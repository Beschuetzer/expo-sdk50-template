import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Spinner, VStack } from '@gluestack-ui/themed';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { ThemeAwareHeading } from '@/components/ui/ThemeAwareHeading';
import { ThemeAwareScreen } from '@/components/ui/ThemeAwareScreen';
import { ThemeAwareSurface } from '@/components/ui/ThemeAwareSurface';
import { ThemeAwareText } from '@/components/ui/ThemeAwareText';
import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { COLORS } from '@/constants/colors';
import { useOAuth2Auth } from '@/features/auth/OAuth2AuthProvider';
import { useI18n } from '@/utils/i18n';

export default function OAuthCallbackScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colorScheme } = useThemeAwareColors();
  const { isAuthenticated, state } = useOAuth2Auth();

  useEffect(() => {
    if (isAuthenticated && state === 'success') {
      router.replace('/');
    }
  }, [isAuthenticated, router, state]);

  return (
    <ThemeAwareScreen contentContainerStyle={{ flexGrow: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <VStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        p="$6"
        space="xl"
      >
        <ThemeAwareSurface
          alignItems="center"
          borderRadius="$full"
          darkBackground="$primary900"
          justifyContent="center"
          lightBackground="$primary100"
          p="$5"
        >
          <FontAwesome
            name="arrow-right"
            color={COLORS[colorScheme].tint}
            size={28}
          />
        </ThemeAwareSurface>
        <VStack alignItems="center" space="sm">
          <ThemeAwareHeading size="2xl" textAlign="center">
            {t('auth.redirectingHome')}
          </ThemeAwareHeading>
          <ThemeAwareText
            maxWidth={300}
            textAlign="center"
            color="$textLight500"
          >
            {t('auth.redirectingHomeMessage')}
          </ThemeAwareText>
        </VStack>
        <Spinner accessibilityLabel={t('common.loading')} color="$primary500" />
      </VStack>
    </ThemeAwareScreen>
  );
}
