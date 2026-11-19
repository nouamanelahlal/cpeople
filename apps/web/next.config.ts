import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fail the production build on a type error: payroll is not a place for
  // "it compiles anyway".
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
