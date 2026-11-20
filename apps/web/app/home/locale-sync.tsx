'use client';

import { useEffect } from 'react';
import type { Locale } from '@cpeople/shared';

/**
 * Writes the language Keycloak returned into the cookie the public pages read, so
 * signing out leaves the visitor on the language they actually chose (M23).
 */
export function LocaleSync({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.cookie = `cpeople_locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [locale]);

  return null;
}
