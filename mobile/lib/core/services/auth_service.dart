import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../models/user.dart';

/// Result of a login attempt
/// Can be either successful (user returned) or require MFA (mfaToken returned)
class LoginResult {
  final User? user;
  final bool mfaRequired;
  final String? mfaToken;
  final String? phoneLastFour;
  final int? expiresIn;
  final String? message;

  LoginResult({
    this.user,
    this.mfaRequired = false,
    this.mfaToken,
    this.phoneLastFour,
    this.expiresIn,
    this.message,
  });

  /// Whether login is complete (no MFA needed)
  bool get isComplete => user != null && !mfaRequired;
}

/// Result of a password reset request
class PasswordResetResult {
  final String? resetToken;
  final int expiresIn;
  final String? phoneLastFour;
  final String message;

  PasswordResetResult({
    this.resetToken,
    required this.expiresIn,
    this.phoneLastFour,
    required this.message,
  });
}

/// Authentication service
class AuthService {
  final ApiClient _apiClient = ApiClient();

  /// Login with email and password
  /// Returns LoginResult which may require MFA verification
  Future<ApiResponse<LoginResult>> login({
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
        // Check if MFA is required
        if (response.data['mfaRequired'] == true) {
          // MFA required - return MFA token for verification step
          return ApiResponse.success(LoginResult(
            mfaRequired: true,
            mfaToken: response.data['mfaToken'] as String?,
            phoneLastFour: response.data['phoneLastFour'] as String?,
            expiresIn: response.data['expiresIn'] as int?,
            message: response.data['message'] as String? ?? 'Two-factor authentication required',
          ));
        }

        // No MFA required - complete login
        final userData = response.data['user'];
        final user = User.fromJson(userData);

        // Save auth info
        // sessionToken is returned for mobile clients (for Authorization header)
        // csrfToken is also included in response
        final sessionToken = response.data['sessionToken'] as String?;
        final csrfToken = response.data['csrfToken'] as String?;

        // FIX: Don't use fallback token - require valid session token
        if (sessionToken == null || sessionToken.isEmpty) {
          return ApiResponse.error(
            'Server did not return a valid session token',
            statusCode: 500,
          );
        }

        await _apiClient.saveAuth(
          sessionToken: sessionToken,
          csrfToken: csrfToken,
          userId: user.id,
          userRole: user.role.name,
        );

        return ApiResponse.success(LoginResult(user: user));
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

  /// Verify MFA code after login returns mfaRequired: true
  /// Call this with the mfaToken from LoginResult and the OTP from user
  Future<ApiResponse<User>> verifyMfa({
    required String mfaToken,
    required String otp,
    String? recoveryCode,
  }) async {
    try {
      final data = <String, dynamic>{
        'mfaToken': mfaToken,
      };

      // Either OTP or recovery code must be provided
      if (otp.isNotEmpty) {
        data['otp'] = otp;
      }
      if (recoveryCode != null && recoveryCode.isNotEmpty) {
        data['recoveryCode'] = recoveryCode;
      }

      final response = await _apiClient.dio.post(
        '/api/auth/verify-mfa',
        data: data,
      );

      if (response.statusCode == 200) {
        final userData = response.data['user'];
        final user = User.fromJson(userData);

        // Get tokens from response
        final sessionToken = response.data['sessionToken'] as String?;
        final csrfToken = response.data['csrfToken'] as String?;

        // FIX: Require valid session token
        if (sessionToken == null || sessionToken.isEmpty) {
          return ApiResponse.error(
            'Server did not return a valid session token',
            statusCode: 500,
          );
        }

        await _apiClient.saveAuth(
          sessionToken: sessionToken,
          csrfToken: csrfToken,
          userId: user.id,
          userRole: user.role.name,
        );

        return ApiResponse.success(user);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'MFA verification failed',
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
    String? companyName,
    String? carrierType,
    String? associationId,
    String? taxId,
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
          if (companyName != null) 'companyName': companyName,
          if (carrierType != null) 'carrierType': carrierType,
          if (associationId != null) 'associationId': associationId,
          if (taxId != null) 'taxId': taxId,
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
    } on DioException {
      // Ignore network errors on logout
    } catch (e) {
      // Ignore any other errors (including Firebase web exceptions) on logout
    } finally {
      await _apiClient.clearAuth();
    }
  }

  /// Request password reset - sends OTP to email/phone
  /// Returns true if OTP was sent successfully
  Future<ApiResponse<PasswordResetResult>> forgotPassword(String email) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/auth/forgot-password',
        data: {'email': email},
      );

      if (response.statusCode == 200) {
        return ApiResponse.success(PasswordResetResult(
          resetToken: response.data['resetToken'] as String?,
          expiresIn: response.data['expiresIn'] as int? ?? 300,
          phoneLastFour: response.data['phoneLastFour'] as String?,
          message: response.data['message'] as String? ?? 'OTP sent to your phone',
        ));
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to send reset code',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Reset password with OTP verification
  /// Backend expects email (not resetToken) to look up the user and verify the OTP
  Future<ApiResponse<bool>> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/auth/reset-password',
        data: {
          'email': email,
          'otp': otp,
          'newPassword': newPassword,
        },
      );

      if (response.statusCode == 200) {
        return ApiResponse.success(true);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to reset password',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Change password (requires current password)
  Future<ApiResponse<bool>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/api/user/change-password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
      );

      if (response.statusCode == 200) {
        return ApiResponse.success(true);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to change password',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
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

  /// Get all active sessions for the current user
  Future<ApiResponse<List<UserSession>>> getSessions() async {
    try {
      final response = await _apiClient.dio.get('/api/user/sessions');

      if (response.statusCode == 200) {
        final sessionsData = response.data['sessions'] ?? response.data;
        final sessions = (sessionsData as List)
            .map((json) => UserSession.fromJson(json))
            .toList();
        return ApiResponse.success(sessions);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to load sessions',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Revoke a specific session
  Future<ApiResponse<bool>> revokeSession(String sessionId) async {
    try {
      final response = await _apiClient.dio.delete('/api/user/sessions/$sessionId');

      if (response.statusCode == 200) {
        return ApiResponse.success(true);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to revoke session',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }

  /// Revoke all other sessions (keep current)
  Future<ApiResponse<int>> revokeAllOtherSessions() async {
    try {
      final response = await _apiClient.dio.post('/api/user/sessions/revoke-others');

      if (response.statusCode == 200) {
        final revokedCount = response.data['revokedCount'] as int? ?? 0;
        return ApiResponse.success(revokedCount);
      }

      return ApiResponse.error(
        response.data['error'] ?? 'Failed to revoke sessions',
        statusCode: response.statusCode,
      );
    } on DioException catch (e) {
      return ApiResponse.error(e.friendlyMessage, statusCode: e.response?.statusCode);
    } catch (e) {
      return ApiResponse.error('An unexpected error occurred');
    }
  }
}

/// User session model
class UserSession {
  final String id;
  final String? deviceInfo;
  final String? ipAddress;
  final String? userAgent;
  final DateTime createdAt;
  final DateTime? lastActiveAt;
  final bool isCurrent;

  UserSession({
    required this.id,
    this.deviceInfo,
    this.ipAddress,
    this.userAgent,
    required this.createdAt,
    this.lastActiveAt,
    this.isCurrent = false,
  });

  factory UserSession.fromJson(Map<String, dynamic> json) {
    return UserSession(
      id: json['id'] ?? '',
      deviceInfo: json['deviceInfo'],
      ipAddress: json['ipAddress'],
      userAgent: json['userAgent'],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
      lastActiveAt: json['lastActiveAt'] != null
          ? DateTime.parse(json['lastActiveAt'])
          : null,
      isCurrent: json['isCurrent'] ?? false,
    );
  }
}
