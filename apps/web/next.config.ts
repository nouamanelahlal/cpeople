import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them itself.
  transpilePackages: ['@cpeople/shared'],
  // Fail the production build on a type error: payroll is not a place for
  // "it compiles anyway".
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
