import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import type { ReactNode } from 'react';
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
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={montserrat.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
