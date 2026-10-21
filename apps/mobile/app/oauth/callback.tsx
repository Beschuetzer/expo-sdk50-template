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
import { Routes } from '@/constants/navigation';
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
    } else if (state === 'error' || state === 'cancelled') {
      router.replace(`/${Routes.AccountScreen}`);
    }
  }, [isAuthenticated, router, state]);

  return (
    <ThemeAwareScreen contentContainerStyle={{ flexGrow: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <VStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        px="$6"
        py="$12"
        space="2xl"
      >
        <ThemeAwareSurface
          alignItems="center"
          borderRadius="$full"
          borderColor="$primary200"
          borderWidth={1}
          darkBackground="$backgroundDark900"
          h="$20"
          justifyContent="center"
          lightBackground="$primary50"
          w="$20"
        >
          <FontAwesome
            name="shield"
            color={COLORS[colorScheme].tint}
            size={32}
          />
        </ThemeAwareSurface>
        <VStack alignItems="center" maxWidth={360} space="md" width="100%">
          <ThemeAwareHeading size="2xl" textAlign="center">
            {t('auth.redirectingHome')}
          </ThemeAwareHeading>
          <ThemeAwareText
            maxWidth={300}
            textAlign="center"
            color="$textLight500"
            size="md"
          >
            {t('auth.redirectingHomeMessage')}
          </ThemeAwareText>
        </VStack>
        <Spinner accessibilityLabel={t('common.loading')} color="$primary500" />
      </VStack>
    </ThemeAwareScreen>
  );
}
