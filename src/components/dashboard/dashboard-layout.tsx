'use client';

import { ReactNode } from 'react';
import { useDashboardRefresh } from '@/lib/dashboard-context';

interface DashboardLayoutProps {
  leftColumn: ReactNode;
  rightColumn: ReactNode;
  playCard: ReactNode;
}

export function DashboardLayout({ leftColumn, rightColumn, playCard }: DashboardLayoutProps) {
  const { isQueueExpanded, queueMode } = useDashboardRefresh();

  // Classes d'animation pour les éléments qui vont disparaître
  const fadeOutClasses = isQueueExpanded 
    ? 'opacity-0 scale-95 pointer-events-none max-h-0 overflow-hidden' 
    : 'opacity-100 scale-100 max-h-[2000px]';

  // Classes pour la PlayCard qui s'expand
  const playCardClasses = isQueueExpanded
    ? 'lg:col-span-3 relative z-10'
    : '';

  // Animation "found" spéciale
  const foundAnimation = queueMode === 'found' 
    ? 'animate-pulse ring-4 ring-primary/50 shadow-2xl shadow-primary/30' 
    : '';

  return (
    <div className="grid lg:grid-cols-3 gap-6 relative">
      {/* Left Column - Disparait quand expanded */}
      <div 
        className={`lg:col-span-2 space-y-6 transition-all duration-500 ease-out ${fadeOutClasses}`}
        style={{ transitionProperty: 'opacity, transform, max-height' }}
      >
        {leftColumn}
      </div>

      {/* Right Column - PlayCard s'expand, le reste disparait */}
      <div className={`space-y-6 transition-all duration-500 ease-out ${playCardClasses}`}>
        {/* PlayCard avec animations spéciales */}
        <div className={`transition-all duration-500 ease-out ${foundAnimation}`}>
          {playCard}
        </div>

        {/* Discord & Shortcuts - Disparaissent */}
        <div 
          className={`space-y-6 transition-all duration-500 ease-out ${fadeOutClasses}`}
          style={{ transitionProperty: 'opacity, transform, max-height' }}
        >
          {rightColumn}
        </div>
      </div>
    </div>
  );
}
