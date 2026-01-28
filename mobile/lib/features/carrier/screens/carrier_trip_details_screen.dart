import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/trip.dart';
import '../../../core/services/trip_service.dart';
import 'carrier_trips_screen.dart';

/// Provider for fetching a single trip by ID
final tripDetailProvider =
    FutureProvider.family.autoDispose<Trip?, String>((ref, tripId) async {
  final service = TripService();
  final result = await service.getTripById(tripId);
  return result.success ? result.data : null;
});

/// Carrier Trip Details Screen
class CarrierTripDetailsScreen extends ConsumerStatefulWidget {
  final String tripId;

  const CarrierTripDetailsScreen({super.key, required this.tripId});

  @override
  ConsumerState<CarrierTripDetailsScreen> createState() =>
      _CarrierTripDetailsScreenState();
}

class _CarrierTripDetailsScreenState
    extends ConsumerState<CarrierTripDetailsScreen> {
  final _tripService = TripService();
  bool _isUpdating = false;

  Future<void> _startTrip() async {
    setState(() => _isUpdating = true);
    try {
      final result = await _tripService.startTrip(widget.tripId);
      if (!mounted) return;

      if (result.success) {
        _showSuccess('Trip started! Head to the pickup location.');
        _refreshTrip();
      } else {
        _showError(result.error ?? 'Failed to start trip');
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  Future<void> _confirmPickup() async {
    setState(() => _isUpdating = true);
    try {
      final result = await _tripService.markPickedUp(widget.tripId);
      if (!mounted) return;

      if (result.success) {
        _showSuccess('Pickup confirmed! You are now in transit.');
        _refreshTrip();
      } else {
        _showError(result.error ?? 'Failed to confirm pickup');
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  Future<void> _markDelivered() async {
    final formData = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => _DeliveryFormDialog(),
    );

    if (formData == null) return;

    setState(() => _isUpdating = true);
    try {
      final result = await _tripService.markDelivered(
        tripId: widget.tripId,
        receiverName: formData['receiverName']!,
        receiverPhone: formData['receiverPhone']!,
        deliveryNotes: formData['deliveryNotes'],
      );

      if (!mounted) return;

      if (result.success) {
        _showSuccess('Delivery marked! Please upload proof of delivery.');
        _refreshTrip();
      } else {
        _showError(result.error ?? 'Failed to mark delivered');
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  Future<void> _cancelTrip() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => _CancelTripDialog(),
    );

    if (reason == null || reason.isEmpty) return;

    setState(() => _isUpdating = true);
    try {
      final result = await _tripService.cancelTrip(
        tripId: widget.tripId,
        reason: reason,
      );

      if (!mounted) return;

      if (result.success) {
        _showSuccess('Trip cancelled');
        context.pop();
      } else {
        _showError(result.error ?? 'Failed to cancel trip');
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  void _refreshTrip() {
    ref.invalidate(tripDetailProvider(widget.tripId));
    ref.invalidate(carrierTripsProvider);
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.success,
      ),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tripAsync = ref.watch(tripDetailProvider(widget.tripId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Trip Details'),
        actions: [
          tripAsync.maybeWhen(
            data: (trip) {
              if (trip == null || trip.status == TripStatus.completed ||
                  trip.status == TripStatus.cancelled) {
                return const SizedBox.shrink();
              }
              return IconButton(
                icon: const Icon(Icons.cancel_outlined),
                onPressed: _isUpdating ? null : _cancelTrip,
                tooltip: 'Cancel Trip',
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: tripAsync.when(
        data: (trip) {
          if (trip == null) {
            return const Center(child: Text('Trip not found'));
          }
          return _buildTripDetails(trip);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red[400]),
              const SizedBox(height: 16),
              Text('Failed to load trip: $error'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _refreshTrip,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTripDetails(Trip trip) {
    return RefreshIndicator(
      onRefresh: () async => _refreshTrip(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Status card
          _StatusCard(trip: trip),
          const SizedBox(height: 16),

          // Action button based on status
          _ActionSection(
            trip: trip,
            isUpdating: _isUpdating,
            onStartTrip: _startTrip,
            onConfirmPickup: _confirmPickup,
            onMarkDelivered: _markDelivered,
            onUploadPod: () => context.push('/carrier/trips/${trip.id}/pod'),
          ),
          const SizedBox(height: 16),

          // Route information
          _RouteSection(trip: trip),
          const SizedBox(height: 16),

          // Load details
          if (trip.load != null) ...[
            _LoadSection(load: trip.load!),
            const SizedBox(height: 16),
          ],

          // Truck information
          if (trip.truck != null) ...[
            _TruckSection(truck: trip.truck!),
            const SizedBox(height: 16),
          ],

          // Contact information (visible after IN_TRANSIT)
          if (trip.status == TripStatus.inTransit ||
              trip.status == TripStatus.delivered ||
              trip.status == TripStatus.completed) ...[
            _ContactSection(trip: trip),
            const SizedBox(height: 16),
          ],

          // Receiver info (if delivered)
          if (trip.receiverName != null) ...[
            _ReceiverSection(trip: trip),
            const SizedBox(height: 16),
          ],

          // Timeline
          _TimelineSection(trip: trip),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

/// Status card
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
                        'Trip #${trip.id.substring(0, 8).toUpperCase()}',
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
            const SizedBox(height: 16),
            // Progress indicator
            _ProgressIndicator(status: trip.status),
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
        return AppColors.success;
      case TripStatus.completed:
        return Colors.grey;
      case TripStatus.cancelled:
        return AppColors.error;
    }
  }

  IconData _getStatusIcon() {
    switch (trip.status) {
      case TripStatus.assigned:
        return Icons.assignment;
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

/// Progress indicator
class _ProgressIndicator extends StatelessWidget {
  final TripStatus status;

  const _ProgressIndicator({required this.status});

  @override
  Widget build(BuildContext context) {
    final steps = ['Assigned', 'En Route', 'In Transit', 'Delivered'];
    final currentStep = _getCurrentStep();

    return Row(
      children: List.generate(steps.length, (index) {
        final isCompleted = index < currentStep;
        final isCurrent = index == currentStep;

        return Expanded(
          child: Row(
            children: [
              if (index > 0)
                Expanded(
                  child: Container(
                    height: 2,
                    color: isCompleted ? AppColors.success : AppColors.slate200,
                  ),
                ),
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isCompleted
                      ? AppColors.success
                      : isCurrent
                          ? AppColors.primary
                          : AppColors.slate200,
                ),
                child: isCompleted
                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                    : isCurrent
                        ? Container(
                            margin: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white,
                            ),
                          )
                        : null,
              ),
              if (index < steps.length - 1)
                Expanded(
                  child: Container(
                    height: 2,
                    color: isCompleted ? AppColors.success : AppColors.slate200,
                  ),
                ),
            ],
          ),
        );
      }),
    );
  }

  int _getCurrentStep() {
    switch (status) {
      case TripStatus.assigned:
        return 0;
      case TripStatus.pickupPending:
        return 1;
      case TripStatus.inTransit:
        return 2;
      case TripStatus.delivered:
      case TripStatus.completed:
        return 3;
      case TripStatus.cancelled:
        return -1;
    }
  }
}

/// Action section with primary CTA
class _ActionSection extends StatelessWidget {
  final Trip trip;
  final bool isUpdating;
  final VoidCallback onStartTrip;
  final VoidCallback onConfirmPickup;
  final VoidCallback onMarkDelivered;
  final VoidCallback onUploadPod;

  const _ActionSection({
    required this.trip,
    required this.isUpdating,
    required this.onStartTrip,
    required this.onConfirmPickup,
    required this.onMarkDelivered,
    required this.onUploadPod,
  });

  @override
  Widget build(BuildContext context) {
    if (trip.status == TripStatus.completed ||
        trip.status == TripStatus.cancelled) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton.icon(
        onPressed: isUpdating ? null : _getAction(),
        icon: isUpdating
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : Icon(_getIcon()),
        label: Text(_getLabel()),
        style: ElevatedButton.styleFrom(
          backgroundColor: _getColor(),
        ),
      ),
    );
  }

  VoidCallback? _getAction() {
    switch (trip.status) {
      case TripStatus.assigned:
        return onStartTrip;
      case TripStatus.pickupPending:
        return onConfirmPickup;
      case TripStatus.inTransit:
        return onMarkDelivered;
      case TripStatus.delivered:
        return onUploadPod;
      default:
        return null;
    }
  }

  IconData _getIcon() {
    switch (trip.status) {
      case TripStatus.assigned:
        return Icons.play_arrow;
      case TripStatus.pickupPending:
        return Icons.check_circle;
      case TripStatus.inTransit:
        return Icons.local_shipping;
      case TripStatus.delivered:
        return Icons.upload_file;
      default:
        return Icons.check;
    }
  }

  String _getLabel() {
    switch (trip.status) {
      case TripStatus.assigned:
        return 'Start Trip';
      case TripStatus.pickupPending:
        return 'Confirm Pickup';
      case TripStatus.inTransit:
        return 'Mark Delivered';
      case TripStatus.delivered:
        return 'Upload Proof of Delivery';
      default:
        return 'Done';
    }
  }

  Color _getColor() {
    switch (trip.status) {
      case TripStatus.assigned:
        return AppColors.success;
      case TripStatus.pickupPending:
        return AppColors.primary;
      case TripStatus.inTransit:
        return Colors.blue;
      case TripStatus.delivered:
        return AppColors.accent;
      default:
        return AppColors.primary;
    }
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
            Row(
              children: [
                Icon(Icons.route, size: 20, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
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
            const SizedBox(height: 8),
            Container(
              margin: const EdgeInsets.only(left: 11),
              width: 2,
              height: 24,
              color: AppColors.slate200,
            ),
            const SizedBox(height: 8),

            // Delivery
            _LocationRow(
              icon: Icons.location_on,
              color: AppColors.accent,
              title: 'Delivery',
              city: trip.deliveryCity ?? 'N/A',
              address: trip.deliveryAddress,
            ),

            if (trip.estimatedDistanceKm != null) ...[
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _StatItem(
                    label: 'Distance',
                    value: '${trip.estimatedDistanceKm!.toStringAsFixed(0)} km',
                  ),
                  if (trip.estimatedDurationMin != null)
                    _StatItem(
                      label: 'Est. Duration',
                      value: '${(trip.estimatedDurationMin! / 60).toStringAsFixed(1)} hrs',
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
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                ),
              ),
              Text(
                city,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              if (address != null)
                Text(
                  address!,
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey[600],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Stat item
class _StatItem extends StatelessWidget {
  final String label;
  final String value;

  const _StatItem({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }
}

/// Load section
class _LoadSection extends StatelessWidget {
  final dynamic load;

  const _LoadSection({required this.load});

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
                Icon(Icons.inventory_2, size: 20, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
                  'Load Details',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _DetailRow(label: 'Cargo', value: load.cargoDescription ?? 'N/A'),
            _DetailRow(label: 'Weight', value: load.weightDisplay ?? 'N/A'),
            _DetailRow(label: 'Truck Type', value: load.truckType?.toString().split('.').last ?? 'N/A'),
          ],
        ),
      ),
    );
  }
}

/// Truck section
class _TruckSection extends StatelessWidget {
  final dynamic truck;

  const _TruckSection({required this.truck});

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
                Icon(Icons.local_shipping, size: 20, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
                  'Truck',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _DetailRow(label: 'License Plate', value: truck.licensePlate ?? 'N/A'),
            _DetailRow(label: 'Type', value: truck.truckTypeDisplay ?? 'N/A'),
            _DetailRow(label: 'Capacity', value: truck.capacityDisplay ?? 'N/A'),
          ],
        ),
      ),
    );
  }
}

/// Contact section
class _ContactSection extends StatelessWidget {
  final Trip trip;

  const _ContactSection({required this.trip});

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
                Icon(Icons.contact_phone, size: 20, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
                  'Shipper Contact',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (trip.shipper != null)
              _DetailRow(label: 'Company', value: trip.shipper!.name),
            if (trip.shipper?.contactPhone != null)
              _DetailRow(label: 'Phone', value: trip.shipper!.contactPhone!),
          ],
        ),
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
      color: AppColors.success.withValues(alpha: 0.05),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.person_pin, size: 20, color: AppColors.success),
                const SizedBox(width: 8),
                const Text(
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
            width: 100,
            child: Text(
              label,
              style: TextStyle(color: Colors.grey[600]),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
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
            Row(
              children: [
                Icon(Icons.timeline, size: 20, color: AppColors.primary),
                const SizedBox(width: 8),
                const Text(
                  'Timeline',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _TimelineItem(
              title: 'Trip Created',
              time: trip.createdAt,
              isCompleted: true,
            ),
            if (trip.startedAt != null)
              _TimelineItem(
                title: 'Trip Started',
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
            if (trip.completedAt != null)
              _TimelineItem(
                title: 'Trip Completed',
                time: trip.completedAt!,
                isCompleted: true,
                isLast: true,
              ),
            if (trip.cancelledAt != null)
              _TimelineItem(
                title: 'Trip Cancelled',
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
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: itemColor,
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[600],
                    ),
                  ),
                Text(
                  DateFormat('MMM d, yyyy h:mm a').format(time),
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey[500],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Delivery form dialog
class _DeliveryFormDialog extends StatefulWidget {
  @override
  State<_DeliveryFormDialog> createState() => _DeliveryFormDialogState();
}

class _DeliveryFormDialogState extends State<_DeliveryFormDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Delivery Details'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Enter the receiver information to confirm delivery.',
                style: TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Receiver Name *',
                  prefixIcon: Icon(Icons.person),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Receiver name is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phoneController,
                decoration: const InputDecoration(
                  labelText: 'Receiver Phone *',
                  prefixIcon: Icon(Icons.phone),
                ),
                keyboardType: TextInputType.phone,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Receiver phone is required';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _notesController,
                decoration: const InputDecoration(
                  labelText: 'Delivery Notes',
                  prefixIcon: Icon(Icons.note),
                ),
                maxLines: 2,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            if (_formKey.currentState!.validate()) {
              Navigator.pop(context, {
                'receiverName': _nameController.text.trim(),
                'receiverPhone': _phoneController.text.trim(),
                'deliveryNotes': _notesController.text.trim().isNotEmpty
                    ? _notesController.text.trim()
                    : null,
              });
            }
          },
          child: const Text('Confirm Delivery'),
        ),
      ],
    );
  }
}

/// Cancel trip dialog
class _CancelTripDialog extends StatefulWidget {
  @override
  State<_CancelTripDialog> createState() => _CancelTripDialogState();
}

class _CancelTripDialogState extends State<_CancelTripDialog> {
  final _reasonController = TextEditingController();

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cancel Trip'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Are you sure you want to cancel this trip? This action cannot be undone.',
            style: TextStyle(fontSize: 14),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _reasonController,
            decoration: const InputDecoration(
              labelText: 'Cancellation Reason *',
              hintText: 'e.g., Vehicle breakdown',
            ),
            maxLines: 2,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Keep Trip'),
        ),
        ElevatedButton(
          onPressed: () {
            if (_reasonController.text.trim().isNotEmpty) {
              Navigator.pop(context, _reasonController.text.trim());
            }
          },
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
          child: const Text('Cancel Trip'),
        ),
      ],
    );
  }
}
