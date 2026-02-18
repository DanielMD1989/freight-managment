/**
 * Tests for settings Zustand store
 */
import { useSettingsStore } from "../../src/stores/settings";

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
}));

describe("Settings Store", () => {
  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    // Reset store
    useSettingsStore.setState({
      locale: "en",
      theme: "light",
      pushEnabled: true,
      gpsEnabled: true,
      onboardingCompleted: false,
      isLoaded: false,
    });
  });

  it("should have correct initial state", () => {
    const state = useSettingsStore.getState();
    expect(state.locale).toBe("en");
    expect(state.theme).toBe("light");
    expect(state.pushEnabled).toBe(true);
    expect(state.gpsEnabled).toBe(true);
    expect(state.onboardingCompleted).toBe(false);
    expect(state.isLoaded).toBe(false);
  });

  it("should update locale", async () => {
    await useSettingsStore.getState().setLocale("am");
    expect(useSettingsStore.getState().locale).toBe("am");
  });

  it("should update theme", async () => {
    await useSettingsStore.getState().setTheme("dark");
    expect(useSettingsStore.getState().theme).toBe("dark");
  });

  it("should toggle push notifications", async () => {
    await useSettingsStore.getState().setPushEnabled(false);
    expect(useSettingsStore.getState().pushEnabled).toBe(false);

    await useSettingsStore.getState().setPushEnabled(true);
    expect(useSettingsStore.getState().pushEnabled).toBe(true);
  });

  it("should toggle GPS tracking", async () => {
    await useSettingsStore.getState().setGpsEnabled(false);
    expect(useSettingsStore.getState().gpsEnabled).toBe(false);
  });

  it("should mark onboarding as completed", async () => {
    await useSettingsStore.getState().setOnboardingCompleted();
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);
  });

  it("should persist settings to AsyncStorage", async () => {
    await useSettingsStore.getState().setLocale("am");

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require("@react-native-async-storage/async-storage");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "app_settings",
      expect.any(String)
    );

    // Verify the persisted data contains locale
    const persisted = JSON.parse(mockStorage["app_settings"]);
    expect(persisted.locale).toBe("am");
  });

  it("should load settings from AsyncStorage", async () => {
    // Pre-populate storage
    mockStorage["app_settings"] = JSON.stringify({
      locale: "am",
      theme: "dark",
      pushEnabled: false,
      gpsEnabled: false,
      onboardingCompleted: true,
    });

    await useSettingsStore.getState().loadSettings();

    const state = useSettingsStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.locale).toBe("am");
    expect(state.theme).toBe("dark");
    expect(state.pushEnabled).toBe(false);
    expect(state.gpsEnabled).toBe(false);
    expect(state.onboardingCompleted).toBe(true);
  });

  it("should set isLoaded even with empty storage", async () => {
    await useSettingsStore.getState().loadSettings();
    expect(useSettingsStore.getState().isLoaded).toBe(true);
    // Should keep default values
    expect(useSettingsStore.getState().locale).toBe("en");
  });
});
