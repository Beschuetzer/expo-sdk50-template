import { VStack } from '@gluestack-ui/themed';

import { ThemeAwareScreen } from '@/components/ui/ThemeAwareScreen';
import {
  ThemeAwareHeading,
  ThemeAwareText,
} from '@/components/ui/ThemeAwareText';
import { useI18n } from '@/utils/i18n';

export default function HomeScreen() {
  const { t } = useI18n();

  return (
    <ThemeAwareScreen>
      <VStack space="lg" p="$4">
        <ThemeAwareHeading size="2xl">{t('app.title')}</ThemeAwareHeading>
        <ThemeAwareText size="md">{t('app.description')}</ThemeAwareText>
      </VStack>
    </ThemeAwareScreen>
  );
}
