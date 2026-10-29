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
] as const;

const SAMPLE_CONTENT_ITEMS = [
  {
    title: 'sampleContent.morningBriefTitle',
    description: 'sampleContent.morningBriefDescription',
  },
  {
    title: 'sampleContent.readingListTitle',
    description: 'sampleContent.readingListDescription',
  },
  {
    title: 'sampleContent.recentActivityTitle',
    description: 'sampleContent.recentActivityDescription',
  },
  {
    title: 'sampleContent.weeklyPlanTitle',
    description: 'sampleContent.weeklyPlanDescription',
  },
  {
    title: 'sampleContent.fieldNotesTitle',
    description: 'sampleContent.fieldNotesDescription',
  },
  {
    title: 'sampleContent.communityBoardTitle',
    description: 'sampleContent.communityBoardDescription',
  },
  {
    title: 'sampleContent.photoJournalTitle',
    description: 'sampleContent.photoJournalDescription',
  },
] as const;

export default function HomeScreen() {
  const { t } = useI18n();

  return (
    <>
      <Stack.Screen />
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
            </VStack>
          </ThemeAwareSurface>
        </VStack>
      </ThemeAwareScreen>
    </>
  );
}
