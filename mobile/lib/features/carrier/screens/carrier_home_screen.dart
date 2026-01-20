import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/services/dashboard_service.dart';
import '../../../core/services/truck_service.dart';
import '../../../core/services/trip_service.dart';
import '../../../core/models/truck.dart';
import '../../../core/models/trip.dart';

/// Provider for carrier dashboard data
final carrierDashboardProvider = FutureProvider.autoDispose<CarrierDashboardData?>((ref) async {
  final service = DashboardService();
  final result = await service.getCarrierDashboard();
  return result.success ? result.data : null;
});

/// Provider for carrier's trucks
final carrierTrucksProvider = FutureProvider.autoDispose<List<Truck>>((ref) async {
  final service = TruckService();
  final result = await service.getTrucks(limit: 10);
  return result.success ? result.data ?? [] : [];
});

/// Provider for carrier's active trips
final carrierActiveTripsProvider = FutureProvider.autoDispose<List<Trip>>((ref) async {
  final service = TripService();
  final result = await service.getTrips(limit: 5, status: 'IN_TRANSIT');
  return result.success ? result.data ?? [] : [];
});

class CarrierHomeScreen extends ConsumerWidget {
  const CarrierHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;
    final dashboardAsync = ref.watch(carrierDashboardProvider);
    final trucksAsync = ref.watch(carrierTrucksProvider);
    final activeTripsAsync = ref.watch(carrierActiveTripsProvider);

    return Scaffold(
      appBar: AppBar(
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
          ref.invalidate(carrierDashboardProvider);
          ref.invalidate(carrierTrucksProvider);
          ref.invalidate(carrierActiveTripsProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome card
              _WelcomeCard(user: user),
              const SizedBox(height: 20),

              // Stats section
              dashboardAsync.when(
                data: (data) => _StatsSection(data: data),
                loading: () => const _StatsLoading(),
                error: (_, __) => const _StatsError(),
              ),
              const SizedBox(height: 20),

              // Quick Actions
              _QuickActionsSection(),
              const SizedBox(height: 20),

              // Active Trips
              activeTripsAsync.when(
                data: (trips) => _ActiveTripsSection(trips: trips),
                loading: () => const _SectionLoading(title: 'Active Trips'),
                error: (_, __) => const SizedBox.shrink(),
              ),
              const SizedBox(height: 20),

              // My Fleet
              trucksAsync.when(
                data: (trucks) => _FleetSection(trucks: trucks),
                loading: () => const _SectionLoading(title: 'My Fleet'),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WelcomeCard extends StatelessWidget {
  final dynamic user;

  const _WelcomeCard({required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: Colors.white.withOpacity(0.2),
            child: Text(
              user?.fullName?.substring(0, 1).toUpperCase() ?? 'C',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
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
                Text(
                  user?.fullName ?? 'Carrier',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsSection extends StatelessWidget {
  final CarrierDashboardData? data;

  const _StatsSection({required this.data});

  @override
  Widget build(BuildContext context) {
    if (data == null) return const _StatsError();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Overview',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.5,
          children: [
            _StatCard(
              title: 'Total Trucks',
              value: data!.totalTrucks.toString(),
              icon: Icons.local_shipping,
              color: AppColors.primary,
            ),
            _StatCard(
              title: 'Active Trucks',
              value: data!.activeTrucks.toString(),
              icon: Icons.check_circle,
              color: Colors.green,
            ),
            _StatCard(
              title: 'In Transit',
              value: data!.inTransitTrips.toString(),
              icon: Icons.route,
              color: Colors.orange,
            ),
            _StatCard(
              title: 'Completed',
              value: data!.completedDeliveries.toString(),
              icon: Icons.task_alt,
              color: Colors.blue,
            ),
            _StatCard(
              title: 'Pending Approval',
              value: data!.pendingApprovals.toString(),
              icon: Icons.pending_actions,
              color: Colors.amber,
            ),
            _StatCard(
              title: 'Wallet Balance',
              value: '${data!.walletBalance.toStringAsFixed(0)} ${data!.walletCurrency}',
              icon: Icons.account_balance_wallet,
              color: Colors.purple,
            ),
          ],
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 24),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            title,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsLoading extends StatelessWidget {
  const _StatsLoading();

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.5,
      children: List.generate(6, (i) => _LoadingCard()),
    );
  }
}

class _LoadingCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(12),
      ),
    );
  }
}

class _StatsError extends StatelessWidget {
  const _StatsError();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.red[50],
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Text('Failed to load dashboard stats'),
    );
  }
}

class _QuickActionsSection extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Quick Actions',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _QuickActionButton(
                icon: Icons.add_circle,
                label: 'Add Truck',
                onTap: () => context.push('/carrier/trucks/add'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _QuickActionButton(
                icon: Icons.search,
                label: 'Find Loads',
                onTap: () => context.go('/carrier/loadboard'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _QuickActionButton(
                icon: Icons.send,
                label: 'My Requests',
                onTap: () => context.push('/carrier/requests'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _QuickActionButton(
                icon: Icons.route,
                label: 'My Trips',
                onTap: () => context.go('/carrier/trips'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: AppColors.primary.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.primary, size: 28),
            const SizedBox(height: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActiveTripsSection extends StatelessWidget {
  final List<Trip> trips;

  const _ActiveTripsSection({required this.trips});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Active Trips',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            TextButton(
              onPressed: () => context.push('/carrier/trips'),
              child: const Text('View All'),
            ),
          ],
        ),
        if (trips.isEmpty)
          _EmptyState(
            icon: Icons.route,
            message: 'No active trips',
          )
        else
          ...trips.map((trip) => _TripCard(trip: trip)),
      ],
    );
  }
}

class _TripCard extends StatelessWidget {
  final Trip trip;

  const _TripCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _getStatusColor(trip.status).withOpacity(0.2),
          child: Icon(
            Icons.local_shipping,
            color: _getStatusColor(trip.status),
          ),
        ),
        title: Text(trip.routeDisplay),
        subtitle: Text(trip.statusDisplay),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/carrier/trips/${trip.id}'),
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
        return Colors.green;
      case TripStatus.delivered:
        return Colors.purple;
      case TripStatus.completed:
        return Colors.teal;
      case TripStatus.cancelled:
        return Colors.red;
    }
  }
}

class _FleetSection extends StatelessWidget {
  final List<Truck> trucks;

  const _FleetSection({required this.trucks});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'My Fleet',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            TextButton(
              onPressed: () => context.push('/carrier/trucks'),
              child: const Text('View All'),
            ),
          ],
        ),
        if (trucks.isEmpty)
          _EmptyState(
            icon: Icons.local_shipping,
            message: 'No trucks registered',
            actionLabel: 'Add Truck',
            onAction: () => context.push('/carrier/trucks/add'),
          )
        else
          ...trucks.take(3).map((truck) => _TruckCard(truck: truck)),
      ],
    );
  }
}

class _TruckCard extends StatelessWidget {
  final Truck truck;

  const _TruckCard({required this.truck});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _getStatusColor().withOpacity(0.2),
          child: Icon(Icons.local_shipping, color: _getStatusColor()),
        ),
        title: Text(truck.licensePlate),
        subtitle: Text('${truck.truckTypeDisplay} • ${truck.capacityDisplay}'),
        trailing: _StatusBadge(
          label: truck.statusDisplay,
          color: _getStatusColor(),
        ),
        onTap: () => context.push('/carrier/trucks/${truck.id}'),
      ),
    );
  }

  Color _getStatusColor() {
    if (!truck.isApproved) {
      if (truck.isPending) return Colors.amber;
      if (truck.isRejected) return Colors.red;
      return Colors.grey;
    }
    return truck.isAvailable ? Colors.green : Colors.blue;
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w500,
          color: color,
        ),
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

class _SectionLoading extends StatelessWidget {
  final String title;

  const _SectionLoading({required this.title});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        const Center(child: CircularProgressIndicator()),
      ],
    );
  }
}

