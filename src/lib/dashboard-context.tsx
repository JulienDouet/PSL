'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Type pour l'état d'expansion de la queue
type QueueExpansionMode = 'idle' | 'searching' | 'countdown' | 'found' | 'lobby';

interface DashboardContextType {
  // Refresh du dashboard
  refreshKey: number;
  triggerRefresh: () => void;
  
  // État d'expansion de la queue (pour masquer les autres éléments)
  queueMode: QueueExpansionMode;
  setQueueMode: (mode: QueueExpansionMode) => void;
  isQueueExpanded: boolean; // True si countdown, found, ou lobby
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [queueMode, setQueueMode] = useState<QueueExpansionMode>('idle');

  const triggerRefresh = useCallback(() => {
    console.log('🔄 [Dashboard] Triggering refresh...');
    setRefreshKey(prev => prev + 1);
  }, []);

  // La carte est "expanded" quand on est dans un état actif (countdown+)
  const isQueueExpanded = ['countdown', 'found', 'lobby'].includes(queueMode);

  return (
    <DashboardContext.Provider value={{ 
      refreshKey, 
      triggerRefresh, 
      queueMode, 
      setQueueMode,
      isQueueExpanded 
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardRefresh() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardRefresh must be used within DashboardRefreshProvider');
  }
  return context;
}
