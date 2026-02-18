import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/api/api_client.dart';

/// Trip progress model
class TripProgress {
  final int percent;
  final double? remainingKm;
  final double? totalDistanceKm;
  final double? travelledKm;
  final String? estimatedArrival;
  final bool isNearDestination;
  final String? lastUpdate;

  TripProgress({
    required this.percent,
    this.remainingKm,
    this.totalDistanceKm,
    this.travelledKm,
    this.estimatedArrival,
    required this.isNearDestination,
    this.lastUpdate,
  });

  factory TripProgress.fromJson(Map<String, dynamic> json) {
    return TripProgress(
      percent: json['percent'] ?? 0,
      remainingKm: json['remainingKm']?.toDouble(),
      totalDistanceKm: json['totalDistanceKm']?.toDouble(),
      travelledKm: json['travelledKm']?.toDouble(),
      estimatedArrival: json['estimatedArrival'],
      isNearDestination: json['isNearDestination'] ?? false,
      lastUpdate: json['lastUpdate'],
    );
  }
}

/// Shipment trip model
class ShipmentTrip {
  final String id;
  final String loadId;
  final String status;
  final TruckInfo truck;
  final CarrierInfo carrier;
  final LocationInfo? currentLocation;
  final LocationInfo pickupLocation;
  final LocationInfo deliveryLocation;
  final String? estimatedArrival;
  final DateTime? startedAt;

  ShipmentTrip({
    required this.id,
    required this.loadId,
    required this.status,
    required this.truck,
    required this.carrier,
    this.currentLocation,
    required this.pickupLocation,
    required this.deliveryLocation,
    this.estimatedArrival,
    this.startedAt,
  });

  factory ShipmentTrip.fromJson(Map<String, dynamic> json) {
    return ShipmentTrip(
      id: json['id'] ?? '',
      loadId: json['loadId'] ?? '',
      status: json['status'] ?? '',
      truck: TruckInfo.fromJson(json['truck'] ?? {}),
      carrier: CarrierInfo.fromJson(json['carrier'] ?? {}),
      currentLocation: json['currentLocation'] != null
          ? LocationInfo.fromJson(json['currentLocation'])
          : null,
      pickupLocation: LocationInfo.fromJson(json['pickupLocation'] ?? {}),
      deliveryLocation: LocationInfo.fromJson(json['deliveryLocation'] ?? {}),
      estimatedArrival: json['estimatedArrival'],
      startedAt: json['startedAt'] != null
          ? DateTime.parse(json['startedAt'])
          : null,
    );
  }

  bool get isInTransit => status == 'IN_TRANSIT';
  bool get isDelivered => status == 'DELIVERED' || status == 'COMPLETED';
}

class TruckInfo {
  final String id;
  final String plateNumber;
  final String truckType;

  TruckInfo({
    required this.id,
    required this.plateNumber,
    required this.truckType,
  });

  factory TruckInfo.fromJson(Map<String, dynamic> json) {
    return TruckInfo(
      id: json['id'] ?? '',
      plateNumber: json['plateNumber'] ?? 'Unknown',
      truckType: json['truckType'] ?? 'Unknown',
    );
  }
}

class CarrierInfo {
  final String name;
  final String? phone;

  CarrierInfo({required this.name, this.phone});

  factory CarrierInfo.fromJson(Map<String, dynamic> json) {
    return CarrierInfo(
      name: json['name'] ?? 'Unknown',
      phone: json['phone'],
    );
  }
}

class LocationInfo {
  final double lat;
  final double lng;
  final String? address;
  final String? updatedAt;

  LocationInfo({
    required this.lat,
    required this.lng,
    this.address,
    this.updatedAt,
  });

  factory LocationInfo.fromJson(Map<String, dynamic> json) {
    return LocationInfo(
      lat: json['lat']?.toDouble() ?? 0.0,
      lng: json['lng']?.toDouble() ?? 0.0,
      address: json['address'],
      updatedAt: json['updatedAt'],
    );
  }
}

/// Provider for active shipment trips
final shipmentTripsProvider =
    FutureProvider.autoDispose<List<ShipmentTrip>>((ref) async {
  final apiClient = ApiClient();
  try {
    final response = await apiClient.dio.get('/api/map/trips?role=shipper');
    if (response.statusCode == 200) {
      final trips = (response.data['trips'] as List? ?? [])
          .map((json) => ShipmentTrip.fromJson(json))
          .toList();
      return trips;
    }
    return [];
  } catch (e) {
    return [];
  }
});

/// Provider for selected trip
final selectedTripProvider = StateProvider<ShipmentTrip?>((ref) => null);

/// Shipper Map Screen - Track shipments in real-time
class ShipperMapScreen extends ConsumerStatefulWidget {
  const ShipperMapScreen({super.key});

  @override
  ConsumerState<ShipperMapScreen> createState() => _ShipperMapScreenState();
}

class _ShipperMapScreenState extends ConsumerState<ShipperMapScreen> {
  TripProgress? _progress;
  bool _loadingProgress = false;

  @override
  void initState() {
    super.initState();
    // Auto-select first trip when data loads
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _autoSelectFirstTrip();
    });
  }

  void _autoSelectFirstTrip() {
    final tripsAsync = ref.read(shipmentTripsProvider);
    tripsAsync.whenData((trips) {
      if (trips.isNotEmpty && ref.read(selectedTripProvider) == null) {
        ref.read(selectedTripProvider.notifier).state = trips.first;
        _fetchProgress(trips.first.loadId);
      }
    });
  }

  Future<void> _fetchProgress(String loadId) async {
    setState(() => _loadingProgress = true);
    try {
      final apiClient = ApiClient();
      final response = await apiClient.dio.get('/api/loads/$loadId/progress');
      if (response.statusCode == 200 && response.data['progress'] != null) {
        setState(() {
          _progress = TripProgress.fromJson(response.data['progress']);
        });
      }
    } catch (e) {
      // Silently fail - progress is optional
    } finally {
      setState(() => _loadingProgress = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tripsAsync = ref.watch(shipmentTripsProvider);
    final selectedTrip = ref.watch(selectedTripProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Track Shipments'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(shipmentTripsProvider);
              if (selectedTrip != null) {
                _fetchProgress(selectedTrip.loadId);
              }
            },
          ),
        ],
      ),
      body: tripsAsync.when(
        data: (trips) {
          if (trips.isEmpty) {
            return _EmptyState();
          }

          return Stack(
            children: [
              // Map placeholder
              Container(
                color: AppColors.slate100,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.map, size: 64, color: Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'Map will be displayed here',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                      const SizedBox(height: 8),
                      if (selectedTrip != null && selectedTrip.isInTransit)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.success.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: AppColors.success,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Text(
                                'Live Tracking Active',
                                style: TextStyle(
                                  color: AppColors.success,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // Bottom sheet with trip details
              DraggableScrollableSheet(
                initialChildSize: 0.45,
                minChildSize: 0.15,
                maxChildSize: 0.85,
                builder: (context, scrollController) {
                  return Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(20),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 10,
                          offset: const Offset(0, -2),
                        ),
                      ],
                    ),
                    child: ListView(
                      controller: scrollController,
                      padding: EdgeInsets.zero,
                      children: [
                        // Handle
                        Center(
                          child: Container(
                            margin: const EdgeInsets.symmetric(vertical: 12),
                            width: 40,
                            height: 4,
                            decoration: BoxDecoration(
                              color: Colors.grey[300],
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),

                        // Trip selector
                        if (trips.length > 1) ...[
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: trips.map((trip) {
                                  final isSelected =
                                      selectedTrip?.id == trip.id;
                                  return Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: ChoiceChip(
                                      label: Text(
                                        'Load #${trip.loadId.substring(trip.loadId.length - 6)}',
                                      ),
                                      selected: isSelected,
                                      onSelected: (_) {
                                        ref
                                            .read(selectedTripProvider.notifier)
                                            .state = trip;
                                        if (trip.isInTransit) {
                                          _fetchProgress(trip.loadId);
                                        }
                                      },
                                      selectedColor: AppColors.primary100,
                                      labelStyle: TextStyle(
                                        color: isSelected
                                            ? AppColors.primary
                                            : AppColors.textSecondary,
                                        fontWeight: isSelected
                                            ? FontWeight.w600
                                            : FontWeight.normal,
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        if (selectedTrip != null) ...[
                          // Status and carrier info
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: _TripInfoCard(trip: selectedTrip),
                          ),
                          const SizedBox(height: 16),

                          // Progress bar (only for IN_TRANSIT)
                          if (selectedTrip.isInTransit && _progress != null)
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 16),
                              child: _ProgressCard(
                                progress: _progress!,
                                isLoading: _loadingProgress,
                              ),
                            ),

                          const SizedBox(height: 16),

                          // Pickup & Delivery locations
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: _LocationsCard(trip: selectedTrip),
                          ),

                          const SizedBox(height: 24),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red[400]),
              const SizedBox(height: 16),
              const Text('Failed to load shipments'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(shipmentTripsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Trip info card
class _TripInfoCard extends StatelessWidget {
  final ShipmentTrip trip;

  const _TripInfoCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _StatusBadge(status: trip.status),
                const Spacer(),
                if (trip.isInTransit)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: AppColors.success,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          'GPS Active',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _InfoItem(
                    icon: Icons.business,
                    label: 'Carrier',
                    value: trip.carrier.name,
                  ),
                ),
                Expanded(
                  child: _InfoItem(
                    icon: Icons.local_shipping,
                    label: 'Truck',
                    value: trip.truck.plateNumber,
                  ),
                ),
              ],
            ),
            if (trip.estimatedArrival != null) ...[
              const SizedBox(height: 12),
              _InfoItem(
                icon: Icons.schedule,
                label: 'ETA',
                value: _formatETA(trip.estimatedArrival!),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatETA(String eta) {
    try {
      final date = DateTime.parse(eta);
      return DateFormat('MMM d, h:mm a').format(date);
    } catch (e) {
      return eta;
    }
  }
}

/// Status badge
class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    IconData icon;
    String label;

    switch (status.toUpperCase()) {
      case 'IN_TRANSIT':
        color = AppColors.primary;
        icon = Icons.local_shipping;
        label = 'In Transit';
        break;
      case 'DELIVERED':
      case 'COMPLETED':
        color = AppColors.success;
        icon = Icons.check_circle;
        label = 'Delivered';
        break;
      case 'AT_PICKUP':
        color = AppColors.warning;
        icon = Icons.location_on;
        label = 'At Pickup';
        break;
      default:
        color = Colors.grey;
        icon = Icons.schedule;
        label = status.replaceAll('_', ' ');
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

/// Info item
class _InfoItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
            Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Progress card
class _ProgressCard extends StatelessWidget {
  final TripProgress progress;
  final bool isLoading;

  const _ProgressCard({required this.progress, required this.isLoading});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'Trip Progress',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                const Spacer(),
                if (isLoading)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 16),

            // Progress bar
            Row(
              children: [
                Text(
                  progress.travelledKm != null
                      ? '${progress.travelledKm!.toStringAsFixed(1)} km'
                      : 'In progress',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const Spacer(),
                Text(
                  '${progress.percent}%',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress.percent / 100,
                backgroundColor: AppColors.slate200,
                valueColor:
                    const AlwaysStoppedAnimation<Color>(AppColors.primary),
                minHeight: 8,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Pickup',
                  style: TextStyle(fontSize: 10, color: AppColors.textSecondary),
                ),
                if (progress.remainingKm != null)
                  Text(
                    '${progress.remainingKm!.toStringAsFixed(1)} km remaining',
                    style: const TextStyle(
                        fontSize: 10, color: AppColors.textSecondary),
                  ),
                const Text(
                  'Delivery',
                  style: TextStyle(fontSize: 10, color: AppColors.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Stats row
            Row(
              children: [
                Expanded(
                  child: _ProgressStat(
                    label: 'Complete',
                    value: '${progress.percent}%',
                    color: AppColors.primary,
                  ),
                ),
                Expanded(
                  child: _ProgressStat(
                    label: 'Remaining',
                    value: progress.remainingKm != null
                        ? '${progress.remainingKm!.toStringAsFixed(1)} km'
                        : '--',
                    color: AppColors.textPrimary,
                  ),
                ),
                Expanded(
                  child: _ProgressStat(
                    label: 'ETA',
                    value: _formatETA(progress.estimatedArrival),
                    color: AppColors.success,
                  ),
                ),
              ],
            ),

            // Near destination alert
            if (progress.isNearDestination) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppColors.success.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.success,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Approaching destination!',
                      style: TextStyle(
                        color: AppColors.success,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatETA(String? eta) {
    if (eta == null) return '--';
    try {
      final date = DateTime.parse(eta);
      return DateFormat('h:mm a').format(date);
    } catch (e) {
      return '--';
    }
  }
}

/// Progress stat
class _ProgressStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _ProgressStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.slate100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

/// Locations card
class _LocationsCard extends StatelessWidget {
  final ShipmentTrip trip;

  const _LocationsCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Pickup
            _LocationRow(
              icon: Icons.radio_button_checked,
              iconColor: AppColors.success,
              label: 'Pickup',
              address: trip.pickupLocation.address ?? 'Address not available',
            ),
            Container(
              margin: const EdgeInsets.only(left: 10, top: 4, bottom: 4),
              width: 1,
              height: 24,
              color: AppColors.slate300,
            ),
            // Delivery
            _LocationRow(
              icon: Icons.location_on,
              iconColor: AppColors.error,
              label: 'Delivery',
              address:
                  trip.deliveryLocation.address ?? 'Address not available',
            ),
          ],
        ),
      ),
    );
  }
}

/// Location row
class _LocationRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String address;

  const _LocationRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.address,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: iconColor),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                address,
                style: const TextStyle(fontSize: 14),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Empty state
class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.slate100,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(
                Icons.map_outlined,
                size: 48,
                color: Colors.grey[400],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'No Active Shipments',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Map tracking becomes available when your load is approved and the carrier starts the trip.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.grey[600],
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
