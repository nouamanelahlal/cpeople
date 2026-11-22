'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Tells the server which timezone the reader is in, once.
 *
 * "Good morning" has to be true where the person is, and only the browser knows
 * that. The server starts from the company's own timezone — right for nearly
 * everyone on a Morocco payroll — and this corrects it when it is not, writing the
 * answer into a cookie so the next page is right from the first paint.
 */
export function TimeZoneSync({ assumed }: { assumed: string }): null {
  const router = useRouter();

  useEffect(() => {
    const mine = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!mine || mine === assumed) {
      return;
    }

    document.cookie = `cpeople_tz=${encodeURIComponent(mine)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }, [assumed, router]);

  return null;
}
