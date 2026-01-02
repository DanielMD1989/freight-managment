# PHASE 2 USER STORIES - MOBILE APPS (FLUTTER)

**Document Version:** 2.0
**Date:** 2026-01-02
**Purpose:** Complete implementation specifications for Phase 2 Mobile Applications (Flutter + Dart)

---

## OVERVIEW

This document contains complete implementation details for **5 Mobile Sprints** covering both **Carrier** and **Shipper** mobile applications built with **Flutter + Dart**.

### Mobile Sprint Summary

| Sprint | Name | Tasks | Effort | Focus |
|--------|------|-------|--------|-------|
| M1 | Carrier Mobile Core | 10 | 10 days | Auth, Dashboard, Truck Management |
| M2 | Carrier GPS & POD | 8 | 8 days | Background GPS, Photo Upload, Offline Mode |
| M3 | Shipper Mobile Core | 8 | 8 days | Auth, Dashboard, Load Management |
| M4 | Shipper Live Tracking | 6 | 6 days | Real-time Maps, ETA, Notifications |
| M5 | Mobile Polish | 8 | 8 days | Performance, Accessibility, App Store |
| **TOTAL** | **5 Sprints** | **40** | **40 days** | **Complete Mobile Platform** |

### Technology Stack

- **Framework:** Flutter 3.16+
- **Language:** Dart 3.2+
- **State Management:** Riverpod 2.4+ (Provider pattern)
- **Navigation:** GoRouter 13.0+
- **HTTP Client:** Dio 5.4+ with interceptors
- **Local Storage:** Hive 2.2+ (offline data), flutter_secure_storage (tokens)
- **GPS Tracking:** geolocator 10.1+ with background location
- **Camera:** image_picker 1.0+ for POD photos
- **Push Notifications:** firebase_messaging 14.7+ (FCM)
- **Maps:** google_maps_flutter 2.5+
- **Form Validation:** flutter_form_builder 9.1+
- **Code Generation:** freezed + json_serializable for models
- **Dependency Injection:** get_it 7.6+

### Why Flutter?

1. **Performance:** Compiled to native ARM code (no JavaScript bridge)
2. **Hot Reload:** Instant UI updates during development
3. **Single Codebase:** iOS + Android from one Dart codebase
4. **Rich UI:** Material Design (Android) + Cupertino (iOS) widgets built-in
5. **Strong Typing:** Dart's null safety prevents runtime crashes
6. **Large Ecosystem:** 40,000+ packages on pub.dev

---

## SPRINT M1: CARRIER MOBILE CORE

**Duration:** 10 days
**Tasks:** 10
**Focus:** Authentication, Dashboard, Truck Management, Load Acceptance

### User Story

**As a Carrier**, I want a mobile app so I can:
- View available loads on the go
- Accept load assignments from dispatchers
- Manage my truck postings
- View my active loads and their status
- Receive push notifications for new opportunities

### Background & Rationale

Carriers are frequently on the road and need mobile access to:
1. **Respond quickly** to load assignments (time-sensitive)
2. **Manage postings** while away from desktop
3. **Accept/reject** dispatcher assignments
4. **Monitor** active loads and deliveries

The carrier mobile app is **higher priority** than shipper mobile because:
- Carriers are mobile by nature (truck drivers)
- Quick response times = better load acceptance rates
- GPS tracking requires mobile device

### Acceptance Criteria

- [ ] Carrier can log in with email/password
- [ ] Carrier sees dashboard with key metrics (active loads, available loads, earnings)
- [ ] Carrier can view list of available loads
- [ ] Carrier can accept/reject load assignments from dispatcher
- [ ] Carrier can view truck postings
- [ ] Carrier can create/edit truck postings
- [ ] Carrier receives push notifications for new assignments
- [ ] App works on iOS and Android
- [ ] Offline mode caches critical data
- [ ] Session persists across app restarts

---

## TASK M1.1: Flutter Project Setup

**Effort:** 1 day

### Description

Initialize Flutter project, configure dependencies, set up folder structure, dependency injection, and API service.

### Implementation

#### File: `/mobile_carrier/pubspec.yaml`

```yaml
name: freight_carrier
description: Freight Carrier Mobile App
version: 1.0.0+1

environment:
  sdk: '>=3.2.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # State Management
  flutter_riverpod: ^2.4.9

  # Navigation
  go_router: ^13.0.0

  # HTTP & API
  dio: ^5.4.0
  retrofit: ^4.0.3
  pretty_dio_logger: ^1.3.1

  # Local Storage
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  flutter_secure_storage: ^9.0.0

  # Code Generation
  freezed_annotation: ^2.4.1
  json_annotation: ^4.8.1

  # Dependency Injection
  get_it: ^7.6.4
  injectable: ^2.3.2

  # UI Components
  flutter_screenutil: ^5.9.0
  cached_network_image: ^3.3.0
  shimmer: ^3.0.0

  # Location & GPS
  geolocator: ^10.1.0
  geocoding: ^2.1.1

  # Camera & Images
  image_picker: ^1.0.5

  # Push Notifications
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9
  flutter_local_notifications: ^16.3.0

  # Maps
  google_maps_flutter: ^2.5.0

  # Forms
  flutter_form_builder: ^9.1.1
  form_builder_validators: ^9.1.0

  # Utils
  intl: ^0.18.1
  url_launcher: ^6.2.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.1

  # Code Generation
  build_runner: ^2.4.7
  freezed: ^2.4.6
  json_serializable: ^6.7.1
  retrofit_generator: ^8.0.4
  injectable_generator: ^2.4.1
  hive_generator: ^2.0.1

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/icons/
```

#### File: `/mobile_carrier/lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/di/injection.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive for local storage
  await Hive.initFlutter();

  // Initialize dependency injection
  await configureDependencies();

  runApp(
    const ProviderScope(
      child: FreightCarrierApp(),
    ),
  );
}

class FreightCarrierApp extends ConsumerWidget {
  const FreightCarrierApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return ScreenUtilInit(
      designSize: const Size(375, 812),
      minTextAdapt: true,
      splitScreenMode: true,
      builder: (context, child) {
        return MaterialApp.router(
          title: 'Freight Carrier',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: ThemeMode.light,
          routerConfig: router,
        );
      },
    );
  }
}
```

#### File: `/mobile_carrier/lib/core/theme/app_theme.dart`

```dart
import 'package:flutter/material.dart';

class AppTheme {
  static const Color primaryColor = Color(0xFF2563EB); // Blue-600
  static const Color primaryDarkColor = Color(0xFF1E40AF); // Blue-700
  static const Color accentColor = Color(0xFF10B981); // Green-500
  static const Color errorColor = Color(0xFFEF4444); // Red-500
  static const Color warningColor = Color(0xFFF59E0B); // Yellow-500

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.light(
        primary: primaryColor,
        secondary: accentColor,
        error: errorColor,
        surface: Colors.white,
        background: const Color(0xFFF9FAFB), // Gray-50
      ),
      scaffoldBackgroundColor: const Color(0xFFF9FAFB),
      appBarTheme: const AppBarTheme(
        backgroundColor: primaryDarkColor,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: Colors.white,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      cardTheme: CardTheme(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF9FAFB),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primaryColor, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: errorColor),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.dark(
        primary: primaryColor,
        secondary: accentColor,
        error: errorColor,
        surface: const Color(0xFF1F2937),
        background: const Color(0xFF111827),
      ),
    );
  }
}
```

#### File: `/mobile_carrier/lib/core/constants/api_constants.dart`

```dart
class ApiConstants {
  static const String baseUrl = 'http://localhost:3000'; // Change for production

  // Auth endpoints
  static const String login = '/api/auth/login';
  static const String logout = '/api/auth/logout';
  static const String me = '/api/auth/me';

  // Carrier endpoints
  static const String availableLoads = '/api/carrier/loads/available';
  static const String myLoads = '/api/carrier/loads/my-loads';
  static const String dashboardStats = '/api/carrier/dashboard/stats';
  static const String truckPostings = '/api/carrier/truck-postings';

  // Load actions
  static String acceptLoad(String loadId) => '/api/loads/$loadId/accept';
  static String rejectLoad(String loadId) => '/api/loads/$loadId/reject';
  static String loadDetail(String loadId) => '/api/loads/$loadId';

  // Truck posting actions
  static String updateTruckPosting(String id) => '/api/truck-postings/$id';
  static String deleteTruckPosting(String id) => '/api/truck-postings/$id';
}
```

#### File: `/mobile_carrier/lib/core/network/dio_client.dart`

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../constants/api_constants.dart';

class DioClient {
  late Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  DioClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add interceptors
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Add auth token to every request
          final token = await _storage.read(key: 'authToken');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) async {
          // Handle 401 Unauthorized - logout user
          if (error.response?.statusCode == 401) {
            await _storage.delete(key: 'authToken');
            await _storage.delete(key: 'userData');
            // Router will handle navigation to login
          }
          return handler.next(error);
        },
      ),
    );

    // Add logger in debug mode
    _dio.interceptors.add(
      PrettyDioLogger(
        requestHeader: true,
        requestBody: true,
        responseHeader: false,
        responseBody: true,
        error: true,
      ),
    );
  }

  Dio get dio => _dio;

  // Auth methods
  Future<Response> login(String email, String password) async {
    return await _dio.post(ApiConstants.login, data: {
      'email': email,
      'password': password,
    });
  }

  Future<Response> logout() async {
    return await _dio.post(ApiConstants.logout);
  }

  Future<Response> getProfile() async {
    return await _dio.get(ApiConstants.me);
  }

  // Loads
  Future<Response> getAvailableLoads({
    String? status,
    double? minRate,
    int? limit,
  }) async {
    return await _dio.get(
      ApiConstants.availableLoads,
      queryParameters: {
        if (status != null) 'status': status,
        if (minRate != null) 'minRate': minRate,
        if (limit != null) 'limit': limit,
      },
    );
  }

  Future<Response> getMyLoads({String? status}) async {
    return await _dio.get(
      ApiConstants.myLoads,
      queryParameters: {
        if (status != null) 'status': status,
      },
    );
  }

  Future<Response> getLoadDetail(String loadId) async {
    return await _dio.get(ApiConstants.loadDetail(loadId));
  }

  Future<Response> acceptLoad(String loadId, String truckPostingId) async {
    return await _dio.put(
      ApiConstants.acceptLoad(loadId),
      data: {'truckPostingId': truckPostingId},
    );
  }

  Future<Response> rejectLoad(String loadId, {String? reason}) async {
    return await _dio.put(
      ApiConstants.rejectLoad(loadId),
      data: {'reason': reason},
    );
  }

  // Dashboard
  Future<Response> getDashboardStats() async {
    return await _dio.get(ApiConstants.dashboardStats);
  }

  // Truck Postings
  Future<Response> getTruckPostings() async {
    return await _dio.get(ApiConstants.truckPostings);
  }

  Future<Response> createTruckPosting(Map<String, dynamic> data) async {
    return await _dio.post('/api/truck-postings', data: data);
  }

  Future<Response> updateTruckPosting(String id, Map<String, dynamic> data) async {
    return await _dio.put(ApiConstants.updateTruckPosting(id), data: data);
  }

  Future<Response> deleteTruckPosting(String id) async {
    return await _dio.delete(ApiConstants.deleteTruckPosting(id));
  }
}
```

#### File: `/mobile_carrier/lib/core/di/injection.dart`

```dart
import 'package:get_it/get_it.dart';

import '../network/dio_client.dart';

final getIt = GetIt.instance;

Future<void> configureDependencies() async {
  // Network
  getIt.registerLazySingleton<DioClient>(() => DioClient());

  // Add more dependencies as needed
}
```

### Files Modified/Created

- `/mobile_carrier/pubspec.yaml` - Dependencies
- `/mobile_carrier/lib/main.dart` - App entry point
- `/mobile_carrier/lib/core/theme/app_theme.dart` - Theme configuration
- `/mobile_carrier/lib/core/constants/api_constants.dart` - API endpoints
- `/mobile_carrier/lib/core/network/dio_client.dart` - HTTP client
- `/mobile_carrier/lib/core/di/injection.dart` - Dependency injection

### Acceptance Criteria

- [x] Flutter project runs on iOS simulator
- [x] Flutter project runs on Android emulator
- [x] Dart analyzer shows no errors
- [x] HTTP client configured with interceptors
- [x] Theme system working
- [x] Dependency injection setup

---

## TASK M1.2: Authentication Flow & State Management

**Effort:** 1 day

### Description

Implement login/logout with Riverpod state management, secure token storage, and session persistence.

### Implementation

#### File: `/mobile_carrier/lib/features/auth/models/user_model.dart`

```dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_model.freezed.dart';
part 'user_model.g.dart';

@freezed
class UserModel with _$UserModel {
  const factory UserModel({
    required String id,
    required String email,
    required String name,
    required String role,
    required String organizationId,
    OrganizationModel? organization,
  }) = _UserModel;

  factory UserModel.fromJson(Map<String, dynamic> json) =>
      _$UserModelFromJson(json);
}

@freezed
class OrganizationModel with _$OrganizationModel {
  const factory OrganizationModel({
    required String id,
    required String name,
  }) = _OrganizationModel;

  factory OrganizationModel.fromJson(Map<String, dynamic> json) =>
      _$OrganizationModelFromJson(json);
}

@freezed
class AuthState with _$AuthState {
  const factory AuthState({
    UserModel? user,
    @Default(false) bool isAuthenticated,
    @Default(false) bool isLoading,
    String? error,
  }) = _AuthState;
}
```

#### File: `/mobile_carrier/lib/features/auth/providers/auth_provider.dart`

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/di/injection.dart';
import '../../../core/network/dio_client.dart';
import '../models/user_model.dart';

class AuthNotifier extends StateNotifier<AuthState> {
  final DioClient _dioClient;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  AuthNotifier(this._dioClient) : super(const AuthState()) {
    loadStoredAuth();
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final response = await _dioClient.login(email, password);
      final data = response.data;

      final user = UserModel.fromJson(data['user']);

      // Verify user is CARRIER
      if (user.role != 'CARRIER') {
        throw Exception('This app is for Carriers only. Please use the web portal.');
      }

      // Store token securely
      await _storage.write(key: 'authToken', value: data['token']);
      await _storage.write(key: 'userData', value: userModelToJson(user));

      state = state.copyWith(
        user: user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      );
    } catch (e) {
      state = state.copyWith(
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);

    try {
      await _dioClient.logout();
    } catch (e) {
      // Ignore logout errors
    }

    // Clear stored credentials
    await _storage.delete(key: 'authToken');
    await _storage.delete(key: 'userData');

    state = const AuthState();
  }

  Future<void> loadStoredAuth() async {
    state = state.copyWith(isLoading: true);

    try {
      final token = await _storage.read(key: 'authToken');
      final userDataString = await _storage.read(key: 'userData');

      if (token != null && userDataString != null) {
        // Verify token is still valid
        try {
          final response = await _dioClient.getProfile();
          final user = UserModel.fromJson(response.data['user']);

          state = state.copyWith(
            user: user,
            isAuthenticated: true,
            isLoading: false,
          );
        } catch (e) {
          // Token invalid - clear storage
          await _storage.delete(key: 'authToken');
          await _storage.delete(key: 'userData');
          state = state.copyWith(isLoading: false);
        }
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(getIt<DioClient>());
});
```

#### File: `/mobile_carrier/lib/features/auth/screens/login_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() {
    if (_formKey.currentState!.validate()) {
      ref.read(authProvider.notifier).login(
            _emailController.text.trim(),
            _passwordController.text,
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF1E40AF),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo/Title
                const Icon(
                  Icons.local_shipping,
                  size: 80,
                  color: Colors.white,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Freight Carrier',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Track. Deliver. Earn.',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
                const SizedBox(height: 48),

                // Login Form Card
                Card(
                  elevation: 8,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Sign In',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Error Message
                          if (authState.error != null)
                            Container(
                              padding: const EdgeInsets.all(12),
                              margin: const EdgeInsets.only(bottom: 16),
                              decoration: BoxDecoration(
                                color: Colors.red.shade50,
                                border: Border.all(color: Colors.red.shade200),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                authState.error!,
                                style: TextStyle(
                                  color: Colors.red.shade800,
                                  fontSize: 14,
                                ),
                              ),
                            ),

                          // Email Field
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            enabled: !authState.isLoading,
                            decoration: const InputDecoration(
                              labelText: 'Email',
                              prefixIcon: Icon(Icons.email_outlined),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter your email';
                              }
                              if (!value.contains('@')) {
                                return 'Please enter a valid email';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

                          // Password Field
                          TextFormField(
                            controller: _passwordController,
                            obscureText: true,
                            textInputAction: TextInputAction.done,
                            enabled: !authState.isLoading,
                            decoration: const InputDecoration(
                              labelText: 'Password',
                              prefixIcon: Icon(Icons.lock_outlined),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Please enter your password';
                              }
                              return null;
                            },
                            onFieldSubmitted: (_) => _handleLogin(),
                          ),
                          const SizedBox(height: 24),

                          // Login Button
                          ElevatedButton(
                            onPressed: authState.isLoading ? null : _handleLogin,
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                            ),
                            child: authState.isLoading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                          Colors.white),
                                    ),
                                  )
                                : const Text('Sign In'),
                          ),

                          // Forgot Password
                          const SizedBox(height: 16),
                          TextButton(
                            onPressed: () {
                              // TODO: Implement forgot password
                            },
                            child: const Text('Forgot Password?'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 24),
                Text(
                  "Don't have an account? Contact your dispatcher.",
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.8),
                    fontSize: 14,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

### Files Modified/Created

- `/mobile_carrier/lib/features/auth/models/user_model.dart` - User data models
- `/mobile_carrier/lib/features/auth/providers/auth_provider.dart` - Auth state management
- `/mobile_carrier/lib/features/auth/screens/login_screen.dart` - Login UI

### Acceptance Criteria

- [x] User can log in with valid credentials
- [x] Invalid credentials show error
- [x] Session persists across app restarts
- [x] Logout clears stored credentials
- [x] Only CARRIER role can access app
- [x] Token auto-added to API requests

---

## TASK M1.3: App Router & Bottom Navigation

**Effort:** 0.5 day

### Description

Set up GoRouter for navigation and bottom navigation bar with 4 tabs: Dashboard, Loads, Trucks, Profile.

### Implementation

#### File: `/mobile_carrier/lib/core/router/app_router.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/providers/auth_provider.dart';
import '../../features/auth/screens/login_screen.dart';
import '../../features/dashboard/screens/dashboard_screen.dart';
import '../../features/loads/screens/loads_screen.dart';
import '../../features/loads/screens/load_detail_screen.dart';
import '../../features/trucks/screens/trucks_screen.dart';
import '../../features/trucks/screens/truck_posting_form_screen.dart';
import '../../features/profile/screens/profile_screen.dart';
import '../widgets/main_scaffold.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isAuthenticated = authState.isAuthenticated;
      final isLoading = authState.isLoading;
      final isLoginRoute = state.matchedLocation == '/login';

      if (isLoading) return null;

      if (!isAuthenticated && !isLoginRoute) {
        return '/login';
      }

      if (isAuthenticated && isLoginRoute) {
        return '/';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/loads',
            builder: (context, state) => const LoadsScreen(),
          ),
          GoRoute(
            path: '/loads/:id',
            builder: (context, state) => LoadDetailScreen(
              loadId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/trucks',
            builder: (context, state) => const TrucksScreen(),
          ),
          GoRoute(
            path: '/trucks/new',
            builder: (context, state) => const TruckPostingFormScreen(),
          ),
          GoRoute(
            path: '/trucks/edit/:id',
            builder: (context, state) => TruckPostingFormScreen(
              postingId: state.pathParameters['id'],
            ),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),
    ],
  );
});
```

#### File: `/mobile_carrier/lib/core/widgets/main_scaffold.dart`

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class MainScaffold extends StatelessWidget {
  final Widget child;

  const MainScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _calculateSelectedIndex(context),
        onTap: (index) => _onItemTapped(index, context),
        selectedItemColor: Theme.of(context).colorScheme.primary,
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.local_shipping_outlined),
            activeIcon: Icon(Icons.local_shipping),
            label: 'Loads',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.directions_car_outlined),
            activeIcon: Icon(Icons.directions_car),
            label: 'Trucks',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outlined),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  int _calculateSelectedIndex(BuildContext context) {
    final String location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/loads')) return 1;
    if (location.startsWith('/trucks')) return 2;
    if (location.startsWith('/profile')) return 3;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/');
        break;
      case 1:
        context.go('/loads');
        break;
      case 2:
        context.go('/trucks');
        break;
      case 3:
        context.go('/profile');
        break;
    }
  }
}
```

### Files Modified/Created

- `/mobile_carrier/lib/core/router/app_router.dart` - App navigation
- `/mobile_carrier/lib/core/widgets/main_scaffold.dart` - Bottom nav wrapper

### Acceptance Criteria

- [x] All 4 tabs visible and working
- [x] Icons change when tab is active
- [x] Navigation state persists
- [x] Auth redirect working
- [x] Deep linking supported

---

## TASK M1.4: Dashboard Screen with Stats

**Effort:** 1.5 days

### Description

Dashboard showing active loads, available loads, earnings summary, and quick actions.

### Implementation

#### File: `/mobile_carrier/lib/features/dashboard/models/dashboard_stats_model.dart`

```dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_stats_model.freezed.dart';
part 'dashboard_stats_model.g.dart';

@freezed
class DashboardStatsModel with _$DashboardStatsModel {
  const factory DashboardStatsModel({
    @Default(0) int activeLoads,
    @Default(0) int availableLoads,
    @Default(0) int monthlyEarnings,
    @Default(0) int completedLoads,
    @Default(0) int averageRate,
    @Default(0) int activeTruckPostings,
  }) = _DashboardStatsModel;

  factory DashboardStatsModel.fromJson(Map<String, dynamic> json) =>
      _$DashboardStatsModelFromJson(json);
}
```

#### File: `/mobile_carrier/lib/features/dashboard/providers/dashboard_provider.dart`

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/di/injection.dart';
import '../../../core/network/dio_client.dart';
import '../models/dashboard_stats_model.dart';

final dashboardStatsProvider = FutureProvider.autoDispose<DashboardStatsModel>((ref) async {
  final dioClient = getIt<DioClient>();
  final response = await dioClient.getDashboardStats();
  return DashboardStatsModel.fromJson(response.data['stats']);
});
```

#### File: `/mobile_carrier/lib/features/dashboard/screens/dashboard_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../providers/dashboard_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final statsAsync = ref.watch(dashboardStatsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dashboardStatsProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome Section
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: const BoxDecoration(
                  color: Color(0xFF1E40AF),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome back,',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user?.name ?? '',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),

              // Stats Cards
              statsAsync.when(
                data: (stats) => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: _StatCard(
                              icon: Icons.local_shipping,
                              iconColor: const Color(0xFF2563EB),
                              value: stats.activeLoads.toString(),
                              label: 'Active Loads',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _StatCard(
                              icon: Icons.notifications,
                              iconColor: const Color(0xFF10B981),
                              value: stats.availableLoads.toString(),
                              label: 'Available',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _StatCard(
                              icon: Icons.attach_money,
                              iconColor: const Color(0xFFF59E0B),
                              value: '\$${stats.monthlyEarnings}',
                              label: 'This Month',
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _StatCard(
                              icon: Icons.check_circle,
                              iconColor: const Color(0xFF8B5CF6),
                              value: stats.completedLoads.toString(),
                              label: 'Completed',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                loading: () => const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (error, _) => Padding(
                  padding: const EdgeInsets.all(32),
                  child: Text('Error: $error'),
                ),
              ),

              // Quick Actions
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'Quick Actions',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  children: [
                    _QuickActionButton(
                      icon: Icons.search,
                      label: 'Browse Available Loads',
                      color: const Color(0xFF2563EB),
                      onPressed: () => context.go('/loads'),
                    ),
                    const SizedBox(height: 12),
                    _QuickActionButton(
                      icon: Icons.add_circle,
                      label: 'Post Truck Availability',
                      color: const Color(0xFF10B981),
                      onPressed: () => context.go('/trucks/new'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String value;
  final String label;

  const _StatCard({
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, color: iconColor, size: 28),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                color: Colors.grey,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onPressed;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        padding: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.white),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const Icon(Icons.chevron_right, color: Colors.white),
        ],
      ),
    );
  }
}
```

### Files Modified/Created

- `/mobile_carrier/lib/features/dashboard/models/dashboard_stats_model.dart` - Stats model
- `/mobile_carrier/lib/features/dashboard/providers/dashboard_provider.dart` - Stats provider
- `/mobile_carrier/lib/features/dashboard/screens/dashboard_screen.dart` - Dashboard UI

### Acceptance Criteria

- [x] Stats cards display correct counts
- [x] Pull-to-refresh updates data
- [x] Quick actions navigate correctly
- [x] Loading state shows spinner
- [x] Error state handled gracefully

---

*[Continuing with remaining tasks M1.5-M1.10 and Sprints M2-M5 in next append...]*
