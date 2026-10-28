import { HStack, VStack } from '@gluestack-ui/themed';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { ThemeAwareButton } from '@/components/ui/ThemeAwareButton';
import { ThemeAwareMenu } from '@/components/ui/ThemeAwareMenu';
import { ThemeAwareScreen } from '@/components/ui/ThemeAwareScreen';
import { ThemeAwareSurface } from '@/components/ui/ThemeAwareSurface';
import {
  ThemeAwareHeading,
  ThemeAwareText,
} from '@/components/ui/ThemeAwareText';
import { Routes } from '@/constants/navigation';
import { useI18n } from '@/utils/i18n';

const MENU_HIGHLIGHTS = [
  {
    title: 'menu.themeAwareTitle',
    description: 'menu.themeAwareDescription',
  },
  {
    title: 'menu.quickActionsTitle',
    description: 'menu.quickActionsDescription',
  },
  {
    title: 'menu.responsiveTitle',
    description: 'menu.responsiveDescription',
  },
  {
    title: 'menu.responsiveTitle',
    description: 'menu.responsiveDescription',
  },
  {
    title: 'menu.responsiveTitle',
    description: 'menu.responsiveDescription',
  },
  {
    title: 'menu.responsiveTitle',
    description: 'menu.responsiveDescription',
  },
  {
    title: 'menu.responsiveTitle',
    description: 'menu.responsiveDescription',
  },
   {
    title: 'menu.responsiveTitle',
    description: 'menu.responsiveDescription',
  },
   {
    title: 'menu.responsiveTitle',
    description: 'menu.responsiveDescription',
  },
   {
    title: 'menu.responsiveTitle',
    description: 'menu.responsiveDescription',
  },
   {
    title: 'menu.responsiveTitle',
    description: 'menu.responsiveDescription',
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const quickActions = [
    {
      id: 'account',
      label: t('menu.accountAction'),
      onSelect: () => {
        setIsMenuOpen(false);
        router.push(`/${Routes.AccountScreen}`);
      },
    },
    {
      id: 'settings',
      label: t('menu.settingsAction'),
      onSelect: () => {
        setIsMenuOpen(false);
        router.push('/settings');
      },
    },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <ThemeAwareMenu
              header={
                <VStack space="xs">
                  <ThemeAwareHeading size="md">
                    {t('menu.drawerTitle')}
                  </ThemeAwareHeading>
                  <ThemeAwareText size="sm">
                    {t('menu.drawerDescription')}
                  </ThemeAwareText>
                </VStack>
              }
              onOpenChange={setIsMenuOpen}
              open={isMenuOpen}
              quickActions={quickActions}
              side="right"
              width="85%"
            >
              <VStack p="$4" space="md">
                <ThemeAwareHeading size="lg">
                  {t('menu.highlightsTitle')}
                </ThemeAwareHeading>
                <ThemeAwareText>
                  {t('menu.highlightsDescription')}
                </ThemeAwareText>
                {MENU_HIGHLIGHTS.map(({ title, description }) => (
                  <ThemeAwareSurface
                    key={title}
                    darkBackground="$backgroundDark900"
                    lightBackground="$backgroundLight50"
                    borderRadius="$md"
                    p="$3"
                  >
                    <VStack space="xs">
                      <ThemeAwareHeading size="sm">
                        {t(title)}
                      </ThemeAwareHeading>
                      <ThemeAwareText>{t(description)}</ThemeAwareText>
                    </VStack>
                  </ThemeAwareSurface>
                ))}
              </VStack>
            </ThemeAwareMenu>
          ),
        }}
      />
      <ThemeAwareScreen>
        <VStack space="lg">
          <ThemeAwareHeading size="2xl">{t('app.title')}</ThemeAwareHeading>
          <ThemeAwareText size="md">{t('app.description')}</ThemeAwareText>

          <ThemeAwareSurface
            darkBackground="$backgroundDark900"
            lightBackground="$backgroundLight50"
            borderRadius="$lg"
            p="$4"
          >
            <VStack space="md">
              <ThemeAwareHeading size="lg">
                {t('menu.showcaseTitle')}
              </ThemeAwareHeading>
              <ThemeAwareText>{t('menu.showcaseDescription')}</ThemeAwareText>
              <HStack>
                <ThemeAwareButton onPress={() => setIsMenuOpen(true)} size="sm">
                  {t('menu.explore')}
                </ThemeAwareButton>
              </HStack>
            </VStack>
          </ThemeAwareSurface>
        </VStack>
      </ThemeAwareScreen>
    </>
  );
}
