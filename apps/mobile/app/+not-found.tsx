import { getLocales } from 'expo-localization';
import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemeAwareText } from '@/components/ui/ThemeAwareText';
import { ThemeAwareView } from '@/components/ui/ThemeAwareView';
import { getMessage, type Locale } from '@/utils/i18n';

export default function NotFoundScreen() {
  const locale: Locale =
    getLocales()[0]?.languageCode?.toLowerCase() === 'es' ? 'es' : 'en';
  const t = (key: Parameters<typeof getMessage>[1]) => getMessage(locale, key);

  return (
    <>
      <Stack.Screen options={{ title: t('errors.notFoundTitle') }} />
      <ThemeAwareView style={styles.container}>
        <ThemeAwareText style={styles.title}>
          {t('errors.notFoundMessage')}
        </ThemeAwareText>

        <ThemeAwareView style={styles.link}>
          <Link href="/">
            <ThemeAwareText style={styles.linkText}>
              {t('errors.goHome')}
            </ThemeAwareText>
          </Link>
        </ThemeAwareView>
      </ThemeAwareView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
