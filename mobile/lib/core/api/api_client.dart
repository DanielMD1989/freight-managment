import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// API configuration
class ApiConfig {
  /// Base URL for the API
  /// In development, use your local network IP or ngrok URL
  /// In production, use your production API URL
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
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

  ApiClient._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(milliseconds: ApiConfig.connectTimeout),
      receiveTimeout: const Duration(milliseconds: ApiConfig.receiveTimeout),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Add interceptors
    _dio.interceptors.add(_authInterceptor());
    _dio.interceptors.add(_loggingInterceptor());
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
        // Get session token from secure storage
        final token = await _storage.read(key: StorageKeys.sessionToken);
        if (token != null) {
          options.headers['Cookie'] = 'session=$token';
        }

        // Add CSRF token for state-changing requests
        if (['POST', 'PUT', 'PATCH', 'DELETE'].contains(options.method)) {
          final csrfToken = await _storage.read(key: StorageKeys.csrfToken);
          if (csrfToken != null) {
            options.headers['x-csrf-token'] = csrfToken;
          }
        }

        handler.next(options);
      },
      onResponse: (response, handler) async {
        // Extract and save CSRF token from response cookies
        final cookies = response.headers['set-cookie'];
        if (cookies != null) {
          for (final cookie in cookies) {
            if (cookie.startsWith('csrf_token=')) {
              final token = cookie.split(';').first.split('=').last;
              await _storage.write(key: StorageKeys.csrfToken, value: token);
            }
            if (cookie.startsWith('session=')) {
              final token = cookie.split(';').first.split('=').last;
              await _storage.write(key: StorageKeys.sessionToken, value: token);
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

  /// Logging interceptor for debugging
  Interceptor _loggingInterceptor() {
    return LogInterceptor(
      requestBody: true,
      responseBody: true,
      error: true,
      logPrint: (obj) => print('[API] $obj'),
    );
  }

  /// Save auth tokens after login
  Future<void> saveAuth({
    required String sessionToken,
    String? csrfToken,
    required String userId,
    required String userRole,
  }) async {
    await _storage.write(key: StorageKeys.sessionToken, value: sessionToken);
    if (csrfToken != null) {
      await _storage.write(key: StorageKeys.csrfToken, value: csrfToken);
    }
    await _storage.write(key: StorageKeys.userId, value: userId);
    await _storage.write(key: StorageKeys.userRole, value: userRole);
  }

  /// Clear auth tokens on logout
  Future<void> clearAuth() async {
    await _storage.delete(key: StorageKeys.sessionToken);
    await _storage.delete(key: StorageKeys.csrfToken);
    await _storage.delete(key: StorageKeys.userId);
    await _storage.delete(key: StorageKeys.userRole);
  }

  /// Check if user is authenticated
  Future<bool> isAuthenticated() async {
    final token = await _storage.read(key: StorageKeys.sessionToken);
    return token != null && token.isNotEmpty;
  }

  /// Get current user ID
  Future<String?> getCurrentUserId() async {
    return await _storage.read(key: StorageKeys.userId);
  }

  /// Get current user role
  Future<String?> getCurrentUserRole() async {
    return await _storage.read(key: StorageKeys.userRole);
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
    switch (type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Connection timed out. Please check your internet.';
      case DioExceptionType.connectionError:
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
        return 'Something went wrong. Please try again.';
    }
  }
}
