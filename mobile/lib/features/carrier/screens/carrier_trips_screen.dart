import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart';
import '../../../core/models/trip.dart';
import '../../../core/services/trip_service.dart';

/// Provider for carrier's trips list
final carrierTripsProvider = FutureProvider.autoDispose<List<Trip>>((ref) async {
  final service = TripService();
  final result = await service.getTrips(limit: 100);
  return result.success ? result.data ?? [] : [];
});

/// Tab state
enum TripTab { readyToStart, active }

final tripTabProvider = StateProvider<TripTab>((ref) => TripTab.readyToStart);

/// Carrier Trips List Screen
class CarrierTripsScreen extends ConsumerWidget {
  const CarrierTripsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsAsync = ref.watch(carrierTripsProvider);
    final currentTab = ref.watch(tripTabProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Trips'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(carrierTripsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Tab bar
          _TabBar(
            currentTab: currentTab,
            onTabChanged: (tab) => ref.read(tripTabProvider.notifier).state = tab,
            tripsAsync: tripsAsync,
          ),

          // Content
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(carrierTripsProvider),
              child: tripsAsync.when(
                data: (trips) {
                  final filteredTrips = _filterTrips(trips, currentTab);

                  if (filteredTrips.isEmpty) {
                    return _EmptyState(tab: currentTab);
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredTrips.length,
                    itemBuilder: (context, index) {
                      return _TripCard(
                        trip: filteredTrips[index],
                        onTap: () => context.push('/carrier/trips/${filteredTrips[index].id}'),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => _ErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(carrierTripsProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Trip> _filterTrips(List<Trip> trips, TripTab tab) {
    switch (tab) {
      case TripTab.readyToStart:
        return trips.where((t) => t.status == TripStatus.assigned).toList();
      case TripTab.active:
        return trips.where((t) =>
            t.status == TripStatus.pickupPending ||
            t.status == TripStatus.inTransit ||
            t.status == TripStatus.delivered).toList();
    }
  }
}

/// Tab bar widget
class _TabBar extends StatelessWidget {
  final TripTab currentTab;
  final Function(TripTab) onTabChanged;
  final AsyncValue<List<Trip>> tripsAsync;

  const _TabBar({
    required this.currentTab,
    required this.onTabChanged,
    required this.tripsAsync,
  });

  @override
  Widget build(BuildContext context) {
    final trips = tripsAsync.valueOrNull ?? [];
    final readyCount = trips.where((t) => t.status == TripStatus.assigned).length;
    final activeCount = trips.where((t) =>
        t.status == TripStatus.pickupPending ||
        t.status == TripStatus.inTransit ||
        t.status == TripStatus.delivered).length;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: _TabButton(
              label: 'Ready to Start',
              count: readyCount,
              isSelected: currentTab == TripTab.readyToStart,
              onTap: () => onTabChanged(TripTab.readyToStart),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _TabButton(
              label: 'Active Trips',
              count: activeCount,
              isSelected: currentTab == TripTab.active,
              onTap: () => onTabChanged(TripTab.active),
            ),
          ),
        ],
      ),
    );
  }
}

/// Tab button widget
class _TabButton extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final VoidCallback onTap;

  const _TabButton({
    required this.label,
    required this.count,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.slate100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : AppColors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white.withValues(alpha: 0.2) : AppColors.slate200,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                count.toString(),
                style: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Trip card widget
class _TripCard extends StatelessWidget {
  final Trip trip;
  final VoidCallback onTap;

  const _TripCard({
    required this.trip,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row with status
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Trip #${trip.id.substring(0, 8).toUpperCase()}',
                          style: TextStyle(
                            color: Colors.grey[600],
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          trip.routeDisplay,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _StatusBadge(status: trip.status),
                ],
              ),

              const SizedBox(height: 16),

              // Route details
              Row(
                children: [
                  Expanded(
                    child: _RoutePoint(
                      icon: Icons.radio_button_checked,
                      color: AppColors.primary,
                      city: trip.pickupCity ?? 'Pickup',
                      label: 'Pickup',
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Icon(Icons.arrow_forward, color: Colors.grey[400], size: 20),
                  ),
                  Expanded(
                    child: _RoutePoint(
                      icon: Icons.location_on,
                      color: AppColors.accent,
                      city: trip.deliveryCity ?? 'Delivery',
                      label: 'Delivery',
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 12),

              // Info row
              Row(
                children: [
                  if (trip.estimatedDistanceKm != null)
                    _InfoChip(
                      icon: Icons.straighten,
                      label: '${trip.estimatedDistanceKm!.toStringAsFixed(0)} km',
                    ),
                  if (trip.truck != null) ...[
                    const SizedBox(width: 12),
                    _InfoChip(
                      icon: Icons.local_shipping,
                      label: trip.truck!.licensePlate,
                    ),
                  ],
                  const Spacer(),
                  _QuickActionButton(trip: trip),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Status badge
class _StatusBadge extends StatelessWidget {
  final TripStatus status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final (label, color) = _getStatusInfo();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }

  (String, Color) _getStatusInfo() {
    switch (status) {
      case TripStatus.assigned:
        return ('Ready', Colors.amber);
      case TripStatus.pickupPending:
        return ('En Route', AppColors.primary);
      case TripStatus.inTransit:
        return ('In Transit', Colors.blue);
      case TripStatus.delivered:
        return ('Delivered', AppColors.success);
      case TripStatus.completed:
        return ('Completed', Colors.grey);
      case TripStatus.cancelled:
        return ('Cancelled', AppColors.error);
    }
  }
}

/// Route point
class _RoutePoint extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String city;
  final String label;

  const _RoutePoint({
    required this.icon,
    required this.color,
    required this.city,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: color, size: 16),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  color: Colors.grey[500],
                ),
              ),
              Text(
                city,
                style: const TextStyle(
                  fontWeight: FontWeight.w500,
                  fontSize: 13,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Info chip
class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip({
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.slate100,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.grey[600]),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey[700],
            ),
          ),
        ],
      ),
    );
  }
}

/// Quick action button based on status
class _QuickActionButton extends StatelessWidget {
  final Trip trip;

  const _QuickActionButton({required this.trip});

  @override
  Widget build(BuildContext context) {
    final (label, icon, color) = _getActionInfo();

    return TextButton.icon(
      onPressed: () => context.push('/carrier/trips/${trip.id}'),
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: TextButton.styleFrom(
        foregroundColor: color,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  (String, IconData, Color) _getActionInfo() {
    switch (trip.status) {
      case TripStatus.assigned:
        return ('Start Trip', Icons.play_arrow, AppColors.success);
      case TripStatus.pickupPending:
        return ('Confirm Pickup', Icons.check_circle, AppColors.primary);
      case TripStatus.inTransit:
        return ('Mark Delivered', Icons.local_shipping, Colors.blue);
      case TripStatus.delivered:
        return ('Upload POD', Icons.upload_file, AppColors.accent);
      default:
        return ('View Details', Icons.arrow_forward, AppColors.primary);
    }
  }
}

/// Empty state
class _EmptyState extends StatelessWidget {
  final TripTab tab;

  const _EmptyState({required this.tab});

  @override
  Widget build(BuildContext context) {
    final (title, subtitle, icon) = _getEmptyStateInfo();

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              title,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      ),
    );
  }

  (String, String, IconData) _getEmptyStateInfo() {
    switch (tab) {
      case TripTab.readyToStart:
        return (
          'No Trips Ready',
          'When loads are assigned to your trucks, they will appear here.',
          Icons.hourglass_empty,
        );
      case TripTab.active:
        return (
          'No Active Trips',
          'Start a trip from the "Ready to Start" tab to see it here.',
          Icons.local_shipping_outlined,
        );
    }
  }
}

/// Error state
class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[400]),
            const SizedBox(height: 16),
            const Text(
              'Failed to load trips',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
