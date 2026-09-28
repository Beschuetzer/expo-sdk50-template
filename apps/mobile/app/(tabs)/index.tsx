import type { HealthResponse } from '@expo-50sdk-template/shared-types';
import { HStack, VStack } from '@gluestack-ui/themed';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  BarcodeScanner,
  type BarCodeScannerResult,
} from '@/components/reusable/BarcodeScanner';
import { ThemeAwareButton } from '@/components/ui/ThemeAwareButton';
import { ThemeAwareImageSelector } from '@/components/ui/ThemeAwareImageSelector';
import { ThemeAwareInput } from '@/components/ui/ThemeAwareInput';
import { ThemeAwareScreen } from '@/components/ui/ThemeAwareScreen';
import { ThemeAwareSurface } from '@/components/ui/ThemeAwareSurface';
import {
  ThemeAwareHeading,
  ThemeAwareText,
} from '@/components/ui/ThemeAwareText';
import { verifyAuthenticatedEndpointRejectsAnonymousRequest } from '@/features/auth/client';
import { useOAuth2Auth } from '@/features/auth/hooks/useOAuth2Auth';
import {
  backendHealthQueryKey,
  useBackendHealthQuery,
} from '@/features/backend/hooks/useBackendHealthQuery';
import {
  ERRORS_INITIAL,
  setError,
  setErrors,
} from '@/state/slices/generalSlice';
import { useAppDispatch } from '@/state/store';
import { useI18n, type TranslationKey } from '@/utils/i18n';

/*
 * The home screen intentionally uses FlashList even for this small starter
 * dataset so new template screens have a clear list-performance example.
 */
export default function HomeScreen() {
  const dispatch = useAppDispatch();
  const { t } = useI18n();
  const [connectionStatus, setConnectionStatus] =
    useState<TranslationKey | null>(null);
  const [cacheStatus, setCacheStatus] = useState<TranslationKey | null>(null);
  const [securityStatus, setSecurityStatus] = useState<TranslationKey | null>(
    null,
  );
  const [refreshStatus, setRefreshStatus] = useState<TranslationKey | null>(
    null,
  );
  const [isBarcodeScannerVisible, setIsBarcodeScannerVisible] = useState(false);
  const [barcodeResult, setBarcodeResult] =
    useState<BarCodeScannerResult | null>(null);
  const [isImageSelectorVisible, setIsImageSelectorVisible] = useState(false);
  const [testErrorCount, setTestErrorCount] = useState('20');
  const queryClient = useQueryClient();
  const { refetch: refetchBackendHealth } = useBackendHealthQuery();
  const {
    callAuthenticatedEndpoint,
    isReady: isAuthReady,
    refreshAuthenticatedSession,
    signOut,
    state: authState,
    user: authenticatedUser,
  } = useOAuth2Auth();
  const checklistItems = [
    t('checklist.replaceContent'),
    t('checklist.addRedux'),
    t('checklist.addScreens'),
  ];

  const onPressTestErrorModal = () => {
    const errorCount = Math.max(1, Number.parseInt(testErrorCount, 10) || 1);
    setTestErrorCount(String(errorCount));
    dispatch(setErrors(ERRORS_INITIAL));
    dispatch(
      setErrors(
        Array.from({ length: errorCount }, (_, index) => ({
          message: `${t('errors.testErrorModalMessage')} ${index + 1}/${errorCount}`,
          name: 'DemoError',
          stack: t('errors.testErrorModalStack'),
          code: `TEST_ERROR_MODAL_${index + 1}`,
          statusCode: 500,
        })),
      ),
    );
  };

  const onPressTestBackendConnection = async () => {
    setConnectionStatus('status.checkingBackend');

    try {
      const { data: result, error } = await refetchBackendHealth();
      if (error) {
        throw error;
      }

      setConnectionStatus(
        result?.status === 'ok'
          ? 'status.backendSuccess'
          : 'errors.unexpectedBackendStatus',
      );
      setCacheStatus('status.backendCached');
    } catch (error) {
      setConnectionStatus('errors.backendUnavailable');
      dispatch(
        setError({
          message:
            error instanceof Error
              ? error.message
              : t('errors.backendRequestFailed'),
          name: 'BackendConnectionError',
        }),
      );
    }
  };

  const onPressReadBackendCache = () => {
    const cachedHealth = queryClient.getQueryData<HealthResponse>(
      backendHealthQueryKey,
    );
    setCacheStatus(cachedHealth ? 'status.cacheHit' : 'status.cacheMiss');
  };

  const onPressTestAuthenticatedEndpoint = async () => {
    await callAuthenticatedEndpoint();
  };

  const onPressTestTokenRefresh = async () => {
    setRefreshStatus('status.refreshingToken');
    try {
      await refreshAuthenticatedSession();
      setRefreshStatus('status.tokenRefreshSuccess');
    } catch (error) {
      setRefreshStatus('errors.tokenRefreshFailed');
      dispatch(
        setError({
          message:
            error instanceof Error
              ? error.message
              : t('errors.tokenRefreshFailed'),
          name: 'TokenRefreshError',
        }),
      );
    }
  };

  const onPressSignOut = async () => {
    try {
      await signOut();
      setRefreshStatus('status.signedOut');
    } catch (error) {
      setRefreshStatus('errors.signOutFailed');
      dispatch(
        setError({
          message:
            error instanceof Error ? error.message : t('errors.signOutFailed'),
          name: 'SignOutError',
        }),
      );
    }
  };

  const onPressTestAnonymousEndpoint = async () => {
    setSecurityStatus('status.checkingAnonymousAccess');

    try {
      await verifyAuthenticatedEndpointRejectsAnonymousRequest();
      setSecurityStatus('status.anonymousRequestRejected');
    } catch (error) {
      setSecurityStatus('errors.anonymousRequestAccepted');
      dispatch(
        setError({
          message:
            error instanceof Error
              ? error.message
              : t('errors.anonymousRequestFailed'),
          name: 'AnonymousEndpointSecurityError',
        }),
      );
    }
  };

  const authenticatedStatus =
    authState === 'authenticating'
      ? 'status.authenticating'
      : authState === 'loading'
        ? 'status.loadingAuthenticatedRequest'
        : authState === 'cancelled'
          ? 'status.authenticationCancelled'
          : authState === 'success'
            ? 'status.authenticatedRequestSuccess'
            : authState === 'error'
              ? 'errors.authenticationFailed'
              : null;

  const onPressClearBackendCache = () => {
    queryClient.removeQueries({ queryKey: backendHealthQueryKey });
    setCacheStatus('status.cacheCleared');
  };

  return (
    <ThemeAwareScreen>
      <VStack space="lg" p="$4">
        <ThemeAwareHeading size="2xl">{t('app.title')}</ThemeAwareHeading>
        <ThemeAwareText size="md">{t('app.description')}</ThemeAwareText>
        <ThemeAwareHeading size="sm">{t('checklist.title')}</ThemeAwareHeading>
        {checklistItems.map((item) => (
          <ThemeAwareSurface
            key={item}
            darkBackground="$backgroundDark900"
            lightBackground="$coolGray50"
            borderRadius="$lg"
            pb="$1"
            px="$4"
          >
            <ThemeAwareText>• {item}</ThemeAwareText>
          </ThemeAwareSurface>
        ))}
        <ThemeAwareButton
          onPress={() => {
            setIsBarcodeScannerVisible((visible) => !visible);
            setBarcodeResult(null);
          }}
          variant="outline"
        >
          {t(
            isBarcodeScannerVisible
              ? 'actions.hideBarcodeScanner'
              : 'actions.testBarcodeScanner',
          )}
        </ThemeAwareButton>
        {isBarcodeScannerVisible ? (
          <BarcodeScanner onScanned={setBarcodeResult} />
        ) : null}
        {barcodeResult ? (
          <ThemeAwareSurface
            darkBackground="$backgroundDark900"
            lightBackground="$backgroundLight0"
            borderRadius="$lg"
            p="$4"
          >
            <ThemeAwareText>
              {t('scanner.resultType')}: {barcodeResult.type}
            </ThemeAwareText>
            <ThemeAwareText>
              {t('scanner.resultData')}: {barcodeResult.data}
            </ThemeAwareText>
          </ThemeAwareSurface>
        ) : null}
        <ThemeAwareButton
          onPress={() => setIsImageSelectorVisible((visible) => !visible)}
          variant="outline"
        >
          {t('actions.testImageSelector')}
        </ThemeAwareButton>
        {isImageSelectorVisible ? (
          <ThemeAwareImageSelector
            cameraButtonLabel={t('actions.selectImageFromCamera')}
            clearButtonLabel={t('actions.clearImage')}
            libraryButtonLabel={t('actions.selectImageFromLibrary')}
            onError={(error) =>
              dispatch(
                setError({
                  message:
                    error instanceof Error
                      ? error.message
                      : t('errors.imageSelectionFailed'),
                  name: 'ImageSelectionError',
                }),
              )
            }
            onPermissionDenied={() =>
              dispatch(
                setError({
                  message: t('errors.imagePermissionDenied'),
                  name: 'ImagePermissionError',
                }),
              )
            }
          />
        ) : null}
        <HStack space="sm" alignItems="center">
          <ThemeAwareButton
            onPress={onPressTestErrorModal}
            variant="solid"
            flex={3}
          >
            {t('actions.testErrorModal')}
          </ThemeAwareButton>
          <ThemeAwareInput
            decrementAccessibilityLabel={t('actions.decreaseErrorCount')}
            incrementAccessibilityLabel={t('actions.increaseErrorCount')}
            inputFieldProps={{
              accessibilityLabel: t('actions.testErrorCount'),
              placeholder: t('actions.testErrorCount'),
            }}
            inputType="number"
            onChangeText={setTestErrorCount}
            value={testErrorCount}
          />
        </HStack>
        <ThemeAwareButton
          onPress={onPressTestBackendConnection}
          variant="outline"
        >
          {t('actions.testBackendConnection')}
        </ThemeAwareButton>
        <ThemeAwareButton
          disabled={authState === 'authenticating' || authState === 'loading'}
          onPress={onPressTestAuthenticatedEndpoint}
          variant="outline"
        >
          {t('actions.testAuthenticatedEndpoint')}
        </ThemeAwareButton>
        <ThemeAwareButton
          disabled={authState === 'authenticating' || authState === 'loading'}
          onPress={onPressTestTokenRefresh}
          variant="outline"
        >
          {t('actions.testTokenRefresh')}
        </ThemeAwareButton>
        <ThemeAwareButton
          disabled={authState === 'authenticating' || authState === 'loading'}
          onPress={onPressSignOut}
          variant="outline"
        >
          {t('actions.signOut')}
        </ThemeAwareButton>
        {!isAuthReady && authState === 'idle' ? (
          <ThemeAwareText>{t('status.preparingAuthentication')}</ThemeAwareText>
        ) : null}
        <ThemeAwareButton
          onPress={onPressTestAnonymousEndpoint}
          variant="outline"
        >
          {t('actions.testAnonymousEndpoint')}
        </ThemeAwareButton>
        <ThemeAwareButton onPress={onPressReadBackendCache} variant="outline">
          {t('actions.readBackendCache')}
        </ThemeAwareButton>
        <ThemeAwareButton onPress={onPressClearBackendCache} variant="outline">
          {t('actions.clearBackendCache')}
        </ThemeAwareButton>
        {connectionStatus ? (
          <ThemeAwareText>{t(connectionStatus)}</ThemeAwareText>
        ) : null}
        {cacheStatus ? <ThemeAwareText>{t(cacheStatus)}</ThemeAwareText> : null}
        {authenticatedStatus ? (
          <ThemeAwareText>{t(authenticatedStatus)}</ThemeAwareText>
        ) : null}
        {refreshStatus ? (
          <ThemeAwareText>{t(refreshStatus)}</ThemeAwareText>
        ) : null}
        {securityStatus ? (
          <ThemeAwareText>{t(securityStatus)}</ThemeAwareText>
        ) : null}
        {authenticatedUser ? (
          <ThemeAwareText>
            {authenticatedUser.subject ?? 'Authenticated user'}
          </ThemeAwareText>
        ) : null}
      </VStack>
    </ThemeAwareScreen>
  );
}
