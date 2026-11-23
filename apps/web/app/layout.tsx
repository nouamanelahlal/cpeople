import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Montserrat } from 'next/font/google';
import type { ReactNode } from 'react';
import { WELCOME_COOKIE } from '../lib/welcome';
import './globals.css';

// Montserrat is the brand typeface: 300 for display figures and page titles,
// 400 for body, 600 for labels and buttons (CLAUDE.md rule 10).
const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '600'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: { default: 'CPeople', template: '%s · CPeople' },
  description: 'HR and payroll by ConSAP.',
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0e7bb0',
};

// TODO(M23): English and French. lang comes from the locale segment once the
// next-intl routing lands; Arabic with RTL is after the MVP, which is why the
// styles use logical properties only.
export default async function RootLayout({ children }: { children: ReactNode }) {
  // A welcome animation is about to play, so the page is locked from the first
  // paint rather than from whenever the script gets there: the overlay is drawn by
  // the server, and for the moments before hydration the scaled dashboard behind it
  // would otherwise put scrollbars on a screen nobody can reach. The overlay takes
  // this off again when it leaves.
  const store = await cookies();
  const welcoming = store.get(WELCOME_COOKIE)?.value === '1';

  return (
    <html
      lang="en"
      className={montserrat.variable}
      data-welcome={welcoming ? 'playing' : undefined}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
