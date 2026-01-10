import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/providers/auth_provider.dart';
import 'features/auth/screens/login_screen.dart';
import 'features/auth/screens/register_screen.dart';
import 'features/carrier/screens/carrier_home_screen.dart';
import 'features/carrier/screens/carrier_loads_screen.dart';
import 'features/carrier/screens/carrier_trucks_screen.dart';
import 'features/carrier/screens/carrier_map_screen.dart';
import 'features/shipper/screens/shipper_home_screen.dart';
import 'features/shipper/screens/shipper_loads_screen.dart';
import 'features/shipper/screens/shipper_trucks_screen.dart';
import 'features/shared/screens/profile_screen.dart';
import 'features/shared/screens/notifications_screen.dart';

/// App theme colors
class AppColors {
  static const primary = Color(0xFF2563EB); // Blue-600
  static const primaryDark = Color(0xFF1D4ED8); // Blue-700
  static const secondary = Color(0xFF10B981); // Emerald-500
  static const error = Color(0xFFEF4444); // Red-500
  static const warning = Color(0xFFF59E0B); // Amber-500
  static const success = Color(0xFF22C55E); // Green-500
  static const background = Color(0xFFF8FAFC); // Slate-50
  static const surface = Colors.white;
  static const textPrimary = Color(0xFF0F172A); // Slate-900
  static const textSecondary = Color(0xFF64748B); // Slate-500
  static const border = Color(0xFFE2E8F0); // Slate-200
}

/// Main app widget
class FreightManagementApp extends ConsumerWidget {
  const FreightManagementApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Freight Management',
      debugShowCheckedModeBanner: false,
      theme: _buildTheme(),
      routerConfig: router,
    );
  }

  ThemeData _buildTheme() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: Brightness.light,
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        error: AppColors.error,
        surface: AppColors.surface,
        background: AppColors.background,
      ),
      scaffoldBackgroundColor: AppColors.background,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardTheme(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          elevation: 0,
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          side: const BorderSide(color: AppColors.primary),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.error),
        ),
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        hintStyle: const TextStyle(color: AppColors.textSecondary),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textSecondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
    );
  }
}

/// Router provider
final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final isLoggedIn = authState.isLoggedIn;
      final isLoggingIn = state.matchedLocation == '/login';
      final isRegistering = state.matchedLocation == '/register';

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

      return null;
    },
    routes: [
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
            path: '/carrier/map',
            builder: (context, state) => const CarrierMapScreen(),
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
            path: '/shipper/trucks',
            builder: (context, state) => const ShipperTrucksScreen(),
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
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _calculateSelectedIndex(context),
        onTap: (index) => _onItemTapped(index, context),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.inventory_2_outlined),
            activeIcon: Icon(Icons.inventory_2),
            label: 'Loads',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.local_shipping_outlined),
            activeIcon: Icon(Icons.local_shipping),
            label: 'Trucks',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.map_outlined),
            activeIcon: Icon(Icons.map),
            label: 'Map',
          ),
        ],
      ),
    );
  }

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/carrier/loads')) return 1;
    if (location.startsWith('/carrier/trucks')) return 2;
    if (location.startsWith('/carrier/map')) return 3;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0:
        context.go('/carrier');
        break;
      case 1:
        context.go('/carrier/loads');
        break;
      case 2:
        context.go('/carrier/trucks');
        break;
      case 3:
        context.go('/carrier/map');
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
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _calculateSelectedIndex(context),
        onTap: (index) => _onItemTapped(index, context),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.inventory_2_outlined),
            activeIcon: Icon(Icons.inventory_2),
            label: 'My Loads',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.local_shipping_outlined),
            activeIcon: Icon(Icons.local_shipping),
            label: 'Find Trucks',
          ),
        ],
      ),
    );
  }

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/shipper/loads')) return 1;
    if (location.startsWith('/shipper/trucks')) return 2;
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
        context.go('/shipper/trucks');
        break;
    }
  }
}
