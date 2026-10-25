import { formatAccessTokenTtl } from './tokenTtl';

import { getMessage, type TranslationKey } from '@/utils/i18n';

const translate = (key: TranslationKey) => getMessage('en', key);

describe('formatAccessTokenTtl', () => {
  it('formats days, hours, minutes, and seconds', () => {
    expect(formatAccessTokenTtl(90_061_000, 0, translate)).toBe('1d 1h 1m 1s');
  });

  it('rounds a partial second up and reports expired tokens', () => {
    expect(formatAccessTokenTtl(4_001, 0, translate)).toBe('5s');
    expect(formatAccessTokenTtl(0, 1, translate)).toBe('Expired');
  });

  it('omits zero-valued time units', () => {
    expect(formatAccessTokenTtl(60_000, 0, translate)).toBe('1m');
  });

  it('reports an unavailable lifetime for invalid timestamps', () => {
    expect(formatAccessTokenTtl(Number.NaN, 0, translate)).toBe('Unavailable');
  });
});
