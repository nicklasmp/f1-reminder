'use client';

import { SerwistProvider } from '@serwist/next/react';

export function AppSerwistProvider({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      reloadOnOnline
      disable={process.env.NODE_ENV === 'development'}
    >
      {children}
    </SerwistProvider>
  );
}
