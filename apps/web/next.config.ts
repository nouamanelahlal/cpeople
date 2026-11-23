import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them itself.
  transpilePackages: ['@cpeople/shared'],
  // Fail the production build on a type error: payroll is not a place for
  // "it compiles anyway".
  typescript: { ignoreBuildErrors: false },
  // The development overlay sits on top of the page, which puts it in every
  // screenshot the end-to-end suite takes. It tells us nothing the terminal does
  // not.
  devIndicators: false,
};

export default nextConfig;
