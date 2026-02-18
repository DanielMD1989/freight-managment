import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Settings keys
class SettingsKeys {
  static const String locale = 'app_locale';
  static const String themeMode = 'theme_mode';
  static const String pushNotifications = 'push_notifications';
  static const String gpsTracking = 'gps_tracking';
}

/// App settings state
class AppSettings {
  final Locale locale;
  final ThemeMode themeMode;
  final bool pushNotificationsEnabled;
  final bool gpsTrackingEnabled;

  const AppSettings({
    this.locale = const Locale('en'),
    this.themeMode = ThemeMode.light,
    this.pushNotificationsEnabled = true,
    this.gpsTrackingEnabled = true,
  });

  AppSettings copyWith({
    Locale? locale,
    ThemeMode? themeMode,
    bool? pushNotificationsEnabled,
    bool? gpsTrackingEnabled,
  }) {
    return AppSettings(
      locale: locale ?? this.locale,
      themeMode: themeMode ?? this.themeMode,
      pushNotificationsEnabled: pushNotificationsEnabled ?? this.pushNotificationsEnabled,
      gpsTrackingEnabled: gpsTrackingEnabled ?? this.gpsTrackingEnabled,
    );
  }

  String get languageDisplayName {
    switch (locale.languageCode) {
      case 'am':
        return 'አማርኛ (Amharic)';
      case 'en':
      default:
        return 'English';
    }
  }

  String get themeModeDisplayName {
    switch (themeMode) {
      case ThemeMode.dark:
        return 'Dark';
      case ThemeMode.light:
        return 'Light';
      case ThemeMode.system:
        return 'System';
    }
  }
}

/// Settings notifier
class SettingsNotifier extends StateNotifier<AppSettings> {
  SharedPreferences? _prefs;

  SettingsNotifier() : super(const AppSettings()) {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    _prefs = await SharedPreferences.getInstance();

    // Load locale
    final localeCode = _prefs?.getString(SettingsKeys.locale) ?? 'en';
    final locale = Locale(localeCode);

    // Load theme mode
    final themeModeIndex = _prefs?.getInt(SettingsKeys.themeMode) ?? 0;
    final themeMode = ThemeMode.values[themeModeIndex.clamp(0, ThemeMode.values.length - 1)];

    // Load notification settings
    final pushNotifications = _prefs?.getBool(SettingsKeys.pushNotifications) ?? true;
    final gpsTracking = _prefs?.getBool(SettingsKeys.gpsTracking) ?? true;

    state = AppSettings(
      locale: locale,
      themeMode: themeMode,
      pushNotificationsEnabled: pushNotifications,
      gpsTrackingEnabled: gpsTracking,
    );
  }

  Future<void> setLocale(Locale locale) async {
    await _prefs?.setString(SettingsKeys.locale, locale.languageCode);
    state = state.copyWith(locale: locale);
  }

  Future<void> setThemeMode(ThemeMode themeMode) async {
    await _prefs?.setInt(SettingsKeys.themeMode, themeMode.index);
    state = state.copyWith(themeMode: themeMode);
  }

  Future<void> setPushNotifications(bool enabled) async {
    await _prefs?.setBool(SettingsKeys.pushNotifications, enabled);
    state = state.copyWith(pushNotificationsEnabled: enabled);
  }

  Future<void> setGpsTracking(bool enabled) async {
    await _prefs?.setBool(SettingsKeys.gpsTracking, enabled);
    state = state.copyWith(gpsTrackingEnabled: enabled);
  }

  Future<void> toggleDarkMode() async {
    final newMode = state.themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    await setThemeMode(newMode);
  }
}

/// Settings provider
final settingsProvider = StateNotifierProvider<SettingsNotifier, AppSettings>((ref) {
  return SettingsNotifier();
});

/// Convenience provider for current locale
final localeProvider = Provider<Locale>((ref) {
  return ref.watch(settingsProvider).locale;
});

/// Convenience provider for theme mode
final themeModeProvider = Provider<ThemeMode>((ref) {
  return ref.watch(settingsProvider).themeMode;
});
