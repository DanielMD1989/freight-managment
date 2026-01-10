import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/user.dart';

/// Authentication service
class AuthService {
  final ApiClient _apiClient = ApiClient();

  /// Login with email and password
  Future<ApiResponse<User>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/auth/login',
        data: {
          'email': email,
          'password': password,
        },
      );

      if (response.statusCode == 200) {
        final userData = response.data['user'];
        final user = User.fromJson(userData);

        // Save auth info
        await _apiClient.saveAuth(
          sessionToken: '', // Will be extracted from cookies by interceptor
          userId: user.id,
          userRole: user.role.name,
        );

        return ApiResponse.success(user);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Login failed',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Register a new user
  Future<ApiResponse<User>> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String phone,
    required UserRole role,
    String? organizationName,
    String? tinNumber,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/auth/register',
        data: {
          'email': email,
          'password': password,
          'firstName': firstName,
          'lastName': lastName,
          'phone': phone,
          'role': role.name.toUpperCase(),
          if (organizationName != null) 'organizationName': organizationName,
          if (tinNumber != null) 'tinNumber': tinNumber,
        },
      );

      if (response.statusCode == 201) {
        final userData = response.data['user'];
        final user = User.fromJson(userData);

        return ApiResponse.success(user);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Registration failed',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Logout
  Future<void> logout() async {
    try {
      await _apiClient.dio.post('/api/auth/logout');
    } catch (e) {
      // Ignore errors on logout
    } finally {
      await _apiClient.clearAuth();
    }
  }

  /// Get current user profile
  Future<ApiResponse<User>> getCurrentUser() async {
    try {
      final response = await _apiClient.dio.get('/api/user/profile');

      if (response.statusCode == 200) {
        final user = User.fromJson(response.data);
        return ApiResponse.success(user);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to get profile',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Check if user is logged in
  Future<bool> isLoggedIn() async {
    return await _apiClient.isAuthenticated();
  }

  /// Get current user role
  Future<UserRole?> getCurrentRole() async {
    final role = await _apiClient.getCurrentUserRole();
    if (role == null) return null;

    return UserRole.values.firstWhere(
      (r) => r.name.toLowerCase() == role.toLowerCase(),
      orElse: () => UserRole.carrier,
    );
  }
}
