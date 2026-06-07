import type { NextConfig } from 'next';
import withSerwist from '@serwist/next';

const withSerwistConfig = withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Disable in development to avoid caching confusion during local work
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  // Allow phones on the local network to reach the dev server (HMR).
  // Only applies in development — ignored by Vercel in production.
  allowedDevOrigins: ['192.168.1.237'],
};

export default withSerwistConfig(nextConfig);
