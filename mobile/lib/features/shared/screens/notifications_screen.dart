import 'package:flutter/material.dart';
import '../../../app.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Notifications'),
          actions: [
            TextButton(
              onPressed: () {
                // Mark all as read
              },
              child: const Text('Mark all read'),
            ),
          ],
          bottom: const TabBar(
            tabs: [
              Tab(text: 'All'),
              Tab(text: 'Unread'),
              Tab(text: 'Settings'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _AllNotificationsTab(),
            _UnreadNotificationsTab(),
            _NotificationSettingsTab(),
          ],
        ),
      ),
    );
  }
}

class _AllNotificationsTab extends StatelessWidget {
  const _AllNotificationsTab();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _DateHeader(date: 'Today'),
        _NotificationTile(
          icon: Icons.local_shipping,
          iconColor: AppColors.primary,
          title: 'Load picked up',
          message: 'Your load LOAD-1001 has been picked up from Addis Ababa',
          time: '10 min ago',
          isUnread: true,
        ),
        _NotificationTile(
          icon: Icons.check_circle,
          iconColor: AppColors.success,
          title: 'Request approved',
          message: 'ABC Transport has approved your truck request',
          time: '1 hour ago',
          isUnread: true,
        ),
        _NotificationTile(
          icon: Icons.gps_fixed,
          iconColor: AppColors.warning,
          title: 'GPS signal lost',
          message: 'Truck AA-12345 GPS signal has been lost',
          time: '2 hours ago',
          isUnread: false,
        ),
        const SizedBox(height: 8),
        _DateHeader(date: 'Yesterday'),
        _NotificationTile(
          icon: Icons.attach_money,
          iconColor: AppColors.secondary,
          title: 'Payment received',
          message: 'Payment of 45,000 ETB received for LOAD-999',
          time: 'Yesterday',
          isUnread: false,
        ),
        _NotificationTile(
          icon: Icons.star,
          iconColor: Colors.amber,
          title: 'New rating',
          message: 'You received a 5-star rating from XYZ Shipper',
          time: 'Yesterday',
          isUnread: false,
        ),
        _NotificationTile(
          icon: Icons.inventory_2,
          iconColor: AppColors.primary,
          title: 'New load available',
          message: 'New load matching your preferences: Addis to Mekelle',
          time: 'Yesterday',
          isUnread: false,
        ),
        const SizedBox(height: 8),
        _DateHeader(date: 'This Week'),
        _NotificationTile(
          icon: Icons.description,
          iconColor: AppColors.success,
          title: 'POD uploaded',
          message: 'Proof of delivery uploaded for LOAD-998',
          time: '3 days ago',
          isUnread: false,
        ),
        _NotificationTile(
          icon: Icons.warning,
          iconColor: AppColors.error,
          title: 'Exception reported',
          message: 'A delay exception was reported for LOAD-997',
          time: '4 days ago',
          isUnread: false,
        ),
      ],
    );
  }
}

class _UnreadNotificationsTab extends StatelessWidget {
  const _UnreadNotificationsTab();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _NotificationTile(
          icon: Icons.local_shipping,
          iconColor: AppColors.primary,
          title: 'Load picked up',
          message: 'Your load LOAD-1001 has been picked up from Addis Ababa',
          time: '10 min ago',
          isUnread: true,
        ),
        _NotificationTile(
          icon: Icons.check_circle,
          iconColor: AppColors.success,
          title: 'Request approved',
          message: 'ABC Transport has approved your truck request',
          time: '1 hour ago',
          isUnread: true,
        ),
      ],
    );
  }
}

class _NotificationSettingsTab extends StatelessWidget {
  const _NotificationSettingsTab();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Column(
            children: [
              _SettingTile(
                title: 'Push Notifications',
                subtitle: 'Receive notifications on your device',
                value: true,
              ),
              const Divider(height: 1),
              _SettingTile(
                title: 'Email Notifications',
                subtitle: 'Receive email for important updates',
                value: true,
              ),
              const Divider(height: 1),
              _SettingTile(
                title: 'SMS Notifications',
                subtitle: 'Receive SMS for urgent matters',
                value: false,
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
                value: true,
              ),
              const Divider(height: 1),
              _SettingTile(
                title: 'New Loads',
                subtitle: 'Loads matching your preferences',
                value: true,
              ),
              const Divider(height: 1),
              _SettingTile(
                title: 'Truck Requests',
                subtitle: 'New requests for your trucks',
                value: true,
              ),
              const Divider(height: 1),
              _SettingTile(
                title: 'GPS Alerts',
                subtitle: 'Signal lost, geofence alerts',
                value: true,
              ),
              const Divider(height: 1),
              _SettingTile(
                title: 'Payments',
                subtitle: 'Payment received, pending',
                value: true,
              ),
              const Divider(height: 1),
              _SettingTile(
                title: 'Ratings & Reviews',
                subtitle: 'New ratings and feedback',
                value: false,
              ),
              const Divider(height: 1),
              _SettingTile(
                title: 'Marketing',
                subtitle: 'Promotions and updates',
                value: false,
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
                value: false,
              ),
              const Divider(height: 1),
              ListTile(
                title: const Text('Start Time'),
                trailing: Text(
                  '10:00 PM',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                onTap: () {},
              ),
              const Divider(height: 1),
              ListTile(
                title: const Text('End Time'),
                trailing: Text(
                  '7:00 AM',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                onTap: () {},
              ),
            ],
          ),
        ),
      ],
    );
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
  final IconData icon;
  final Color iconColor;
  final String title;
  final String message;
  final String time;
  final bool isUnread;

  const _NotificationTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.message,
    required this.time,
    required this.isUnread,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: isUnread ? AppColors.primary.withOpacity(0.05) : null,
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: iconColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: iconColor, size: 24),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontWeight: isUnread ? FontWeight.bold : FontWeight.w600,
                ),
              ),
            ),
            if (isUnread)
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
              message,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              time,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ),
        isThreeLine: true,
        onTap: () {
          // Navigate to relevant screen
        },
      ),
    );
  }
}

class _SettingTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool value;

  const _SettingTile({
    required this.title,
    required this.subtitle,
    required this.value,
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
      onChanged: (newValue) {},
    );
  }
}
