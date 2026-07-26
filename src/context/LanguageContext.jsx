import { createContext, useContext } from "react";

export const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const t = (key) => key;
  return (
    <LanguageContext.Provider value={{ lang: "en", toggleLang: () => {}, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
