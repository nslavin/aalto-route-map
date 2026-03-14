describe('i18n', () => {
  const A = window.Aalto;

  describe('A.t(key)', () => {
    it('returns English string when lang is en', () => {
      A.lang = 'en';
      expect(A.t('headerTitle')).toBe('Alvar Aalto Route');
      expect(A.t('clear')).toBe('CLEAR');
      expect(A.t('filterBookmarks')).toBe('Bookmarks');
    });

    it('returns Finnish string when lang is fi', () => {
      A.lang = 'fi';
      expect(A.t('headerTitle')).toBe('Alvar Aallon Reitti');
      expect(A.t('clear')).toBe('TYHJENNÄ');
      expect(A.t('filterBookmarks')).toBe('Suosikit');
    });

    it('falls back to English for missing key in current lang', () => {
      A.lang = 'fi';
      expect(A.i18n.en.headerTitle).toBeDefined();
      expect(A.t('headerTitle')).toBe('Alvar Aallon Reitti');
      A.lang = 'en';
      expect(A.t('unknownKey')).toBe('unknownKey');
    });

    it('returns key when key is missing in both en and fi', () => {
      A.lang = 'en';
      expect(A.t('nonexistentKey')).toBe('nonexistentKey');
      A.lang = 'fi';
      expect(A.t('nonexistentKey')).toBe('nonexistentKey');
    });
  });

  describe('key parity', () => {
    it('fi has same top-level keys as en', () => {
      const enKeys = Object.keys(A.i18n.en).sort();
      const fiKeys = Object.keys(A.i18n.fi).sort();
      expect(fiKeys).toEqual(enKeys);
    });

    it('en has same top-level keys as fi', () => {
      const enKeys = Object.keys(A.i18n.en).sort();
      const fiKeys = Object.keys(A.i18n.fi).sort();
      expect(enKeys).toEqual(fiKeys);
    });
  });
});
