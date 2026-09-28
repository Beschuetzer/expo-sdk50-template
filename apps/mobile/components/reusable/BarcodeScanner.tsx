import {
  BarCodeScanner,
  type BarCodeScannerResult,
} from 'expo-barcode-scanner';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemeAwareText } from '@/components/ui/ThemeAwareText';
import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { useI18n } from '@/utils/i18n';

export type { BarCodeScannerResult };

export type BarcodeScannerProps = {
  onScanned: (result: BarCodeScannerResult) => void;
  barCodeTypes?: ComponentProps<typeof BarCodeScanner>['barCodeTypes'];
  isActive?: boolean;
  autoRequestPermission?: boolean;
  resetKey?: string | number;
  containerStyle?: StyleProp<ViewStyle>;
  scannerStyle?: StyleProp<ViewStyle>;
  onPermissionDenied?: () => void;
};

export function BarcodeScanner({
  onScanned,
  barCodeTypes,
  isActive = true,
  autoRequestPermission = true,
  resetKey,
  containerStyle,
  scannerStyle,
  onPermissionDenied,
}: BarcodeScannerProps) {
  const { t } = useI18n();
  const { colorScheme, getTextColor } = useThemeAwareColors();
  const [permission, requestPermission] = BarCodeScanner.usePermissions();
  const [hasScanned, setHasScanned] = useState(false);
  const scanLock = useRef(false);

  useEffect(() => {
    setHasScanned(false);
    scanLock.current = false;
  }, [resetKey]);

  useEffect(() => {
    if (autoRequestPermission && permission?.granted === false) {
      requestPermission().catch(() => undefined);
    }
  }, [autoRequestPermission, permission?.granted, requestPermission]);

  const handlePermissionRequest = async () => {
    const response = await requestPermission();
    if (!response.granted) {
      onPermissionDenied?.();
    }
  };

  const handleBarCodeScanned = (result: BarCodeScannerResult) => {
    if (!isActive || scanLock.current) {
      return;
    }

    scanLock.current = true;
    setHasScanned(true);
    onScanned(result);
  };

  const showPermissionPrompt = permission?.granted !== true;
  const showScanner = !showPermissionPrompt && isActive && !hasScanned;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colorScheme === 'dark' ? '#111827' : '#111827' },
        containerStyle,
      ]}
    >
      {showScanner ? (
        <BarCodeScanner
          barCodeTypes={barCodeTypes}
          onBarCodeScanned={handleBarCodeScanned}
          style={[styles.scanner, scannerStyle]}
        />
      ) : null}

      {showScanner ? (
        <View pointerEvents="none" style={styles.scanFrame} />
      ) : null}

      {showPermissionPrompt ? (
        <View style={styles.messageContainer}>
          <ThemeAwareText color={getTextColor(true)} style={styles.message}>
            {permission?.canAskAgain === false
              ? t('scanner.permissionDenied')
              : t('scanner.permissionRequired')}
          </ThemeAwareText>
          {permission?.canAskAgain !== false ? (
            <Pressable
              accessibilityRole="button"
              onPress={handlePermissionRequest}
              style={styles.action}
            >
              <ThemeAwareText
                color={getTextColor(true)}
                style={styles.actionText}
              >
                {t('scanner.allowCamera')}
              </ThemeAwareText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {hasScanned ? (
        <View style={styles.messageContainer}>
          <ThemeAwareText color={getTextColor(true)} style={styles.message}>
            {t('scanner.scanComplete')}
          </ThemeAwareText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              scanLock.current = false;
              setHasScanned(false);
            }}
            style={styles.action}
          >
            <ThemeAwareText
              color={getTextColor(true)}
              style={styles.actionText}
            >
              {t('scanner.scanAgain')}
            </ThemeAwareText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 280,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  scanner: {
    ...StyleSheet.absoluteFillObject,
  },
  scanFrame: {
    alignSelf: 'center',
    borderColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    height: 180,
    marginTop: 50,
    width: '72%',
  },
  messageContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    textAlign: 'center',
  },
  action: {
    borderColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionText: {
    fontWeight: 'bold',
  },
});
