import { VStack } from '@gluestack-ui/themed';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { ThemeAwareButton } from '@/components/ui/ThemeAwareButton';
import { ThemeAwareMenu } from '@/components/ui/ThemeAwareMenu';
import { ThemeAwareHeading } from '@/components/ui/ThemeAwareText';
import { AppRoutePaths } from '@/constants/navigation';
import { useI18n } from '@/utils/i18n';

/**
 * Main navigation menu items.  Do NOT include the root tabs themselves.  Keep this list focused on additional navigation options within the app.  Alphabetize them too.
 */
const NAVIGATION_ITEMS = [
  { id: 'settings', label: 'tabs.settings', route: AppRoutePaths.settings },
] as const;

export function MainTabNavigationMenu() {
  const { t } = useI18n();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ThemeAwareMenu
      header={<ThemeAwareHeading>{t('menu.navigation')}</ThemeAwareHeading>}
      onOpenChange={setIsOpen}
      open={isOpen}
      side="left"
    >
      <ScrollView style={{ flex: 1 }}>
        <VStack p="$4" space="sm">
          {NAVIGATION_ITEMS.map((item) => (
            <ThemeAwareButton
              key={item.id}
              onPress={() => {
                setIsOpen(false);
                router.push(item.route);
              }}
              variant="outline"
              width="100%"
            >
              {t(item.label)}
            </ThemeAwareButton>
          ))}
        </VStack>
      </ScrollView>
    </ThemeAwareMenu>
  );
}
