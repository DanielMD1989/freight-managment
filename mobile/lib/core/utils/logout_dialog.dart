import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../l10n/app_localizations.dart';
import '../providers/auth_provider.dart';
import '../services/push_notification_service.dart';

/// Shared logout confirmation dialog.
/// Call from any screen that needs a logout button.
void showLogoutDialog(BuildContext context, WidgetRef ref) {
  final l10n = AppLocalizations.of(context)!;
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(l10n.logoutConfirmTitle),
      content: Text(l10n.logoutConfirmMessage),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l10n.cancel),
        ),
        TextButton(
          onPressed: () async {
            Navigator.pop(context);
            await PushNotificationService().unregisterToken();
            await ref.read(authStateProvider.notifier).logout();
            if (context.mounted) {
              context.go('/login');
            }
          },
          child: Text(l10n.logout, style: const TextStyle(color: Colors.red)),
        ),
      ],
    ),
  );
}
