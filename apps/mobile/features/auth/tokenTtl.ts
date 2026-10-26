import type { TranslationKey } from '@/utils/i18n';

type Translate = (key: TranslationKey) => string;

export function formatAccessTokenTtl(
  expiresAt: number,
  now: number,
  t: Translate,
) {
  if (!Number.isFinite(expiresAt) || !Number.isFinite(now)) {
    return t('home.accessTokenTtlUnavailable');
  }

  let remainingSeconds = Math.ceil((expiresAt - now) / 1000);
  if (remainingSeconds <= 0) return t('home.accessTokenExpired');

  const days = Math.floor(remainingSeconds / 86_400);
  remainingSeconds %= 86_400;
  const hours = Math.floor(remainingSeconds / 3_600);
  remainingSeconds %= 3_600;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${t('home.ttlDayShort')}`);
  if (hours > 0) parts.push(`${hours}${t('home.ttlHourShort')}`);
  if (minutes > 0) parts.push(`${minutes}${t('home.ttlMinuteShort')}`);
  if (seconds > 0) parts.push(`${seconds}${t('home.ttlSecondShort')}`);

  return parts.join(' ');
}
