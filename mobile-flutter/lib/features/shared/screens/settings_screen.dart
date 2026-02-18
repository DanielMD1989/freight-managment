import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../app.dart';
import '../../../core/utils/logout_dialog.dart';
import '../../../core/providers/settings_provider.dart';
import '../../../core/services/push_notification_service.dart';

/// Settings Screen
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  String _appVersion = '';

  @override
  void initState() {
    super.initState();
    _loadAppVersion();
  }

  Future<void> _loadAppVersion() async {
    final packageInfo = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() {
        _appVersion = '${packageInfo.version} (${packageInfo.buildNumber})';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final settingsNotifier = ref.read(settingsProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: ListView(
        children: [
          // Language Section
          const _SectionHeader(title: 'Language'),
          _SettingsTile(
            icon: Icons.language,
            title: 'Language',
            subtitle: settings.languageDisplayName,
            onTap: () => _showLanguageDialog(context, settingsNotifier, settings),
          ),

          const SizedBox(height: 16),

          // Appearance Section
          const _SectionHeader(title: 'Appearance'),
          _SettingsTile(
            icon: Icons.palette,
            title: 'Theme',
            subtitle: settings.themeModeDisplayName,
            onTap: () => _showThemeDialog(context, settingsNotifier, settings),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.dark_mode),
            title: const Text('Dark Mode'),
            subtitle: const Text('Enable dark theme'),
            value: settings.themeMode == ThemeMode.dark,
            onChanged: (value) {
              settingsNotifier.setThemeMode(value ? ThemeMode.dark : ThemeMode.light);
            },
          ),

          const SizedBox(height: 16),

          // Notifications Section (push notifications are mobile-only)
          if (!kIsWeb) ...[
            const _SectionHeader(title: 'Notifications'),
            SwitchListTile(
              secondary: const Icon(Icons.notifications),
              title: const Text('Push Notifications'),
              subtitle: const Text('Receive alerts for loads, trips, and payments'),
              value: settings.pushNotificationsEnabled,
              onChanged: (value) async {
                await settingsNotifier.setPushNotifications(value);
                if (value) {
                  // Re-initialize push notifications if enabled
                  await PushNotificationService().initialize();
                }
              },
            ),
          ],

          const SizedBox(height: 16),

          // Location Section (GPS tracking is mobile-only)
          if (!kIsWeb) ...[
            const _SectionHeader(title: 'Location'),
            SwitchListTile(
              secondary: const Icon(Icons.location_on),
              title: const Text('GPS Tracking'),
              subtitle: const Text('Enable real-time location tracking during trips'),
              value: settings.gpsTrackingEnabled,
              onChanged: (value) {
                settingsNotifier.setGpsTracking(value);
              },
            ),
          ],

          const SizedBox(height: 16),

          // Account Section
          const _SectionHeader(title: 'Account'),
          _SettingsTile(
            icon: Icons.person,
            title: 'Edit Profile',
            subtitle: 'Update your personal information',
            onTap: () => context.push('/profile'),
          ),
          _SettingsTile(
            icon: Icons.lock,
            title: 'Change Password',
            subtitle: 'Update your password',
            onTap: () => _showComingSoon(context),
          ),
          _SettingsTile(
            icon: Icons.notifications_active,
            title: 'Notification Preferences',
            subtitle: 'Manage notification types',
            onTap: () => context.push('/notifications'),
          ),

          const SizedBox(height: 16),

          // About Section
          const _SectionHeader(title: 'About'),
          _SettingsTile(
            icon: Icons.info,
            title: 'Version',
            subtitle: _appVersion.isNotEmpty ? _appVersion : 'Loading...',
            onTap: () {},
          ),
          _SettingsTile(
            icon: Icons.description,
            title: 'Terms of Service',
            subtitle: 'Read our terms and conditions',
            onTap: () => _launchUrl('https://freightflow.app/terms'),
          ),
          _SettingsTile(
            icon: Icons.privacy_tip,
            title: 'Privacy Policy',
            subtitle: 'Read our privacy policy',
            onTap: () => _launchUrl('https://freightflow.app/privacy'),
          ),
          _SettingsTile(
            icon: Icons.help,
            title: 'Help & Support',
            subtitle: 'Get help with the app',
            onTap: () => _launchUrl('https://freightflow.app/support'),
          ),

          const SizedBox(height: 24),

          // Logout Button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              onPressed: () => showLogoutDialog(context, ref),
              icon: const Icon(Icons.logout, color: AppColors.error),
              label: const Text('Logout', style: TextStyle(color: AppColors.error)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.error),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  void _showLanguageDialog(
    BuildContext context,
    SettingsNotifier notifier,
    AppSettings settings,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Select Language'),
        content: RadioGroup<Locale>(
          groupValue: settings.locale,
          onChanged: (value) {
            if (value != null) {
              notifier.setLocale(value);
              Navigator.pop(context);
            }
          },
          child: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<Locale>(
                title: Text('English'),
                value: Locale('en'),
              ),
              RadioListTile<Locale>(
                title: Text('አማርኛ (Amharic)'),
                value: Locale('am'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }

  void _showThemeDialog(
    BuildContext context,
    SettingsNotifier notifier,
    AppSettings settings,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Select Theme'),
        content: RadioGroup<ThemeMode>(
          groupValue: settings.themeMode,
          onChanged: (value) {
            if (value != null) {
              notifier.setThemeMode(value);
              Navigator.pop(context);
            }
          },
          child: const Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              RadioListTile<ThemeMode>(
                title: Text('Light'),
                value: ThemeMode.light,
              ),
              RadioListTile<ThemeMode>(
                title: Text('Dark'),
                value: ThemeMode.dark,
              ),
              RadioListTile<ThemeMode>(
                title: Text('System'),
                value: ThemeMode.system,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }


  void _showComingSoon(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('This feature is coming soon!'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

/// Section header
class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

/// Settings tile
class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
