/**
 * Settings Store - Zustand with AsyncStorage persistence
 * Stores user preferences: locale, theme, push/GPS toggles
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SettingsState {
  locale: string;
  theme: "light" | "dark" | "system";
  pushEnabled: boolean;
  gpsEnabled: boolean;
  onboardingCompleted: boolean;
  isLoaded: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  setLocale: (locale: string) => Promise<void>;
  setTheme: (theme: "light" | "dark" | "system") => Promise<void>;
  setPushEnabled: (enabled: boolean) => Promise<void>;
  setGpsEnabled: (enabled: boolean) => Promise<void>;
  setOnboardingCompleted: () => Promise<void>;
}

const SETTINGS_KEY = "app_settings";

export const useSettingsStore = create<SettingsState>((set, get) => ({
  locale: "en",
  theme: "light",
  pushEnabled: true,
  gpsEnabled: true,
  onboardingCompleted: false,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({ ...parsed, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  setLocale: async (locale: string) => {
    set({ locale });
    await persistSettings(get());
  },

  setTheme: async (theme: "light" | "dark" | "system") => {
    set({ theme });
    await persistSettings(get());
  },

  setPushEnabled: async (enabled: boolean) => {
    set({ pushEnabled: enabled });
    await persistSettings(get());
  },

  setGpsEnabled: async (enabled: boolean) => {
    set({ gpsEnabled: enabled });
    await persistSettings(get());
  },

  setOnboardingCompleted: async () => {
    set({ onboardingCompleted: true });
    await persistSettings(get());
  },
}));

async function persistSettings(state: SettingsState) {
  try {
    const data = {
      locale: state.locale,
      theme: state.theme,
      pushEnabled: state.pushEnabled,
      gpsEnabled: state.gpsEnabled,
      onboardingCompleted: state.onboardingCompleted,
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch {
    // Silently fail - settings persistence is best-effort
  }
}
