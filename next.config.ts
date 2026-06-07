import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow phones on the local network to reach the dev server (HMR).
  // Only applies in development — ignored by Vercel in production.
  allowedDevOrigins: ['192.168.1.237'],
};

export default nextConfig;
