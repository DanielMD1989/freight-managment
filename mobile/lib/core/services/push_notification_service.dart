import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show debugPrint, kIsWeb;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../api/api_client.dart';

/// Background message handler - must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  assert(() {
    debugPrint('[Push] Background message: ${message.messageId}');
    return true;
  }());
}

/// Push notification service for Firebase Cloud Messaging
class PushNotificationService {
  static PushNotificationService? _instance;

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final ApiClient _apiClient = ApiClient();

  StreamSubscription<RemoteMessage>? _foregroundSubscription;
  StreamSubscription<RemoteMessage>? _messageOpenedSubscription;

  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  /// Callback for when a notification is tapped
  void Function(Map<String, dynamic> data)? onNotificationTap;

  PushNotificationService._internal();

  factory PushNotificationService() {
    _instance ??= PushNotificationService._internal();
    return _instance!;
  }

  /// Initialize push notifications
  Future<bool> initialize() async {
    try {
      // Skip on web for now
      if (kIsWeb) {
        assert(() {
          debugPrint('[Push] Web platform - skipping Firebase init');
          return true;
        }());
        return false;
      }

      // Initialize Firebase
      await Firebase.initializeApp();

      // Set background message handler
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // Request permissions
      final settings = await _requestPermissions();
      if (settings.authorizationStatus != AuthorizationStatus.authorized &&
          settings.authorizationStatus != AuthorizationStatus.provisional) {
        assert(() {
          debugPrint('[Push] Notification permission denied');
          return true;
        }());
        return false;
      }

      // Initialize local notifications for foreground display
      await _initializeLocalNotifications();

      // Get FCM token
      _fcmToken = await _messaging.getToken();
      assert(() {
        debugPrint('[Push] FCM Token obtained');
        return true;
      }());

      // Register token with backend
      if (_fcmToken != null) {
        await _registerTokenWithBackend(_fcmToken!);
      }

      // Listen for token refresh
      _messaging.onTokenRefresh.listen(_onTokenRefresh);

      // Handle foreground messages
      _foregroundSubscription = FirebaseMessaging.onMessage.listen(_onForegroundMessage);

      // Handle message opened app
      _messageOpenedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(_onMessageOpenedApp);

      // Check for initial message (app opened from terminated state via notification)
      final initialMessage = await _messaging.getInitialMessage();
      if (initialMessage != null) {
        _handleNotificationTap(initialMessage.data);
      }

      assert(() {
        debugPrint('[Push] Push notification service initialized');
        return true;
      }());

      return true;
    } catch (e) {
      assert(() {
        debugPrint('[Push] Error initializing: $e');
        return true;
      }());
      return false;
    }
  }

  /// Request notification permissions
  Future<NotificationSettings> _requestPermissions() async {
    return await _messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );
  }

  /// Initialize local notifications for foreground display
  Future<void> _initializeLocalNotifications() async {
    // Android settings
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');

    // iOS settings
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onLocalNotificationTap,
    );

    // Create notification channel for Android
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        'freight_notifications',
        'Freight Notifications',
        description: 'Notifications for freight management',
        importance: Importance.high,
      );

      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  /// Handle token refresh
  Future<void> _onTokenRefresh(String token) async {
    _fcmToken = token;
    await _registerTokenWithBackend(token);
  }

  /// Register FCM token with backend
  Future<void> _registerTokenWithBackend(String token) async {
    try {
      await _apiClient.dio.post(
        '/api/user/fcm-token',
        data: {
          'token': token,
          'platform': Platform.isIOS ? 'ios' : 'android',
        },
      );
      assert(() {
        debugPrint('[Push] FCM token registered with backend');
        return true;
      }());
    } catch (e) {
      assert(() {
        debugPrint('[Push] Error registering FCM token: $e');
        return true;
      }());
    }
  }

  /// Handle foreground message
  void _onForegroundMessage(RemoteMessage message) {
    assert(() {
      debugPrint('[Push] Foreground message: ${message.notification?.title}');
      return true;
    }());

    // Show local notification
    _showLocalNotification(message);
  }

  /// Show local notification for foreground messages
  Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    const androidDetails = AndroidNotificationDetails(
      'freight_notifications',
      'Freight Notifications',
      channelDescription: 'Notifications for freight management',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      details,
      payload: jsonEncode(message.data),
    );
  }

  /// Handle message opened app (from background)
  void _onMessageOpenedApp(RemoteMessage message) {
    assert(() {
      debugPrint('[Push] Message opened app: ${message.notification?.title}');
      return true;
    }());
    _handleNotificationTap(message.data);
  }

  /// Handle local notification tap
  void _onLocalNotificationTap(NotificationResponse response) {
    if (response.payload != null) {
      try {
        final data = jsonDecode(response.payload!) as Map<String, dynamic>;
        _handleNotificationTap(data);
      } catch (e) {
        assert(() {
          debugPrint('[Push] Error parsing notification payload: $e');
          return true;
        }());
      }
    }
  }

  /// Handle notification tap
  void _handleNotificationTap(Map<String, dynamic> data) {
    onNotificationTap?.call(data);
  }

  /// Subscribe to a topic
  Future<void> subscribeToTopic(String topic) async {
    try {
      await _messaging.subscribeToTopic(topic);
      assert(() {
        debugPrint('[Push] Subscribed to topic: $topic');
        return true;
      }());
    } catch (e) {
      assert(() {
        debugPrint('[Push] Error subscribing to topic: $e');
        return true;
      }());
    }
  }

  /// Unsubscribe from a topic
  Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _messaging.unsubscribeFromTopic(topic);
      assert(() {
        debugPrint('[Push] Unsubscribed from topic: $topic');
        return true;
      }());
    } catch (e) {
      assert(() {
        debugPrint('[Push] Error unsubscribing from topic: $e');
        return true;
      }());
    }
  }

  /// Unregister token from backend (on logout)
  Future<void> unregisterToken() async {
    try {
      if (_fcmToken != null) {
        await _apiClient.dio.delete(
          '/api/user/fcm-token',
          data: {'token': _fcmToken},
        );
      }
      assert(() {
        debugPrint('[Push] FCM token unregistered');
        return true;
      }());
    } catch (e) {
      assert(() {
        debugPrint('[Push] Error unregistering FCM token: $e');
        return true;
      }());
    }
  }

  /// Dispose resources
  void dispose() {
    _foregroundSubscription?.cancel();
    _messageOpenedSubscription?.cancel();
  }
}
