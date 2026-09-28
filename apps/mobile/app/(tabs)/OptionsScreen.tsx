import { HStack, VStack } from '@gluestack-ui/themed';

import { ThemeAwareButton } from '@/components/ui/ThemeAwareButton';
import { ThemeAwareHeading } from '@/components/ui/ThemeAwareHeading';
import { ThemeAwareScreen } from '@/components/ui/ThemeAwareScreen';
import { ThemeAwareText } from '@/components/ui/ThemeAwareText';
import { useFont, type FontFamily } from '@/utils/font';
import { useI18n } from '@/utils/i18n';
import { useThemeMode } from '@/utils/theme';

export default function SettingsScreen() {
  const { locale, locales, setLocale, t } = useI18n();
  const { font, fonts, setFont } = useFont();
  const { mode, modes, setMode } = useThemeMode();

  return (
    <ThemeAwareScreen
      absolutelyPositionedJsx={
        <ThemeAwareButton>{t('actions.saveSettings')}</ThemeAwareButton>
      }
    >
      <ThemeAwareHeading size="lg">{t('settings.title')}</ThemeAwareHeading>
      <VStack space="md">
        <HStack justifyContent="space-between" alignItems="center">
          <ThemeAwareText>{t('theme.label')}</ThemeAwareText>
          <HStack space="sm">
            {(Object.keys(modes) as (keyof typeof modes)[]).map(
              (availableMode) => (
                <ThemeAwareButton
                  key={availableMode}
                  variant={mode === availableMode ? 'solid' : 'outline'}
                  size="sm"
                  onPress={() => setMode(availableMode)}
                >
                  {t(`theme.${availableMode}`)}
                </ThemeAwareButton>
              ),
            )}
          </HStack>
        </HStack>
        <VStack space="sm">
          <ThemeAwareText>{t('font.label')}</ThemeAwareText>
          <HStack width="100%" space="sm" flexWrap="wrap">
            {(Object.keys(fonts) as FontFamily[]).map((availableFont) => (
              <ThemeAwareButton
                key={availableFont}
                variant={font === availableFont ? 'solid' : 'outline'}
                size="sm"
                onPress={() => setFont(availableFont)}
              >
                {t(`font.${availableFont}`)}
              </ThemeAwareButton>
            ))}
          </HStack>
        </VStack>
        <HStack justifyContent="space-between" alignItems="center">
          <ThemeAwareText>{t('settings.notifications')}</ThemeAwareText>
          <ThemeAwareButton variant="outline" size="sm">
            {t('settings.manage')}
          </ThemeAwareButton>
        </HStack>
        <HStack justifyContent="space-between" alignItems="center">
          <ThemeAwareText>{t('settings.privacy')}</ThemeAwareText>
          <ThemeAwareButton variant="outline" size="sm">
            {t('settings.review')}
          </ThemeAwareButton>
        </HStack>

        <HStack justifyContent="space-between" alignItems="center">
          <ThemeAwareText>{t('language.label')}</ThemeAwareText>
          <HStack space="sm">
            {(Object.keys(locales) as (keyof typeof locales)[]).map(
              (availableLocale) => (
                <ThemeAwareButton
                  key={availableLocale}
                  variant={locale === availableLocale ? 'solid' : 'outline'}
                  size="sm"
                  onPress={() => setLocale(availableLocale)}
                >
                  {locales[availableLocale]}
                </ThemeAwareButton>
              ),
            )}
          </HStack>
        </HStack>
      </VStack>
    </ThemeAwareScreen>
  );
}
