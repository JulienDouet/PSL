'use client';

import { DashboardRefreshProvider } from '@/lib/dashboard-context';
import { ReactNode } from 'react';

export function DashboardWrapper({ children }: { children: ReactNode }) {
  return (
    <DashboardRefreshProvider>
      {children}
    </DashboardRefreshProvider>
  );
}
