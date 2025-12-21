'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fr } from '../locales/fr';
import { en } from '../locales/en';

type Language = 'fr' | 'en';
type Dictionary = typeof fr;

// Utilitaire pour accéder aux nested properties via string "common.loading"
// Note: Pour une sécurité de typage stricte, c'est un peu complexe, on va rester simple pour l'instant.
// On expose directement le dictionnaire entier typé.

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Dictionary;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('fr');

  useEffect(() => {
    // Restaurer la langue sauvegardée
    const saved = localStorage.getItem('psl-lang') as Language;
    if (saved && (saved === 'fr' || saved === 'en')) {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('psl-lang', lang);
  };

  const t = language === 'fr' ? fr : en;

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
