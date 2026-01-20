import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/notification.dart';

/// Notification service for managing notifications
class NotificationService {
  final ApiClient _apiClient = ApiClient();

  /// Get notifications with unread count
  Future<ApiResponse<NotificationsResult>> getNotifications({
    int limit = 20,
  }) async {
    try {
      final response = await _apiClient.dio.get(
        '/api/notifications',
        queryParameters: {'limit': limit},
      );

      if (response.statusCode == 200) {
        final notificationsData = response.data['notifications'] as List? ?? [];
        final notifications = notificationsData
            .map((json) => AppNotification.fromJson(json))
            .toList();
        final unreadCount = response.data['unreadCount'] ?? 0;

        return ApiResponse.success(NotificationsResult(
          notifications: notifications,
          unreadCount: unreadCount,
        ));
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load notifications',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred: $e');
    }
  }

  /// Mark a single notification as read
  Future<ApiResponse<bool>> markAsRead(String notificationId) async {
    try {
      final response = await _apiClient.dio.put(
        '/api/notifications/$notificationId/read',
      );

      if (response.statusCode == 200) {
        return ApiResponse.success(true);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to mark notification as read',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Mark all notifications as read
  Future<ApiResponse<bool>> markAllAsRead() async {
    try {
      final response = await _apiClient.dio.put('/api/notifications/mark-all-read');

      if (response.statusCode == 200) {
        return ApiResponse.success(true);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to mark all notifications as read',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Get notification preferences
  Future<ApiResponse<NotificationPreferences>> getPreferences() async {
    try {
      final response = await _apiClient.dio.get('/api/user/notification-preferences');

      if (response.statusCode == 200) {
        final prefsData = response.data['preferences'] ?? {};
        final preferences = NotificationPreferences.fromJson(prefsData);
        return ApiResponse.success(preferences);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load preferences',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Update notification preferences
  Future<ApiResponse<bool>> updatePreferences(NotificationPreferences preferences) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/user/notification-preferences',
        data: {'preferences': preferences.toJson()},
      );

      if (response.statusCode == 200) {
        return ApiResponse.success(true);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to update preferences',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }
}

/// Result container for notifications with unread count
class NotificationsResult {
  final List<AppNotification> notifications;
  final int unreadCount;

  NotificationsResult({
    required this.notifications,
    required this.unreadCount,
  });

  /// Get unread notifications only
  List<AppNotification> get unreadNotifications =>
      notifications.where((n) => n.isUnread).toList();

  /// Group notifications by date
  Map<String, List<AppNotification>> get groupedByDate {
    final grouped = <String, List<AppNotification>>{};
    for (final notification in notifications) {
      final group = notification.dateGroup;
      grouped.putIfAbsent(group, () => []);
      grouped[group]!.add(notification);
    }
    return grouped;
  }
}
