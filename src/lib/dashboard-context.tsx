'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface DashboardRefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
}

const DashboardRefreshContext = createContext<DashboardRefreshContextType | null>(null);

export function DashboardRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    console.log('🔄 [Dashboard] Triggering refresh...');
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <DashboardRefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </DashboardRefreshContext.Provider>
  );
}

export function useDashboardRefresh() {
  const context = useContext(DashboardRefreshContext);
  if (!context) {
    throw new Error('useDashboardRefresh must be used within DashboardRefreshProvider');
  }
  return context;
}
