import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import te from '../locales/te.json';
import { storage, STORAGE_KEYS } from '../lib/storage.js';

export const LANGUAGES = ['en', 'te'];

function initialLanguage() {
  const saved = storage.get(STORAGE_KEYS.LANGUAGE);
  return LANGUAGES.includes(saved) ? saved : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, te: { translation: te } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes output
  returnNull: false,
});

function applyDocumentLanguage(lng) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
}
applyDocumentLanguage(i18n.language);
i18n.on('languageChanged', (lng) => {
  storage.set(STORAGE_KEYS.LANGUAGE, lng);
  applyDocumentLanguage(lng);
});

export default i18n;
