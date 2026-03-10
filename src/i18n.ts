import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './translations';
import { default as LanguageDetector } from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // lng: 'fr', // Remove hardcoded language to allow detection
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    // Détecter la langue
    detection: {
      order: ['queryString', 'cookie', 'localStorage', 'navigator'],
      caches: ['localStorage'], // Stocker la préférence de langue
    }
  });

export default i18n;
