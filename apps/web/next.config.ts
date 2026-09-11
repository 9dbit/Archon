import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@archon/domain', '@archon/engine-adapters']
};

export default nextConfig;
