import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// API configuration
class ApiConfig {
  /// Base URL for the API
  /// In development, use your local network IP or ngrok URL
  /// In production, use your production API URL
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.1.6:3000',
  );

  /// API timeout in milliseconds
  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;
}

/// Secure storage keys
class StorageKeys {
  static const String sessionToken = 'session_token';
  static const String csrfToken = 'csrf_token';
  static const String userId = 'user_id';
  static const String userRole = 'user_role';
}

/// API client singleton
class ApiClient {
  static ApiClient? _instance;
  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  SharedPreferences? _webPrefs;

  ApiClient._internal() {
    assert(() {
      print('[API] Initializing ApiClient with baseUrl: ${ApiConfig.baseUrl}');
      print('[API] Running on web: $kIsWeb');
      return true;
    }());

    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(milliseconds: ApiConfig.connectTimeout),
      receiveTimeout: const Duration(milliseconds: ApiConfig.receiveTimeout),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Note: For web builds, browser handles CORS automatically
    // No special adapter needed for iOS/Android

    // Add interceptors
    _dio.interceptors.add(_authInterceptor());
    _dio.interceptors.add(_loggingInterceptor());

    // Initialize web preferences
    if (kIsWeb) {
      _initWebPrefs();
    }
  }

  Future<void> _initWebPrefs() async {
    _webPrefs = await SharedPreferences.getInstance();
  }

  factory ApiClient() {
    _instance ??= ApiClient._internal();
    return _instance!;
  }

  Dio get dio => _dio;

  /// Auth interceptor to add session token to requests
  Interceptor _authInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Get session token
        final token = await _readStorage(StorageKeys.sessionToken);

        // Add Authorization header for mobile/web clients
        // This works for both platforms and doesn't rely on cookies
        if (token != null && token.isNotEmpty && token != 'authenticated') {
          options.headers['Authorization'] = 'Bearer $token';
        }

        // Mark request as from mobile client (for server to return sessionToken)
        options.headers['x-client-type'] = 'mobile';

        // Add CSRF token for state-changing requests
        if (['POST', 'PUT', 'PATCH', 'DELETE'].contains(options.method)) {
          final csrfToken = await _readStorage(StorageKeys.csrfToken);
          if (csrfToken != null && csrfToken.isNotEmpty) {
            options.headers['x-csrf-token'] = csrfToken;
          }
        }

        handler.next(options);
      },
      onResponse: (response, handler) async {
        // Extract and save CSRF token from response cookies (mobile only)
        // On web, cookies are handled by browser
        if (!kIsWeb) {
          final cookies = response.headers['set-cookie'];
          if (cookies != null) {
            for (final cookie in cookies) {
              if (cookie.startsWith('csrf_token=')) {
                final token = cookie.split(';').first.split('=').last;
                await _writeStorage(StorageKeys.csrfToken, token);
              }
              if (cookie.startsWith('session=')) {
                final token = cookie.split(';').first.split('=').last;
                await _writeStorage(StorageKeys.sessionToken, token);
              }
            }
          }
        }
        handler.next(response);
      },
      onError: (error, handler) async {
        // Handle 401 Unauthorized - clear tokens and redirect to login
        if (error.response?.statusCode == 401) {
          await clearAuth();
          // Note: Navigation to login should be handled by the app's auth state
        }
        handler.next(error);
      },
    );
  }

  /// Logging interceptor for debugging (only in debug mode)
  Interceptor _loggingInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) {
        assert(() {
          print('[API REQUEST] ${options.method} ${options.uri}');
          return true;
        }());
        handler.next(options);
      },
      onResponse: (response, handler) {
        assert(() {
          print('[API RESPONSE] ${response.statusCode} ${response.requestOptions.uri}');
          return true;
        }());
        handler.next(response);
      },
      onError: (error, handler) {
        assert(() {
          print('[API ERROR] ${error.type}: ${error.message}');
          print('[API ERROR] Request: ${error.requestOptions.method} ${error.requestOptions.uri}');
          return true;
        }());
        handler.next(error);
      },
    );
  }

  /// Helper to read from storage (web uses SharedPreferences)
  Future<String?> _readStorage(String key) async {
    if (kIsWeb) {
      _webPrefs ??= await SharedPreferences.getInstance();
      return _webPrefs!.getString(key);
    }
    return await _storage.read(key: key);
  }

  /// Helper to write to storage (web uses SharedPreferences)
  Future<void> _writeStorage(String key, String value) async {
    if (kIsWeb) {
      _webPrefs ??= await SharedPreferences.getInstance();
      await _webPrefs!.setString(key, value);
    } else {
      await _storage.write(key: key, value: value);
    }
  }

  /// Helper to delete from storage
  Future<void> _deleteStorage(String key) async {
    if (kIsWeb) {
      _webPrefs ??= await SharedPreferences.getInstance();
      await _webPrefs!.remove(key);
    } else {
      await _storage.delete(key: key);
    }
  }

  /// Save auth tokens after login
  Future<void> saveAuth({
    required String sessionToken,
    String? csrfToken,
    required String userId,
    required String userRole,
  }) async {
    await _writeStorage(StorageKeys.sessionToken, sessionToken);
    if (csrfToken != null) {
      await _writeStorage(StorageKeys.csrfToken, csrfToken);
    }
    await _writeStorage(StorageKeys.userId, userId);
    await _writeStorage(StorageKeys.userRole, userRole);
  }

  /// Clear auth tokens on logout
  Future<void> clearAuth() async {
    await _deleteStorage(StorageKeys.sessionToken);
    await _deleteStorage(StorageKeys.csrfToken);
    await _deleteStorage(StorageKeys.userId);
    await _deleteStorage(StorageKeys.userRole);
  }

  /// Check if user is authenticated
  Future<bool> isAuthenticated() async {
    // On web, check userId instead since cookies are handled by browser
    if (kIsWeb) {
      final userId = await _readStorage(StorageKeys.userId);
      return userId != null && userId.isNotEmpty;
    }
    final token = await _readStorage(StorageKeys.sessionToken);
    return token != null && token.isNotEmpty;
  }

  /// Get current user ID
  Future<String?> getCurrentUserId() async {
    return await _readStorage(StorageKeys.userId);
  }

  /// Get current user role
  Future<String?> getCurrentUserRole() async {
    return await _readStorage(StorageKeys.userRole);
  }
}

/// API response wrapper
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? error;
  final int? statusCode;

  ApiResponse({
    required this.success,
    this.data,
    this.error,
    this.statusCode,
  });

  factory ApiResponse.success(T data) => ApiResponse(
        success: true,
        data: data,
      );

  factory ApiResponse.error(String message, {int? statusCode}) => ApiResponse(
        success: false,
        error: message,
        statusCode: statusCode,
      );
}

/// Extension for Dio error handling
extension DioErrorExtension on DioException {
  String get friendlyMessage {
    // Debug logging only in development
    assert(() {
      print('[API Error] Type: $type, Message: $message');
      return true;
    }());

    switch (type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Connection timed out. Please check your internet.';
      case DioExceptionType.connectionError:
        // On web, CORS errors often appear as connection errors
        if (kIsWeb) {
          return 'Connection failed. This may be a CORS issue. Check browser console.';
        }
        return 'No internet connection.';
      case DioExceptionType.badResponse:
        final data = response?.data;
        if (data is Map && data['error'] != null) {
          return data['error'].toString();
        }
        return 'Server error. Please try again.';
      case DioExceptionType.cancel:
        return 'Request cancelled.';
      default:
        return 'Something went wrong: ${message ?? type.name}';
    }
  }
}
