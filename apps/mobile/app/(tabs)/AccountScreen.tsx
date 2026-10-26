import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ButtonText, HStack, VStack } from '@gluestack-ui/themed';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';

import { ThemeAwareButton } from '@/components/ui/ThemeAwareButton';
import { ThemeAwareHeading } from '@/components/ui/ThemeAwareHeading';
import { ThemeAwareScreen } from '@/components/ui/ThemeAwareScreen';
import { ThemeAwareSurface } from '@/components/ui/ThemeAwareSurface';
import { ThemeAwareText } from '@/components/ui/ThemeAwareText';
import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { COLORS } from '@/constants/colors';
import { useOAuth2Auth } from '@/features/auth/OAuth2AuthProvider';
import {
  type AccountProvider,
  getAccountProviderFromClaims,
  getDisplayNameFromClaims,
  getProfilePictureFromClaims,
} from '@/features/auth/client';
import { useI18n, type TranslationKey } from '@/utils/i18n';

const accountProviderTranslationKeys: Record<AccountProvider, TranslationKey> =
  {
    apple: 'account.providerApple',
    discord: 'account.providerDiscord',
    facebook: 'account.providerFacebook',
    github: 'account.providerGitHub',
    gitlab: 'account.providerGitLab',
    google: 'account.providerGoogle',
    linkedin: 'account.providerLinkedIn',
    microsoft: 'account.providerMicrosoft',
    x: 'account.providerX',
  };

function AccountIcon(props: Omit<ComponentProps<typeof FontAwesome>, 'name'>) {
  return <FontAwesome {...props} name="user-circle" />;
}

function getClaimText(
  claims: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = claims[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const values = value.filter(
      (item): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    );
    return values.length > 0 ? values.join(', ') : undefined;
  }
  return undefined;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack justifyContent="space-between" space="md" alignItems="flex-start">
      <ThemeAwareText flex={1} color="$textLight500" fontSize="$sm">
        {label}
      </ThemeAwareText>
      <ThemeAwareText flex={2} textAlign="right">
        {value}
      </ThemeAwareText>
    </HStack>
  );
}

export default function AccountScreen() {
  const { t } = useI18n();
  const { colorScheme } = useThemeAwareColors();
  const accountIconColor = COLORS[colorScheme].tint;
  const {
    callAuthenticatedEndpoint,
    isAuthenticated,
    isReady,
    resetAuthentication,
    state: authState,
    user,
  } = useOAuth2Auth();
  const displayName = user
    ? getDisplayNameFromClaims(user.claims) ?? user.subject
    : undefined;
  const picture = user ? getProfilePictureFromClaims(user.claims) : undefined;
  const accountProvider = user
    ? getAccountProviderFromClaims(user.claims)
    : undefined;
  const email = user ? getClaimText(user.claims, 'email') : undefined;
  const username = user
    ? getClaimText(user.claims, 'preferred_username') ??
      getClaimText(user.claims, 'nickname')
    : undefined;
  const subject =
    user?.subject ?? (user ? getClaimText(user.claims, 'sub') : undefined);
  const issuer = user ? getClaimText(user.claims, 'iss') : undefined;
  const audience = user ? getClaimText(user.claims, 'aud') : undefined;
  const isBusy = authState === 'authenticating' || authState === 'loading';
  const onPressSignIn = async () => {
    await callAuthenticatedEndpoint();
  };
  const onPressLogout = async () => {
    await resetAuthentication();
  };

  const statusMessage =
    authState === 'authenticating'
      ? 'status.authenticating'
      : authState === 'loading'
        ? 'status.loadingAuthenticatedRequest'
        : authState === 'cancelled'
          ? 'status.authenticationCancelled'
          : authState === 'success'
            ? 'auth.signedIn'
            : authState === 'error'
              ? 'errors.authenticationFailed'
              : null;

  return (
    <ThemeAwareScreen space="md" p="$4">
      <HStack space="md" alignItems="center">
        {picture ? (
          <Image
            accessibilityLabel={displayName ?? t('account.title')}
            contentFit="cover"
            source={picture}
            style={{ borderRadius: 28, height: 56, width: 56 }}
          />
        ) : (
          <AccountIcon color={accountIconColor} size={42} />
        )}
        <VStack flex={1} space="xs">
          <ThemeAwareHeading size="2xl">{t('account.title')}</ThemeAwareHeading>
          {displayName ? <ThemeAwareText>{displayName}</ThemeAwareText> : null}
        </VStack>
      </HStack>
      <ThemeAwareSurface
        darkBackground="$backgroundDark900"
        lightBackground="$coolGray50"
        borderRadius="$lg"
        p="$5"
      >
        {isAuthenticated ? (
          <VStack space="md">
            <HStack space="sm" alignItems="center">
              <FontAwesome name="check-circle" color="#27AE60" size={20} />
              <VStack flex={1} space="xs">
                <ThemeAwareText fontWeight="$bold">
                  {t('account.signedInStatus')}
                </ThemeAwareText>
                <ThemeAwareText size="sm">
                  {t('account.signedInMessage')}
                </ThemeAwareText>
              </VStack>
            </HStack>
            <ThemeAwareButton disabled={isBusy} onPress={onPressLogout}>
              {t('actions.logout')}
            </ThemeAwareButton>
          </VStack>
        ) : (
          <VStack space="md">
            <VStack space="xs">
              <ThemeAwareText fontWeight="$bold">
                {t('account.signedOutStatus')}
              </ThemeAwareText>
              <ThemeAwareText size="sm">
                {t('account.signedOutMessage')}
              </ThemeAwareText>
            </VStack>
            <ThemeAwareButton
              disabled={!isReady || isBusy}
              onPress={onPressSignIn}
            >
              <ButtonText>{t('actions.signIn')}</ButtonText>
            </ThemeAwareButton>
          </VStack>
        )}
      </ThemeAwareSurface>
      {isAuthenticated && user ? (
        <VStack space="md">
          <ThemeAwareHeading size="lg">
            {t('account.profileTitle')}
          </ThemeAwareHeading>
          <ThemeAwareSurface
            darkBackground="$backgroundDark900"
            lightBackground="$coolGray50"
            borderRadius="$lg"
            p="$5"
          >
            <VStack space="md">
              <DetailRow
                label={t('account.displayName')}
                value={displayName ?? t('account.unavailable')}
              />
              <DetailRow
                label={t('account.email')}
                value={email ?? t('account.unavailable')}
              />
              <DetailRow
                label={t('account.username')}
                value={username ?? t('account.unavailable')}
              />
              <DetailRow
                label={t('account.provider')}
                value={
                  accountProvider
                    ? t(accountProviderTranslationKeys[accountProvider])
                    : t('account.custom')
                }
              />
            </VStack>
          </ThemeAwareSurface>
        </VStack>
      ) : null}
      {isAuthenticated && user ? (
        <VStack space="md">
          <ThemeAwareHeading size="lg">
            {t('account.identityTitle')}
          </ThemeAwareHeading>
          <ThemeAwareSurface
            darkBackground="$backgroundDark900"
            lightBackground="$coolGray50"
            borderRadius="$lg"
            p="$5"
          >
            <VStack space="md">
              <DetailRow
                label={t('account.accountId')}
                value={subject ?? t('account.unavailable')}
              />
              <DetailRow
                label={t('account.issuer')}
                value={issuer ?? t('account.unavailable')}
              />
              <DetailRow
                label={t('account.audience')}
                value={audience ?? t('account.unavailable')}
              />
            </VStack>
          </ThemeAwareSurface>
        </VStack>
      ) : null}
      {!isReady && authState === 'idle' ? (
        <ThemeAwareText>{t('status.preparingAuthentication')}</ThemeAwareText>
      ) : null}
      {statusMessage ? (
        <ThemeAwareText>{t(statusMessage)}</ThemeAwareText>
      ) : null}
    </ThemeAwareScreen>
  );
}
