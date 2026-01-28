import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app.dart';
import '../../../core/models/notification.dart';
import '../../../core/services/notification_service.dart';

/// Provider for notifications
final notificationsProvider = FutureProvider.autoDispose<NotificationsResult>((ref) async {
  final service = NotificationService();
  final result = await service.getNotifications(limit: 50);
  if (result.success && result.data != null) {
    return result.data!;
  }
  throw Exception(result.error ?? 'Failed to load notifications');
});

/// Provider for notification preferences
final notificationPreferencesProvider = FutureProvider.autoDispose<NotificationPreferences>((ref) async {
  final service = NotificationService();
  final result = await service.getPreferences();
  if (result.success && result.data != null) {
    return result.data!;
  }
  return NotificationPreferences(); // Default preferences
});

/// Provider for preferences state (for editing)
final preferencesStateProvider = StateProvider<NotificationPreferences?>((ref) => null);

/// Current tab filter
final notificationTabProvider = StateProvider<int>((ref) => 0);

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isMarkingAllRead = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      ref.read(notificationTabProvider.notifier).state = _tabController.index;
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _markAllAsRead() async {
    setState(() => _isMarkingAllRead = true);

    final service = NotificationService();
    final result = await service.markAllAsRead();

    setState(() => _isMarkingAllRead = false);

    if (result.success) {
      ref.invalidate(notificationsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('All notifications marked as read')),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.error ?? 'Failed to mark as read')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (_isMarkingAllRead)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            )
          else
            notificationsAsync.when(
              data: (data) => data.unreadCount > 0
                  ? TextButton(
                      onPressed: _markAllAsRead,
                      child: const Text('Mark all read'),
                    )
                  : const SizedBox.shrink(),
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            const Tab(text: 'All'),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Unread'),
                  notificationsAsync.when(
                    data: (data) => data.unreadCount > 0
                        ? Container(
                            margin: const EdgeInsets.only(left: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${data.unreadCount}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          )
                        : const SizedBox.shrink(),
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
            const Tab(text: 'Settings'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _AllNotificationsTab(onRefresh: () => ref.invalidate(notificationsProvider)),
          _UnreadNotificationsTab(onRefresh: () => ref.invalidate(notificationsProvider)),
          _NotificationSettingsTab(onRefresh: () => ref.invalidate(notificationPreferencesProvider)),
        ],
      ),
    );
  }
}

class _AllNotificationsTab extends ConsumerWidget {
  final VoidCallback onRefresh;

  const _AllNotificationsTab({required this.onRefresh});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return notificationsAsync.when(
      data: (data) {
        if (data.notifications.isEmpty) {
          return _EmptyState(
            icon: Icons.notifications_none,
            message: 'No notifications yet',
            onRefresh: onRefresh,
          );
        }

        final grouped = data.groupedByDate;
        final sortedGroups = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older']
            .where((g) => grouped.containsKey(g))
            .toList();

        return RefreshIndicator(
          onRefresh: () async => onRefresh(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: sortedGroups.fold<int>(
              0,
              (sum, group) => sum + 1 + grouped[group]!.length,
            ),
            itemBuilder: (context, index) {
              int currentIndex = 0;
              for (final group in sortedGroups) {
                if (index == currentIndex) {
                  return _DateHeader(date: group);
                }
                currentIndex++;

                final notifications = grouped[group]!;
                for (final notification in notifications) {
                  if (index == currentIndex) {
                    return _NotificationTile(
                      notification: notification,
                      onTap: () => _handleNotificationTap(context, ref, notification),
                    );
                  }
                  currentIndex++;
                }
              }
              return const SizedBox.shrink();
            },
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorState(
        message: error.toString(),
        onRetry: onRefresh,
      ),
    );
  }

  void _handleNotificationTap(BuildContext context, WidgetRef ref, AppNotification notification) async {
    // Mark as read if unread
    if (notification.isUnread) {
      final service = NotificationService();
      await service.markAsRead(notification.id);
      ref.invalidate(notificationsProvider);
    }

    // Navigate based on notification type/metadata
    // This would be expanded based on metadata content
  }
}

class _UnreadNotificationsTab extends ConsumerWidget {
  final VoidCallback onRefresh;

  const _UnreadNotificationsTab({required this.onRefresh});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return notificationsAsync.when(
      data: (data) {
        final unread = data.unreadNotifications;

        if (unread.isEmpty) {
          return _EmptyState(
            icon: Icons.done_all,
            message: 'All caught up!',
            subtitle: 'No unread notifications',
            onRefresh: onRefresh,
          );
        }

        return RefreshIndicator(
          onRefresh: () async => onRefresh(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: unread.length,
            itemBuilder: (context, index) {
              return _NotificationTile(
                notification: unread[index],
                onTap: () => _handleNotificationTap(context, ref, unread[index]),
              );
            },
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorState(
        message: error.toString(),
        onRetry: onRefresh,
      ),
    );
  }

  void _handleNotificationTap(BuildContext context, WidgetRef ref, AppNotification notification) async {
    final service = NotificationService();
    await service.markAsRead(notification.id);
    ref.invalidate(notificationsProvider);
  }
}

class _NotificationSettingsTab extends ConsumerStatefulWidget {
  final VoidCallback onRefresh;

  const _NotificationSettingsTab({required this.onRefresh});

  @override
  ConsumerState<_NotificationSettingsTab> createState() => _NotificationSettingsTabState();
}

class _NotificationSettingsTabState extends ConsumerState<_NotificationSettingsTab> {
  NotificationPreferences? _localPreferences;
  bool _isSaving = false;
  bool _hasChanges = false;

  @override
  Widget build(BuildContext context) {
    final preferencesAsync = ref.watch(notificationPreferencesProvider);

    return preferencesAsync.when(
      data: (preferences) {
        _localPreferences ??= preferences;
        final prefs = _localPreferences!;

        return Stack(
          children: [
            RefreshIndicator(
              onRefresh: () async {
                _localPreferences = null;
                _hasChanges = false;
                widget.onRefresh();
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Card(
                    child: Column(
                      children: [
                        _SettingTile(
                          title: 'Push Notifications',
                          subtitle: 'Receive notifications on your device',
                          value: prefs.pushEnabled,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(pushEnabled: v)),
                        ),
                        const Divider(height: 1),
                        _SettingTile(
                          title: 'Email Notifications',
                          subtitle: 'Receive email for important updates',
                          value: prefs.emailEnabled,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(emailEnabled: v)),
                        ),
                        const Divider(height: 1),
                        _SettingTile(
                          title: 'SMS Notifications',
                          subtitle: 'Receive SMS for urgent matters',
                          value: prefs.smsEnabled,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(smsEnabled: v)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Notification Types',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Card(
                    child: Column(
                      children: [
                        _SettingTile(
                          title: 'Load Updates',
                          subtitle: 'Status changes, pickup, delivery',
                          value: prefs.loadUpdates,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(loadUpdates: v)),
                        ),
                        const Divider(height: 1),
                        _SettingTile(
                          title: 'New Loads',
                          subtitle: 'Loads matching your preferences',
                          value: prefs.newLoads,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(newLoads: v)),
                        ),
                        const Divider(height: 1),
                        _SettingTile(
                          title: 'Truck Requests',
                          subtitle: 'New requests for your trucks',
                          value: prefs.truckRequests,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(truckRequests: v)),
                        ),
                        const Divider(height: 1),
                        _SettingTile(
                          title: 'GPS Alerts',
                          subtitle: 'Signal lost, geofence alerts',
                          value: prefs.gpsAlerts,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(gpsAlerts: v)),
                        ),
                        const Divider(height: 1),
                        _SettingTile(
                          title: 'Payments',
                          subtitle: 'Payment received, pending',
                          value: prefs.payments,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(payments: v)),
                        ),
                        const Divider(height: 1),
                        _SettingTile(
                          title: 'Ratings & Reviews',
                          subtitle: 'New ratings and feedback',
                          value: prefs.ratings,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(ratings: v)),
                        ),
                        const Divider(height: 1),
                        _SettingTile(
                          title: 'Marketing',
                          subtitle: 'Promotions and updates',
                          value: prefs.marketing,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(marketing: v)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Quiet Hours',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Card(
                    child: Column(
                      children: [
                        _SettingTile(
                          title: 'Enable Quiet Hours',
                          subtitle: 'Mute non-urgent notifications',
                          value: prefs.quietHoursEnabled,
                          onChanged: (v) => _updatePreference(() =>
                            _localPreferences = prefs.copyWith(quietHoursEnabled: v)),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          title: const Text('Start Time'),
                          trailing: Text(
                            prefs.quietHoursStart ?? '10:00 PM',
                            style: TextStyle(color: AppColors.textSecondary),
                          ),
                          onTap: prefs.quietHoursEnabled ? () => _selectTime(true) : null,
                          enabled: prefs.quietHoursEnabled,
                        ),
                        const Divider(height: 1),
                        ListTile(
                          title: const Text('End Time'),
                          trailing: Text(
                            prefs.quietHoursEnd ?? '7:00 AM',
                            style: TextStyle(color: AppColors.textSecondary),
                          ),
                          onTap: prefs.quietHoursEnabled ? () => _selectTime(false) : null,
                          enabled: prefs.quietHoursEnabled,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 80), // Space for save button
                ],
              ),
            ),
            if (_hasChanges)
              Positioned(
                left: 16,
                right: 16,
                bottom: 16,
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _savePreferences,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: _isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Save Changes'),
                ),
              ),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorState(
        message: error.toString(),
        onRetry: widget.onRefresh,
      ),
    );
  }

  void _updatePreference(VoidCallback update) {
    setState(() {
      update();
      _hasChanges = true;
    });
  }

  Future<void> _selectTime(bool isStart) async {
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );

    if (time != null) {
      final formatted = '${time.hourOfPeriod}:${time.minute.toString().padLeft(2, '0')} ${time.period == DayPeriod.am ? 'AM' : 'PM'}';
      _updatePreference(() {
        _localPreferences = isStart
            ? _localPreferences!.copyWith(quietHoursStart: formatted)
            : _localPreferences!.copyWith(quietHoursEnd: formatted);
      });
    }
  }

  Future<void> _savePreferences() async {
    if (_localPreferences == null) return;

    setState(() => _isSaving = true);

    final service = NotificationService();
    final result = await service.updatePreferences(_localPreferences!);

    setState(() => _isSaving = false);

    if (result.success) {
      setState(() => _hasChanges = false);
      ref.invalidate(notificationPreferencesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferences saved')),
        );
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.error ?? 'Failed to save preferences')),
        );
      }
    }
  }
}

class _DateHeader extends StatelessWidget {
  final String date;

  const _DateHeader({required this.date});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        date,
        style: TextStyle(
          color: AppColors.textSecondary,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final AppNotification notification;
  final VoidCallback onTap;

  const _NotificationTile({
    required this.notification,
    required this.onTap,
  });

  IconData get _icon {
    switch (notification.type) {
      case NotificationType.loadAssigned:
      case NotificationType.loadStatusChange:
        return Icons.local_shipping;
      case NotificationType.truckRequest:
      case NotificationType.truckRequestApproved:
      case NotificationType.truckRequestRejected:
        return Icons.send;
      case NotificationType.loadRequest:
      case NotificationType.loadRequestApproved:
      case NotificationType.loadRequestRejected:
        return Icons.inbox;
      case NotificationType.gpsOffline:
      case NotificationType.gpsOnline:
      case NotificationType.geofenceAlert:
        return Icons.gps_fixed;
      case NotificationType.podSubmitted:
        return Icons.description;
      case NotificationType.paymentReceived:
      case NotificationType.paymentPending:
        return Icons.attach_money;
      case NotificationType.userSuspended:
        return Icons.warning;
      case NotificationType.ratingReceived:
        return Icons.star;
      case NotificationType.exceptionReported:
        return Icons.error;
      case NotificationType.newLoadMatching:
        return Icons.inventory_2;
      case NotificationType.marketing:
        return Icons.campaign;
      case NotificationType.system:
      case NotificationType.unknown:
        return Icons.notifications;
    }
  }

  Color get _iconColor {
    switch (notification.type) {
      case NotificationType.truckRequestApproved:
      case NotificationType.loadRequestApproved:
      case NotificationType.podSubmitted:
        return AppColors.success;
      case NotificationType.truckRequestRejected:
      case NotificationType.loadRequestRejected:
      case NotificationType.exceptionReported:
      case NotificationType.userSuspended:
        return AppColors.error;
      case NotificationType.gpsOffline:
      case NotificationType.geofenceAlert:
        return AppColors.warning;
      case NotificationType.paymentReceived:
      case NotificationType.paymentPending:
        return AppColors.secondary;
      case NotificationType.ratingReceived:
        return Colors.amber;
      default:
        return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      color: notification.isUnread ? AppColors.primary.withValues(alpha: 0.05) : null,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: _iconColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(_icon, color: _iconColor, size: 24),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                notification.title,
                style: TextStyle(
                  fontWeight: notification.isUnread ? FontWeight.bold : FontWeight.w600,
                ),
              ),
            ),
            if (notification.isUnread)
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              notification.message,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              notification.timeAgo,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ),
        isThreeLine: true,
        onTap: onTap,
      ),
    );
  }
}

class _SettingTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SettingTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      title: Text(title),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          color: AppColors.textSecondary,
          fontSize: 13,
        ),
      ),
      value: value,
      onChanged: onChanged,
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String message;
  final String? subtitle;
  final VoidCallback onRefresh;

  const _EmptyState({
    required this.icon,
    required this.message,
    this.subtitle,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView(
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.6,
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    size: 64,
                    color: AppColors.textSecondary.withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    message,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 16,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      subtitle!,
                      style: TextStyle(
                        color: AppColors.textSecondary.withValues(alpha: 0.7),
                        fontSize: 14,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({
    required this.message,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 48,
              color: AppColors.error,
            ),
            const SizedBox(height: 16),
            Text(
              'Failed to load notifications',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
