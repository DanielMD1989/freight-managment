import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart' show AppColors, openDrawer;
import '../../../core/providers/auth_provider.dart';
import '../../../core/services/dashboard_service.dart';
import '../../../core/services/trip_service.dart';
import '../../../core/models/trip.dart';

/// Provider for shipper dashboard data
final shipperDashboardProvider =
    FutureProvider.autoDispose<ShipperDashboardData?>((ref) async {
  final service = DashboardService();
  final result = await service.getShipperDashboard();
  return result.success ? result.data : null;
});

/// Provider for shipper's active trips (shipments)
final shipperActiveTripsProvider =
    FutureProvider.autoDispose<List<Trip>>((ref) async {
  final service = TripService();
  final result = await service.getTrips(limit: 5);
  if (!result.success) return [];
  // Filter to show only active trips
  return (result.data ?? [])
      .where((t) =>
          t.status == TripStatus.assigned ||
          t.status == TripStatus.pickupPending ||
          t.status == TripStatus.inTransit ||
          t.status == TripStatus.delivered)
      .take(5)
      .toList();
});

class ShipperHomeScreen extends ConsumerWidget {
  const ShipperHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;
    final dashboardAsync = ref.watch(shipperDashboardProvider);
    final activeTripsAsync = ref.watch(shipperActiveTripsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu),
          onPressed: () {
            // Use the global key to open the drawer from the parent ShipperShell
            openDrawer(context, isShipper: true);
          },
        ),
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push('/notifications'),
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/profile'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(shipperDashboardProvider);
          ref.invalidate(shipperActiveTripsProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome card with stats
              dashboardAsync.when(
                data: (data) => _WelcomeCard(user: user, data: data),
                loading: () => _WelcomeCardLoading(user: user),
                error: (_, __) => _WelcomeCardError(user: user),
              ),
              const SizedBox(height: 24),

              // Quick actions
              Text(
                'Quick Actions',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _ActionCard(
                      icon: Icons.add_box,
                      title: 'Post Load',
                      color: AppColors.primary,
                      onTap: () => context.push('/shipper/loads/post'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ActionCard(
                      icon: Icons.search,
                      title: 'Find Trucks',
                      color: AppColors.secondary,
                      onTap: () => context.go('/shipper/trucks'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _ActionCard(
                      icon: Icons.inventory_2,
                      title: 'My Loads',
                      color: AppColors.warning,
                      onTap: () => context.go('/shipper/loads'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _ActionCard(
                      icon: Icons.send,
                      title: 'My Bookings',
                      color: AppColors.info,
                      onTap: () => context.push('/shipper/bookings'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Active shipments
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Active Shipments',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  TextButton(
                    onPressed: () => context.go('/shipper/trips'),
                    child: const Text('View All'),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              activeTripsAsync.when(
                data: (trips) => _ActiveShipmentsSection(trips: trips),
                loading: () => const _ShipmentsLoading(),
                error: (_, __) => const _ShipmentsError(),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/shipper/loads/post'),
        icon: const Icon(Icons.add),
        label: const Text('Post Load'),
        backgroundColor: AppColors.primary,
      ),
    );
  }
}

class _WelcomeCard extends StatelessWidget {
  final dynamic user;
  final ShipperDashboardData? data;

  const _WelcomeCard({required this.user, this.data});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.secondary, Color(0xFF059669)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Hello, ${user?.fullName ?? 'Shipper'}!',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Manage your shipments efficiently',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _StatCard(
                value: (data?.activeLoads ?? 0).toString(),
                label: 'Active',
                icon: Icons.local_shipping,
              ),
              const SizedBox(width: 12),
              _StatCard(
                value: (data?.inTransitLoads ?? 0).toString(),
                label: 'In Transit',
                icon: Icons.route,
              ),
              const SizedBox(width: 12),
              _StatCard(
                value: (data?.deliveredLoads ?? 0).toString(),
                label: 'Delivered',
                icon: Icons.check_circle,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _WelcomeCardLoading extends StatelessWidget {
  final dynamic user;

  const _WelcomeCardLoading({required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.secondary, Color(0xFF059669)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Hello, ${user?.fullName ?? 'Shipper'}!',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Loading your dashboard...',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          const Center(
            child: CircularProgressIndicator(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _WelcomeCardError extends StatelessWidget {
  final dynamic user;

  const _WelcomeCardError({required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.secondary, Color(0xFF059669)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Hello, ${user?.fullName ?? 'Shipper'}!',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Manage your shipments efficiently',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          const Row(
            children: [
              _StatCard(value: '-', label: 'Active', icon: Icons.local_shipping),
              SizedBox(width: 12),
              _StatCard(value: '-', label: 'In Transit', icon: Icons.route),
              SizedBox(width: 12),
              _StatCard(value: '-', label: 'Delivered', icon: Icons.check_circle),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String value;
  final String label;
  final IconData icon;

  const _StatCard({
    required this.value,
    required this.label,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: Colors.white, size: 20),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.8),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveShipmentsSection extends StatelessWidget {
  final List<Trip> trips;

  const _ActiveShipmentsSection({required this.trips});

  @override
  Widget build(BuildContext context) {
    if (trips.isEmpty) {
      return _EmptyState(
        icon: Icons.local_shipping,
        message: 'No active shipments',
        actionLabel: 'Post a Load',
        onAction: () => context.push('/shipper/loads/post'),
      );
    }

    return Column(
      children: trips.map((trip) => _ShipmentCard(trip: trip)).toList(),
    );
  }
}

class _ShipmentCard extends StatelessWidget {
  final Trip trip;

  const _ShipmentCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor(trip.status);
    final progress = _getProgress(trip.status);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => context.push('/shipper/trips/${trip.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'TRIP-${trip.id.substring(0, 8).toUpperCase()}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      trip.statusDisplay,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                trip.routeDisplay,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 4),
              if (trip.truck != null)
                Row(
                  children: [
                    const Icon(Icons.local_shipping,
                        size: 14, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      trip.truck!.licensePlate,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    if (trip.carrier != null) ...[
                      const SizedBox(width: 12),
                      const Icon(Icons.business,
                          size: 14, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          trip.carrier!.name,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                  minHeight: 6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getStatusColor(TripStatus status) {
    switch (status) {
      case TripStatus.assigned:
        return Colors.blue;
      case TripStatus.pickupPending:
        return Colors.orange;
      case TripStatus.inTransit:
        return AppColors.primary;
      case TripStatus.delivered:
        return Colors.purple;
      case TripStatus.completed:
        return AppColors.success;
      case TripStatus.cancelled:
        return Colors.red;
    }
  }

  double _getProgress(TripStatus status) {
    switch (status) {
      case TripStatus.assigned:
        return 0.1;
      case TripStatus.pickupPending:
        return 0.25;
      case TripStatus.inTransit:
        return 0.6;
      case TripStatus.delivered:
        return 0.9;
      case TripStatus.completed:
        return 1.0;
      case TripStatus.cancelled:
        return 0.0;
    }
  }
}

class _ShipmentsLoading extends StatelessWidget {
  const _ShipmentsLoading();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        2,
        (i) => Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Container(
            height: 120,
            padding: const EdgeInsets.all(16),
            child: const Center(
              child: CircularProgressIndicator(),
            ),
          ),
        ),
      ),
    );
  }
}

class _ShipmentsError extends StatelessWidget {
  const _ShipmentsError();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.red[50],
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Row(
        children: [
          Icon(Icons.error_outline, color: AppColors.error),
          SizedBox(width: 12),
          Text('Failed to load shipments'),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _EmptyState({
    required this.icon,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, size: 48, color: Colors.grey[400]),
          const SizedBox(height: 12),
          Text(
            message,
            style: TextStyle(color: Colors.grey[600]),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: onAction,
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}
