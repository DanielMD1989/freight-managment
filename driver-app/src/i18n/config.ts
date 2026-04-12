/**
 * i18n Configuration - i18next setup
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import en from "./en.json";
import am from "./am.json";

const resources = {
  en: { translation: en },
  am: { translation: am },
};

// Get device locale, default to 'en'
const deviceLocale = Localization.getLocales()?.[0]?.languageCode ?? "en";
const supportedLocale = deviceLocale === "am" ? "am" : "en";

i18n.use(initReactI18next).init({
  resources,
  lng: supportedLocale,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes
  },
  compatibilityJSON: "v4",
});

export default i18n;
