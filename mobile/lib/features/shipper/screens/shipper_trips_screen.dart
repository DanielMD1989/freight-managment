import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/trip.dart';
import '../../../core/services/trip_service.dart';

/// Provider for shipper's trips list
final shipperTripsProvider = FutureProvider.autoDispose<List<Trip>>((ref) async {
  final service = TripService();
  final result = await service.getTrips(limit: 100);
  return result.success ? result.data ?? [] : [];
});

/// Filter state for shipper trips
enum ShipperTripFilter { all, active, delivered, completed }

final shipperTripFilterProvider =
    StateProvider<ShipperTripFilter>((ref) => ShipperTripFilter.all);

/// Shipper Trips List Screen
class ShipperTripsScreen extends ConsumerWidget {
  const ShipperTripsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsAsync = ref.watch(shipperTripsProvider);
    final filter = ref.watch(shipperTripFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Shipments'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(shipperTripsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter chips
          _FilterSection(
            filter: filter,
            onFilterChanged: (f) =>
                ref.read(shipperTripFilterProvider.notifier).state = f,
            tripsAsync: tripsAsync,
          ),

          // Content
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(shipperTripsProvider),
              child: tripsAsync.when(
                data: (trips) {
                  final filteredTrips = _filterTrips(trips, filter);

                  if (filteredTrips.isEmpty) {
                    return _EmptyState(filter: filter);
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: filteredTrips.length,
                    itemBuilder: (context, index) {
                      return _ShipmentCard(
                        trip: filteredTrips[index],
                        onTap: () =>
                            context.push('/shipper/trips/${filteredTrips[index].id}'),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => _ErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(shipperTripsProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Trip> _filterTrips(List<Trip> trips, ShipperTripFilter filter) {
    switch (filter) {
      case ShipperTripFilter.all:
        return trips;
      case ShipperTripFilter.active:
        return trips.where((t) =>
            t.status == TripStatus.assigned ||
            t.status == TripStatus.pickupPending ||
            t.status == TripStatus.inTransit).toList();
      case ShipperTripFilter.delivered:
        return trips.where((t) => t.status == TripStatus.delivered).toList();
      case ShipperTripFilter.completed:
        return trips.where((t) => t.status == TripStatus.completed).toList();
    }
  }
}

/// Filter section
class _FilterSection extends StatelessWidget {
  final ShipperTripFilter filter;
  final Function(ShipperTripFilter) onFilterChanged;
  final AsyncValue<List<Trip>> tripsAsync;

  const _FilterSection({
    required this.filter,
    required this.onFilterChanged,
    required this.tripsAsync,
  });

  @override
  Widget build(BuildContext context) {
    final trips = tripsAsync.valueOrNull ?? [];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _FilterChip(
              label: 'All',
              count: trips.length,
              isSelected: filter == ShipperTripFilter.all,
              onTap: () => onFilterChanged(ShipperTripFilter.all),
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Active',
              count: trips.where((t) =>
                  t.status == TripStatus.assigned ||
                  t.status == TripStatus.pickupPending ||
                  t.status == TripStatus.inTransit).length,
              isSelected: filter == ShipperTripFilter.active,
              onTap: () => onFilterChanged(ShipperTripFilter.active),
              color: Colors.blue,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Delivered',
              count: trips.where((t) => t.status == TripStatus.delivered).length,
              isSelected: filter == ShipperTripFilter.delivered,
              onTap: () => onFilterChanged(ShipperTripFilter.delivered),
              color: AppColors.accent,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Completed',
              count: trips.where((t) => t.status == TripStatus.completed).length,
              isSelected: filter == ShipperTripFilter.completed,
              onTap: () => onFilterChanged(ShipperTripFilter.completed),
              color: AppColors.success,
            ),
          ],
        ),
      ),
    );
  }
}

/// Filter chip
class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final VoidCallback onTap;
  final Color? color;

  const _FilterChip({
    required this.label,
    required this.count,
    required this.isSelected,
    required this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final chipColor = color ?? AppColors.primary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          constraints: const BoxConstraints(minHeight: 48), // Minimum touch target
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? chipColor : chipColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : chipColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white.withOpacity(0.25) : chipColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  count.toString(),
                  style: TextStyle(
                    color: isSelected ? Colors.white : chipColor,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shipment card
class _ShipmentCard extends StatelessWidget {
  final Trip trip;
  final VoidCallback onTap;

  const _ShipmentCard({
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
              // Header with status
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Shipment #${trip.id.substring(0, 8).toUpperCase()}',
                          style: TextStyle(color: Colors.grey[600], fontSize: 12),
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

              // Progress indicator for active trips
              if (trip.isActive) ...[
                _ShipmentProgress(trip: trip),
                const SizedBox(height: 16),
              ],

              // Info row
              Row(
                children: [
                  _InfoItem(
                    icon: Icons.calendar_today,
                    label: trip.deliveredAt != null
                        ? DateFormat('MMM d').format(trip.deliveredAt!)
                        : DateFormat('MMM d').format(trip.createdAt),
                  ),
                  const SizedBox(width: 16),
                  if (trip.estimatedDistanceKm != null)
                    _InfoItem(
                      icon: Icons.straighten,
                      label: '${trip.estimatedDistanceKm!.toStringAsFixed(0)} km',
                    ),
                  const Spacer(),
                  _ActionButton(trip: trip, onTap: onTap),
                ],
              ),

              // Carrier info for active/delivered trips
              if (trip.carrier != null &&
                  (trip.isActive || trip.status == TripStatus.delivered)) ...[
                const SizedBox(height: 12),
                const Divider(),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.local_shipping, size: 16, color: Colors.grey[600]),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        trip.carrier!.name,
                        style: TextStyle(color: Colors.grey[700], fontSize: 13),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    if (trip.carrier!.isVerified) ...[
                      const SizedBox(width: 4),
                      Icon(Icons.verified, size: 14, color: AppColors.primary),
                    ],
                    if (trip.truck != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        trip.truck!.licensePlate,
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
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
        color: color.withOpacity(0.15),
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
        return ('Awaiting Pickup', Colors.amber);
      case TripStatus.pickupPending:
        return ('Driver En Route', AppColors.primary);
      case TripStatus.inTransit:
        return ('In Transit', Colors.blue);
      case TripStatus.delivered:
        return ('Delivered', AppColors.accent);
      case TripStatus.completed:
        return ('Completed', AppColors.success);
      case TripStatus.cancelled:
        return ('Cancelled', AppColors.error);
    }
  }
}

/// Shipment progress
class _ShipmentProgress extends StatelessWidget {
  final Trip trip;

  const _ShipmentProgress({required this.trip});

  @override
  Widget build(BuildContext context) {
    final progress = _calculateProgress();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              _getProgressLabel(),
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
            Text(
              '${(progress * 100).toInt()}%',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: progress,
          backgroundColor: AppColors.slate200,
          valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
          minHeight: 6,
          borderRadius: BorderRadius.circular(3),
        ),
      ],
    );
  }

  double _calculateProgress() {
    switch (trip.status) {
      case TripStatus.assigned:
        return 0.1;
      case TripStatus.pickupPending:
        return 0.35;
      case TripStatus.inTransit:
        return 0.7;
      case TripStatus.delivered:
        return 0.9;
      case TripStatus.completed:
        return 1.0;
      case TripStatus.cancelled:
        return 0.0;
    }
  }

  String _getProgressLabel() {
    switch (trip.status) {
      case TripStatus.assigned:
        return 'Waiting for driver';
      case TripStatus.pickupPending:
        return 'Driver heading to pickup';
      case TripStatus.inTransit:
        return 'On the way to destination';
      case TripStatus.delivered:
        return 'Awaiting confirmation';
      case TripStatus.completed:
        return 'Shipment complete';
      case TripStatus.cancelled:
        return 'Shipment cancelled';
    }
  }
}

/// Info item
class _InfoItem extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoItem({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.grey[600]),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(fontSize: 12, color: Colors.grey[700]),
        ),
      ],
    );
  }
}

/// Action button based on status
class _ActionButton extends StatelessWidget {
  final Trip trip;
  final VoidCallback onTap;

  const _ActionButton({required this.trip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final (label, icon, color) = _getActionInfo();

    return TextButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: TextButton.styleFrom(
        foregroundColor: color,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  (String, IconData, Color) _getActionInfo() {
    switch (trip.status) {
      case TripStatus.inTransit:
        return ('Track', Icons.gps_fixed, AppColors.primary);
      case TripStatus.delivered:
        return ('View POD', Icons.description, AppColors.accent);
      case TripStatus.completed:
        return ('Details', Icons.receipt_long, AppColors.success);
      default:
        return ('View', Icons.arrow_forward, AppColors.primary);
    }
  }
}

/// Empty state
class _EmptyState extends StatelessWidget {
  final ShipperTripFilter filter;

  const _EmptyState({required this.filter});

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
    switch (filter) {
      case ShipperTripFilter.all:
        return (
          'No Shipments Yet',
          'Post a load to get started with your first shipment.',
          Icons.local_shipping_outlined,
        );
      case ShipperTripFilter.active:
        return (
          'No Active Shipments',
          'Your in-progress shipments will appear here.',
          Icons.hourglass_empty,
        );
      case ShipperTripFilter.delivered:
        return (
          'No Delivered Shipments',
          'Shipments awaiting your confirmation will appear here.',
          Icons.inbox_outlined,
        );
      case ShipperTripFilter.completed:
        return (
          'No Completed Shipments',
          'Your completed shipment history will appear here.',
          Icons.check_circle_outline,
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
              'Failed to load shipments',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
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
