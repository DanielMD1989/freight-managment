import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../app.dart';
import '../../../core/models/trip.dart';
import '../../../core/services/trip_service.dart';
import '../../../core/api/api_client.dart';
import 'shipper_trips_screen.dart';

/// Provider for fetching a single trip by ID for shipper
final shipperTripDetailProvider =
    FutureProvider.family.autoDispose<Trip?, String>((ref, tripId) async {
  final service = TripService();
  final result = await service.getTripById(tripId);
  return result.success ? result.data : null;
});

/// Provider for trip POD documents
final tripPodsProvider =
    FutureProvider.family.autoDispose<List<TripPod>, String>((ref, tripId) async {
  final service = TripService();
  final result = await service.getTripPods(tripId);
  return result.success ? result.data ?? [] : [];
});

/// Shipper Trip Details Screen
class ShipperTripDetailsScreen extends ConsumerStatefulWidget {
  final String tripId;

  const ShipperTripDetailsScreen({super.key, required this.tripId});

  @override
  ConsumerState<ShipperTripDetailsScreen> createState() =>
      _ShipperTripDetailsScreenState();
}

class _ShipperTripDetailsScreenState
    extends ConsumerState<ShipperTripDetailsScreen> {
  bool _isConfirming = false;

  Future<void> _confirmDelivery() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Delivery'),
        content: const Text(
          'By confirming, you acknowledge that the shipment was received in good condition. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm Delivery'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isConfirming = true);

    try {
      final apiClient = ApiClient();
      final response = await apiClient.dio.post(
        '/api/trips/${widget.tripId}/confirm',
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Delivery confirmed successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
        ref.invalidate(shipperTripDetailProvider(widget.tripId));
        ref.invalidate(shipperTripsProvider);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(response.data['error'] ?? 'Failed to confirm delivery'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isConfirming = false);
    }
  }

  Future<void> _callCarrier(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tripAsync = ref.watch(shipperTripDetailProvider(widget.tripId));
    final podsAsync = ref.watch(tripPodsProvider(widget.tripId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Shipment Details'),
      ),
      body: tripAsync.when(
        data: (trip) {
          if (trip == null) {
            return const Center(child: Text('Shipment not found'));
          }
          return _buildTripDetails(trip, podsAsync);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red[400]),
              const SizedBox(height: 16),
              Text('Failed to load shipment: $error'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () =>
                    ref.invalidate(shipperTripDetailProvider(widget.tripId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTripDetails(Trip trip, AsyncValue<List<TripPod>> podsAsync) {
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(shipperTripDetailProvider(widget.tripId));
        ref.invalidate(tripPodsProvider(widget.tripId));
      },
      child: SafeArea(
        top: false, // AppBar handles top safe area
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
          // Status card with progress
          _StatusCard(trip: trip),
          const SizedBox(height: 16),

          // Confirmation button for delivered trips
          if (trip.status == TripStatus.delivered && !trip.shipperConfirmed)
            _ConfirmationSection(
              isConfirming: _isConfirming,
              onConfirm: _confirmDelivery,
            ),
          if (trip.status == TripStatus.delivered && !trip.shipperConfirmed)
            const SizedBox(height: 16),

          // Tracking section for active trips
          if (trip.isActive) ...[
            _TrackingSection(trip: trip),
            const SizedBox(height: 16),
          ],

          // Route information
          _RouteSection(trip: trip),
          const SizedBox(height: 16),

          // Carrier information (visible after pickup)
          if (trip.status != TripStatus.assigned) ...[
            _CarrierSection(
              trip: trip,
              onCall: trip.carrier?.contactPhone != null
                  ? () => _callCarrier(trip.carrier!.contactPhone!)
                  : null,
            ),
            const SizedBox(height: 16),
          ],

          // POD section for delivered/completed trips
          if (trip.status == TripStatus.delivered ||
              trip.status == TripStatus.completed)
            _PodSection(podsAsync: podsAsync),
          if (trip.status == TripStatus.delivered ||
              trip.status == TripStatus.completed)
            const SizedBox(height: 16),

          // Receiver information (if delivered)
          if (trip.receiverName != null) ...[
            _ReceiverSection(trip: trip),
            const SizedBox(height: 16),
          ],

          // Timeline
          _TimelineSection(trip: trip),
          const SizedBox(height: 32),
        ],
        ),
      ),
    );
  }
}

/// Status card with progress
class _StatusCard extends StatelessWidget {
  final Trip trip;

  const _StatusCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: _getStatusColor().withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    _getStatusIcon(),
                    size: 32,
                    color: _getStatusColor(),
                  ),
                ),
                const SizedBox(width: 16),
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
                        trip.statusDisplay,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: _getStatusColor(),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Progress bar
            _ShipmentProgressBar(trip: trip),

            const SizedBox(height: 12),

            // Progress labels
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Pickup', style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                Text('In Transit', style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                Text('Delivered', style: TextStyle(fontSize: 10, color: Colors.grey[600])),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor() {
    switch (trip.status) {
      case TripStatus.assigned:
        return Colors.amber;
      case TripStatus.pickupPending:
        return AppColors.primary;
      case TripStatus.inTransit:
        return Colors.blue;
      case TripStatus.delivered:
        return AppColors.accent;
      case TripStatus.completed:
        return AppColors.success;
      case TripStatus.cancelled:
        return AppColors.error;
    }
  }

  IconData _getStatusIcon() {
    switch (trip.status) {
      case TripStatus.assigned:
        return Icons.schedule;
      case TripStatus.pickupPending:
        return Icons.directions_car;
      case TripStatus.inTransit:
        return Icons.local_shipping;
      case TripStatus.delivered:
        return Icons.inventory;
      case TripStatus.completed:
        return Icons.check_circle;
      case TripStatus.cancelled:
        return Icons.cancel;
    }
  }
}

/// Shipment progress bar
class _ShipmentProgressBar extends StatelessWidget {
  final Trip trip;

  const _ShipmentProgressBar({required this.trip});

  @override
  Widget build(BuildContext context) {
    final progress = _calculateProgress();

    return LinearProgressIndicator(
      value: progress,
      backgroundColor: AppColors.slate200,
      valueColor: AlwaysStoppedAnimation<Color>(
        trip.status == TripStatus.cancelled ? AppColors.error : AppColors.primary,
      ),
      minHeight: 8,
      borderRadius: BorderRadius.circular(4),
    );
  }

  double _calculateProgress() {
    switch (trip.status) {
      case TripStatus.assigned:
        return 0.1;
      case TripStatus.pickupPending:
        return 0.33;
      case TripStatus.inTransit:
        return 0.66;
      case TripStatus.delivered:
      case TripStatus.completed:
        return 1.0;
      case TripStatus.cancelled:
        return 0.0;
    }
  }
}

/// Confirmation section
class _ConfirmationSection extends StatelessWidget {
  final bool isConfirming;
  final VoidCallback onConfirm;

  const _ConfirmationSection({
    required this.isConfirming,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppColors.accent.withValues(alpha: 0.05),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.task_alt, color: AppColors.accent),
                SizedBox(width: 8),
                Text(
                  'Action Required',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Your shipment has been delivered. Please review the proof of delivery and confirm receipt.',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: isConfirming ? null : onConfirm,
                icon: isConfirming
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check),
                label: Text(isConfirming ? 'Confirming...' : 'Confirm Delivery'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tracking section
class _TrackingSection extends StatelessWidget {
  final Trip trip;

  const _TrackingSection({required this.trip});

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
                const Icon(Icons.gps_fixed, size: 20, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
                  'Live Tracking',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                if (trip.trackingEnabled)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
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
                        const SizedBox(width: 4),
                        const Text(
                          'Active',
                          style: TextStyle(
                            fontSize: 11,
                            color: AppColors.success,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),

            // Current location
            if (trip.currentLat != null && trip.currentLng != null) ...[
              Row(
                children: [
                  Icon(Icons.my_location, size: 16, color: Colors.grey[600]),
                  const SizedBox(width: 8),
                  Text(
                    'Last known: ${trip.currentLat!.toStringAsFixed(4)}, ${trip.currentLng!.toStringAsFixed(4)}',
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
              if (trip.currentLocationUpdatedAt != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Updated ${_formatTimeAgo(trip.currentLocationUpdatedAt!)}',
                  style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                ),
              ],
              const SizedBox(height: 16),
            ],

            // ETA if available
            if (trip.estimatedDistanceKm != null) ...[
              Row(
                children: [
                  Expanded(
                    child: _TrackingStat(
                      icon: Icons.straighten,
                      label: 'Distance',
                      value: '${trip.estimatedDistanceKm!.toStringAsFixed(0)} km',
                    ),
                  ),
                  if (trip.estimatedDurationMin != null)
                    Expanded(
                      child: _TrackingStat(
                        icon: Icons.schedule,
                        label: 'Est. Time',
                        value: '${(trip.estimatedDurationMin! / 60).toStringAsFixed(1)} hrs',
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatTimeAgo(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return DateFormat('MMM d').format(time);
  }
}

/// Tracking stat
class _TrackingStat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _TrackingStat({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Colors.grey[600]),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(fontSize: 11, color: Colors.grey[500]),
            ),
            Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ],
    );
  }
}

/// Route section
class _RouteSection extends StatelessWidget {
  final Trip trip;

  const _RouteSection({required this.trip});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.route, size: 20, color: AppColors.primary),
                SizedBox(width: 8),
                Text(
                  'Route',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Pickup
            _LocationRow(
              icon: Icons.radio_button_checked,
              color: AppColors.primary,
              title: 'Pickup',
              city: trip.pickupCity ?? 'N/A',
              address: trip.pickupAddress,
            ),
            Container(
              margin: const EdgeInsets.only(left: 11, top: 8, bottom: 8),
              width: 2,
              height: 24,
              color: AppColors.slate200,
            ),

            // Delivery
            _LocationRow(
              icon: Icons.location_on,
              color: AppColors.accent,
              title: 'Delivery',
              city: trip.deliveryCity ?? 'N/A',
              address: trip.deliveryAddress,
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
  final Color color;
  final String title;
  final String city;
  final String? address;

  const _LocationRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.city,
    this.address,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
              Text(city, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              if (address != null)
                Text(address!, style: TextStyle(fontSize: 13, color: Colors.grey[600])),
            ],
          ),
        ),
      ],
    );
  }
}

/// Carrier section
class _CarrierSection extends StatelessWidget {
  final Trip trip;
  final VoidCallback? onCall;

  const _CarrierSection({required this.trip, this.onCall});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.local_shipping, size: 20, color: AppColors.primary),
                SizedBox(width: 8),
                Text(
                  'Carrier',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (trip.carrier != null) ...[
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.business, color: AppColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              trip.carrier!.name,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            if (trip.carrier!.isVerified) ...[
                              const SizedBox(width: 4),
                              const Icon(Icons.verified, size: 16, color: AppColors.primary),
                            ],
                          ],
                        ),
                        if (trip.truck != null)
                          Text(
                            '${trip.truck!.truckTypeDisplay} - ${trip.truck!.licensePlate}',
                            style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                          ),
                      ],
                    ),
                  ),
                  if (onCall != null)
                    SizedBox(
                      width: 48, // Minimum touch target
                      height: 48, // Minimum touch target
                      child: IconButton(
                        onPressed: onCall,
                        icon: const Icon(Icons.phone),
                        style: IconButton.styleFrom(
                          backgroundColor: AppColors.success.withValues(alpha: 0.1),
                          foregroundColor: AppColors.success,
                          minimumSize: const Size(48, 48),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// POD section
class _PodSection extends StatelessWidget {
  final AsyncValue<List<TripPod>> podsAsync;

  const _PodSection({required this.podsAsync});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.description, size: 20, color: AppColors.primary),
                SizedBox(width: 8),
                Text(
                  'Proof of Delivery',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),

            podsAsync.when(
              data: (pods) {
                if (pods.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.slate100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.hourglass_empty, color: Colors.grey[600]),
                        const SizedBox(width: 12),
                        const Text('Waiting for carrier to upload POD'),
                      ],
                    ),
                  );
                }

                return Column(
                  children: pods.map((pod) => _PodItem(pod: pod)).toList(),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Text('Failed to load PODs: $e'),
            ),
          ],
        ),
      ),
    );
  }
}

/// POD item
class _PodItem extends StatelessWidget {
  final TripPod pod;

  const _PodItem({required this.pod});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              pod.isImage ? Icons.image : Icons.picture_as_pdf,
              color: AppColors.success,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pod.fileName,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  DateFormat('MMM d, yyyy h:mm a').format(pod.uploadedAt),
                  style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                ),
              ],
            ),
          ),
          const Icon(Icons.check_circle, color: AppColors.success, size: 20),
        ],
      ),
    );
  }
}

/// Receiver section
class _ReceiverSection extends StatelessWidget {
  final Trip trip;

  const _ReceiverSection({required this.trip});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.person_pin, size: 20, color: AppColors.primary),
                SizedBox(width: 8),
                Text(
                  'Receiver',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _DetailRow(label: 'Name', value: trip.receiverName ?? 'N/A'),
            _DetailRow(label: 'Phone', value: trip.receiverPhone ?? 'N/A'),
            if (trip.deliveryNotes != null && trip.deliveryNotes!.isNotEmpty)
              _DetailRow(label: 'Notes', value: trip.deliveryNotes!),
          ],
        ),
      ),
    );
  }
}

/// Detail row
class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(label, style: TextStyle(color: Colors.grey[600])),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

/// Timeline section
class _TimelineSection extends StatelessWidget {
  final Trip trip;

  const _TimelineSection({required this.trip});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.timeline, size: 20, color: AppColors.primary),
                SizedBox(width: 8),
                Text(
                  'Timeline',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _TimelineItem(
              title: 'Shipment Created',
              time: trip.createdAt,
              isCompleted: true,
            ),
            if (trip.startedAt != null)
              _TimelineItem(
                title: 'Driver Started',
                time: trip.startedAt!,
                isCompleted: true,
              ),
            if (trip.pickedUpAt != null)
              _TimelineItem(
                title: 'Cargo Picked Up',
                time: trip.pickedUpAt!,
                isCompleted: true,
              ),
            if (trip.deliveredAt != null)
              _TimelineItem(
                title: 'Cargo Delivered',
                time: trip.deliveredAt!,
                isCompleted: true,
              ),
            if (trip.shipperConfirmedAt != null)
              _TimelineItem(
                title: 'Delivery Confirmed',
                time: trip.shipperConfirmedAt!,
                isCompleted: true,
                isLast: true,
              ),
            if (trip.completedAt != null && trip.shipperConfirmedAt == null)
              _TimelineItem(
                title: 'Shipment Completed',
                time: trip.completedAt!,
                isCompleted: true,
                isLast: true,
              ),
            if (trip.cancelledAt != null)
              _TimelineItem(
                title: 'Shipment Cancelled',
                subtitle: trip.cancelReason,
                time: trip.cancelledAt!,
                isCompleted: true,
                isLast: true,
                color: AppColors.error,
              ),
          ],
        ),
      ),
    );
  }
}

/// Timeline item
class _TimelineItem extends StatelessWidget {
  final String title;
  final String? subtitle;
  final DateTime time;
  final bool isCompleted;
  final bool isLast;
  final Color? color;

  const _TimelineItem({
    required this.title,
    this.subtitle,
    required this.time,
    required this.isCompleted,
    this.isLast = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final itemColor = color ?? (isCompleted ? AppColors.success : AppColors.slate400);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: itemColor,
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 40,
                color: AppColors.slate200,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontWeight: FontWeight.w600, color: itemColor),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                Text(
                  DateFormat('MMM d, yyyy h:mm a').format(time),
                  style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
