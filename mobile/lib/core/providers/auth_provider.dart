import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

/// Auth state
class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.user,
    this.isLoading = false,
    this.error,
  });

  bool get isLoggedIn => user != null;

  AuthState copyWith({
    User? user,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Auth notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService = AuthService();

  AuthNotifier() : super(const AuthState()) {
    _checkAuth();
  }

  /// Check if user is already authenticated
  Future<void> _checkAuth() async {
    state = state.copyWith(isLoading: true);

    try {
      final isLoggedIn = await _authService.isLoggedIn();
      if (isLoggedIn) {
        final result = await _authService.getCurrentUser();
        if (result.success && result.data != null) {
          state = AuthState(user: result.data);
        } else {
          state = const AuthState();
        }
      } else {
        state = const AuthState();
      }
    } catch (e) {
      state = const AuthState();
    }
  }

  /// Login
  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);

    final result = await _authService.login(
      email: email,
      password: password,
    );

    if (result.success && result.data != null) {
      // LoginResult contains the user - extract it
      final loginResult = result.data!;
      if (loginResult.user != null) {
        state = AuthState(user: loginResult.user);
        return true;
      } else if (loginResult.mfaRequired) {
        // MFA required - handle separately if needed
        state = state.copyWith(
          isLoading: false,
          error: 'MFA verification required',
        );
        return false;
      }
    }
    state = state.copyWith(
      isLoading: false,
      error: result.error ?? 'Login failed',
    );
    return false;
  }

  /// Register
  Future<bool> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String phone,
    required UserRole role,
    String? organizationName,
    String? tinNumber,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    final result = await _authService.register(
      email: email,
      password: password,
      firstName: firstName,
      lastName: lastName,
      phone: phone,
      role: role,
      organizationName: organizationName,
      tinNumber: tinNumber,
    );

    if (result.success && result.data != null) {
      state = AuthState(user: result.data);
      return true;
    } else {
      state = state.copyWith(
        isLoading: false,
        error: result.error ?? 'Registration failed',
      );
      return false;
    }
  }

  /// Logout
  Future<void> logout() async {
    await _authService.logout();
    state = const AuthState();
  }

  /// Clear error
  void clearError() {
    state = state.copyWith(error: null);
  }
}

/// Auth state provider
final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
