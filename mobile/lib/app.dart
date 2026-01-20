import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/register_screen.dart';
import 'features/onboarding/screens/onboarding_screen.dart';
import 'features/carrier/screens/carrier_home_screen.dart';
import 'features/carrier/screens/carrier_loads_screen.dart';
import 'features/carrier/screens/carrier_trucks_screen.dart';
import 'features/carrier/screens/carrier_map_screen.dart';
import 'features/carrier/screens/add_truck_screen.dart';
import 'features/carrier/screens/truck_details_screen.dart';
import 'features/carrier/screens/edit_truck_screen.dart';
import 'features/carrier/screens/carrier_trips_screen.dart';
import 'features/carrier/screens/carrier_trip_details_screen.dart';
import 'features/carrier/screens/pod_upload_screen.dart';
import 'features/carrier/screens/carrier_loadboard_screen.dart';
import 'features/carrier/screens/load_details_screen.dart';
import 'features/carrier/screens/carrier_load_requests_screen.dart';
import 'features/shipper/screens/shipper_home_screen.dart';
import 'features/shipper/screens/shipper_trips_screen.dart';
import 'features/shipper/screens/shipper_trip_details_screen.dart';
import 'features/shipper/screens/shipper_loads_screen.dart';
import 'features/shipper/screens/shipper_trucks_screen.dart';
import 'features/shipper/screens/shipper_truckboard_screen.dart';
import 'features/shipper/screens/shipper_truck_details_screen.dart';
import 'features/shipper/screens/post_load_screen.dart';
import 'features/shipper/screens/shipper_load_details_screen.dart';
import 'features/shipper/screens/shipper_load_requests_screen.dart';
import 'features/shipper/screens/shipper_truck_requests_screen.dart';
import 'features/shared/screens/profile_screen.dart';
import 'features/shared/screens/notifications_screen.dart';

/// Provider for onboarding completion status
final onboardingCompleteProvider = FutureProvider<bool>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool('onboarding_complete') ?? false;
});

/// A2 Modern Navy Design System Colors
class AppColors {
  // Primary Colors (Ocean Blue)
  static const primary50 = Color(0xFFF0F9FF);
  static const primary100 = Color(0xFFE0F2FE);
  static const primary200 = Color(0xFFBAE6FD);
  static const primary300 = Color(0xFF7DD3FC);
  static const primary400 = Color(0xFF38BDF8);
  static const primary500 = Color(0xFF0EA5E9);
  static const primary600 = Color(0xFF0284C7);
  static const primary700 = Color(0xFF0369A1);
  static const primary800 = Color(0xFF075985);
  static const primary900 = Color(0xFF0C4A6E);

  // Main Primary Colors
  static const primary = Color(0xFF0284C7); // primary-600
  static const primaryDark = Color(0xFF0369A1); // primary-700

  // Accent Colors (Burnt Orange)
  static const accent50 = Color(0xFFFFF7ED);
  static const accent100 = Color(0xFFFFEDD5);
  static const accent200 = Color(0xFFFED7AA);
  static const accent300 = Color(0xFFFDBA74);
  static const accent400 = Color(0xFFFB923C);
  static const accent500 = Color(0xFFF97316);
  static const accent600 = Color(0xFFEA580C);
  static const accent700 = Color(0xFFC2410C);
  static const accent800 = Color(0xFF9A3412);
  static const accent900 = Color(0xFF7C2D12);

  static const accent = Color(0xFFF97316); // accent-500

  // Secondary (alias for success - backward compatibility)
  static const secondary = Color(0xFF10B981); // Emerald-500

  // Semantic Colors
  static const error = Color(0xFFDC2626); // Red-600
  static const warning = Color(0xFFF59E0B); // Amber-500
  static const success = Color(0xFF10B981); // Emerald-500
  static const info = Color(0xFF06B6D4); // Cyan-500

  // Neutral Colors
  static const slate50 = Color(0xFFF8FAFC);
  static const slate100 = Color(0xFFF1F5F9);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate300 = Color(0xFFCBD5E1);
  static const slate400 = Color(0xFF94A3B8);
  static const slate500 = Color(0xFF64748B);
  static const slate600 = Color(0xFF475569);
  static const slate700 = Color(0xFF334155);
  static const slate800 = Color(0xFF1E293B);
  static const slate900 = Color(0xFF0F172A);

  // UI Colors
  static const background = slate50;
  static const surface = Colors.white;
  static const textPrimary = slate900;
  static const textSecondary = slate500;
  static const border = slate200;
  static const divider = slate200;

  // Sidebar/Nav Colors (Dark theme)
  static const navBackground = slate900;
  static const navText = slate400;
  static const navTextActive = primary400;
  static const navBgActive = Color(0x260EA5E9); // primary-600 with 15% opacity
}

/// Main app widget
class FreightManagementApp extends ConsumerWidget {
  const FreightManagementApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'FreightFlow',
      debugShowCheckedModeBanner: false,
      theme: _buildTheme(),
      darkTheme: _buildDarkTheme(),
      themeMode: ThemeMode.light,
      routerConfig: router,
    );
  }

  ThemeData _buildTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: Brightness.light,
        primary: AppColors.primary,
        onPrimary: Colors.white,
        secondary: AppColors.accent,
        onSecondary: Colors.white,
        error: AppColors.error,
        surface: AppColors.surface,
        onSurface: AppColors.textPrimary,
      ),
      scaffoldBackgroundColor: AppColors.background,
      fontFamily: 'Inter',
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: false,
        scrolledUnderElevation: 1,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
        iconTheme: IconThemeData(color: AppColors.textPrimary),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 0,
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 0,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          side: const BorderSide(color: AppColors.primary, width: 2),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 2),
        ),
        labelStyle: const TextStyle(
          color: AppColors.textSecondary,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
        hintStyle: const TextStyle(
          color: AppColors.slate400,
          fontSize: 14,
        ),
        floatingLabelBehavior: FloatingLabelBehavior.auto,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        selectedLabelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.primary100,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.primary);
          }
          return const IconThemeData(color: AppColors.textSecondary);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              color: AppColors.primary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            );
          }
          return const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          );
        }),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.slate100,
        selectedColor: AppColors.primary100,
        labelStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
        space: 1,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.slate900,
        contentTextStyle: const TextStyle(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
        linearTrackColor: AppColors.primary100,
        circularTrackColor: AppColors.primary100,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          letterSpacing: -1,
          color: AppColors.textPrimary,
        ),
        displayMedium: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: AppColors.textPrimary,
        ),
        displaySmall: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.25,
          color: AppColors.textPrimary,
        ),
        headlineMedium: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        headlineSmall: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        titleLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        titleMedium: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        bodyLarge: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          color: AppColors.textPrimary,
        ),
        bodyMedium: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: AppColors.textSecondary,
        ),
        bodySmall: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: AppColors.textSecondary,
        ),
        labelLarge: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.textPrimary,
        ),
        labelMedium: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }

  ThemeData _buildDarkTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: Brightness.dark,
        primary: AppColors.primary400,
        onPrimary: AppColors.slate900,
        secondary: AppColors.accent400,
        onSecondary: AppColors.slate900,
        error: Color(0xFFF87171),
        surface: AppColors.slate900,
        onSurface: AppColors.slate100,
      ),
      scaffoldBackgroundColor: AppColors.slate900,
      fontFamily: 'Inter',
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.slate900,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
      ),
      cardTheme: CardThemeData(
        color: AppColors.slate800,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.slate700),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.slate900,
        selectedItemColor: AppColors.primary400,
        unselectedItemColor: AppColors.slate400,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
    );
  }
}

/// Router provider
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final onboardingComplete = ref.watch(onboardingCompleteProvider);

  return GoRouter(
    initialLocation: '/onboarding',
    redirect: (context, state) {
      final isLoggedIn = authState.isLoggedIn;
      final isOnboarding = state.matchedLocation == '/onboarding';
      final isLoggingIn = state.matchedLocation == '/login';
      final isRegistering = state.matchedLocation == '/register';

      // Check onboarding status
      final hasCompletedOnboarding = onboardingComplete.maybeWhen(
        data: (complete) => complete,
        orElse: () => false,
      );

      // If onboarding not complete and not on onboarding page, redirect to onboarding
      if (!hasCompletedOnboarding && !isOnboarding) {
        return '/onboarding';
      }

      // If onboarding complete but on onboarding page, go to login
      if (hasCompletedOnboarding && isOnboarding) {
        return '/login';
      }

      // Normal auth flow after onboarding
      if (hasCompletedOnboarding) {
        if (!isLoggedIn && !isLoggingIn && !isRegistering) {
          return '/login';
        }

        if (isLoggedIn && (isLoggingIn || isRegistering)) {
          // Redirect to role-specific home
          if (authState.user?.isCarrier == true) {
            return '/carrier';
          } else if (authState.user?.isShipper == true) {
            return '/shipper';
          }
          return '/login';
        }
      }

      return null;
    },
    routes: [
      // Onboarding route
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      // Auth routes
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),

      // Carrier routes
      ShellRoute(
        builder: (context, state, child) => CarrierShell(child: child),
        routes: [
          GoRoute(
            path: '/carrier',
            builder: (context, state) => const CarrierHomeScreen(),
          ),
          GoRoute(
            path: '/carrier/loads',
            builder: (context, state) => const CarrierLoadsScreen(),
          ),
          GoRoute(
            path: '/carrier/trucks',
            builder: (context, state) => const CarrierTrucksScreen(),
          ),
          GoRoute(
            path: '/carrier/trucks/add',
            builder: (context, state) => const AddTruckScreen(),
          ),
          GoRoute(
            path: '/carrier/trucks/:id',
            builder: (context, state) => TruckDetailsScreen(
              truckId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/carrier/trucks/:id/edit',
            builder: (context, state) => EditTruckScreen(
              truckId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/carrier/trips',
            builder: (context, state) => const CarrierTripsScreen(),
          ),
          GoRoute(
            path: '/carrier/trips/:id',
            builder: (context, state) => CarrierTripDetailsScreen(
              tripId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/carrier/trips/:id/pod',
            builder: (context, state) => PodUploadScreen(
              tripId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/carrier/map',
            builder: (context, state) => const CarrierMapScreen(),
          ),
          GoRoute(
            path: '/carrier/loadboard',
            builder: (context, state) => const CarrierLoadboardScreen(),
          ),
          GoRoute(
            path: '/carrier/loadboard/:id',
            builder: (context, state) => LoadDetailsScreen(
              loadId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/carrier/requests',
            builder: (context, state) => const CarrierLoadRequestsScreen(),
          ),
        ],
      ),

      // Shipper routes
      ShellRoute(
        builder: (context, state, child) => ShipperShell(child: child),
        routes: [
          GoRoute(
            path: '/shipper',
            builder: (context, state) => const ShipperHomeScreen(),
          ),
          GoRoute(
            path: '/shipper/loads',
            builder: (context, state) => const ShipperLoadsScreen(),
          ),
          GoRoute(
            path: '/shipper/loads/:id',
            builder: (context, state) => ShipperLoadDetailsScreen(
              loadId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/shipper/loads/:id/requests',
            builder: (context, state) => ShipperLoadRequestsScreen(
              loadId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/shipper/trucks',
            builder: (context, state) => const ShipperTruckboardScreen(),
          ),
          GoRoute(
            path: '/shipper/trucks/:id',
            builder: (context, state) => ShipperTruckDetailsScreen(
              truckId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/shipper/bookings',
            builder: (context, state) => const ShipperTruckRequestsScreen(),
          ),
          GoRoute(
            path: '/shipper/trips',
            builder: (context, state) => const ShipperTripsScreen(),
          ),
          GoRoute(
            path: '/shipper/trips/:id',
            builder: (context, state) => ShipperTripDetailsScreen(
              tripId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/shipper/loads/post',
            builder: (context, state) => const PostLoadScreen(),
          ),
        ],
      ),

      // Shared routes
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
    ],
  );
});

/// Carrier shell with bottom navigation
class CarrierShell extends StatelessWidget {
  final Widget child;

  const CarrierShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _calculateSelectedIndex(context),
        onDestinationSelected: (index) => _onItemTapped(index, context),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.search_outlined),
            selectedIcon: Icon(Icons.search),
            label: 'Find Loads',
          ),
          NavigationDestination(
            icon: Icon(Icons.route_outlined),
            selectedIcon: Icon(Icons.route),
            label: 'Trips',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined),
            selectedIcon: Icon(Icons.local_shipping),
            label: 'Trucks',
          ),
        ],
      ),
    );
  }

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/carrier/loadboard')) return 1;
    if (location.startsWith('/carrier/trips')) return 2;
    if (location.startsWith('/carrier/trucks')) return 3;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/carrier');
        break;
      case 1:
        context.go('/carrier/loadboard');
        break;
      case 2:
        context.go('/carrier/trips');
        break;
      case 3:
        context.go('/carrier/trucks');
        break;
    }
  }
}

/// Shipper shell with bottom navigation
class ShipperShell extends StatelessWidget {
  final Widget child;

  const ShipperShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _calculateSelectedIndex(context),
        onDestinationSelected: (index) => _onItemTapped(index, context),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'My Loads',
          ),
          NavigationDestination(
            icon: Icon(Icons.route_outlined),
            selectedIcon: Icon(Icons.route),
            label: 'Shipments',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_shipping_outlined),
            selectedIcon: Icon(Icons.local_shipping),
            label: 'Find Trucks',
          ),
        ],
      ),
    );
  }

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/shipper/loads')) return 1;
    if (location.startsWith('/shipper/trips')) return 2;
    if (location.startsWith('/shipper/trucks')) return 3;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/shipper');
        break;
      case 1:
        context.go('/shipper/loads');
        break;
      case 2:
        context.go('/shipper/trips');
        break;
      case 3:
        context.go('/shipper/trucks');
        break;
    }
  }
}
