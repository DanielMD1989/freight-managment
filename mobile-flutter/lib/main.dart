import 'package:flutter/foundation.dart' show debugPrint, kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'app.dart';
import 'core/services/push_notification_service.dart';
import 'core/services/gps_queue_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive for local storage (GPS queue, settings)
  await Hive.initFlutter();

  // Set preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  // Initialize GPS queue service (mobile only - uses platform channels)
  if (!kIsWeb) {
    await GpsQueueService().initialize();
  }

  // Initialize push notifications (Firebase)
  // Note: For production, run `flutterfire configure` to generate firebase_options.dart
  if (!kIsWeb) {
    try {
      final pushService = PushNotificationService();
      await pushService.initialize();
    } catch (e) {
      // Firebase may not be configured yet - app continues without push
      assert(() {
        debugPrint('[Main] Push notifications not initialized: $e');
        return true;
      }());
    }
  }

  runApp(
    const ProviderScope(
      child: FreightManagementApp(),
    ),
  );
}
