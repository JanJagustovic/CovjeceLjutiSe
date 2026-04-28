import { createContext, useContext, useState } from 'react';
import hr from '../i18n/hr';
import en from '../i18n/en';

const strings = { hr, en };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'hr');

  function t(key) {
    return strings[lang]?.[key] ?? strings.en[key] ?? key;
  }

  function setLanguage(l) {
    setLang(l);
    localStorage.setItem('lang', l);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}