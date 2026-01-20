import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/truck.dart';
import '../../../core/services/truck_service.dart';
import 'carrier_trucks_screen.dart';

/// Provider for fetching a single truck by ID
final truckDetailProvider =
    FutureProvider.family.autoDispose<Truck?, String>((ref, truckId) async {
  final service = TruckService();
  final result = await service.getTruckById(truckId);
  return result.success ? result.data : null;
});

/// Truck Details Screen
class TruckDetailsScreen extends ConsumerStatefulWidget {
  final String truckId;

  const TruckDetailsScreen({super.key, required this.truckId});

  @override
  ConsumerState<TruckDetailsScreen> createState() => _TruckDetailsScreenState();
}

class _TruckDetailsScreenState extends ConsumerState<TruckDetailsScreen> {
  final _truckService = TruckService();
  bool _isDeleting = false;
  bool _isTogglingAvailability = false;

  Future<void> _deleteTruck() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Truck'),
        content: const Text(
          'Are you sure you want to delete this truck? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isDeleting = true);

    try {
      final result = await _truckService.deleteTruck(widget.truckId);

      if (!mounted) return;

      if (result.success) {
        ref.invalidate(trucksListProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Truck deleted successfully'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error ?? 'Failed to delete truck'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isDeleting = false);
      }
    }
  }

  Future<void> _toggleAvailability(Truck truck) async {
    setState(() => _isTogglingAvailability = true);

    try {
      final result = await _truckService.toggleAvailability(
        truck.id,
        !truck.isAvailable,
      );

      if (!mounted) return;

      if (result.success) {
        ref.invalidate(truckDetailProvider(widget.truckId));
        ref.invalidate(trucksListProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              truck.isAvailable
                  ? 'Truck marked as unavailable'
                  : 'Truck marked as available',
            ),
            backgroundColor: AppColors.success,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error ?? 'Failed to update availability'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isTogglingAvailability = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final truckAsync = ref.watch(truckDetailProvider(widget.truckId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Truck Details'),
        actions: [
          truckAsync.maybeWhen(
            data: (truck) {
              if (truck == null) return const SizedBox.shrink();
              return PopupMenuButton<String>(
                onSelected: (value) {
                  switch (value) {
                    case 'edit':
                      context.push('/carrier/trucks/${widget.truckId}/edit');
                      break;
                    case 'delete':
                      _deleteTruck();
                      break;
                  }
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'edit',
                    child: Row(
                      children: [
                        Icon(Icons.edit),
                        SizedBox(width: 12),
                        Text('Edit Truck'),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete, color: AppColors.error),
                        SizedBox(width: 12),
                        Text('Delete', style: TextStyle(color: AppColors.error)),
                      ],
                    ),
                  ),
                ],
              );
            },
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: truckAsync.when(
        data: (truck) {
          if (truck == null) {
            return const Center(child: Text('Truck not found'));
          }
          return _buildTruckDetails(truck);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red[400]),
              const SizedBox(height: 16),
              Text('Failed to load truck: $error'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(truckDetailProvider(widget.truckId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTruckDetails(Truck truck) {
    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(truckDetailProvider(widget.truckId));
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header card with status
          _TruckHeaderCard(
            truck: truck,
            isTogglingAvailability: _isTogglingAvailability,
            onToggleAvailability: () => _toggleAvailability(truck),
          ),
          const SizedBox(height: 16),

          // Status banner if rejected
          if (truck.isRejected && truck.rejectionReason != null)
            _RejectionBanner(reason: truck.rejectionReason!),
          if (truck.isRejected) const SizedBox(height: 16),

          // Status banner if pending
          if (truck.isPending) _PendingBanner(),
          if (truck.isPending) const SizedBox(height: 16),

          // Specifications
          _DetailSection(
            title: 'Specifications',
            icon: Icons.settings,
            children: [
              _DetailRow(label: 'Truck Type', value: truck.truckTypeDisplay),
              _DetailRow(label: 'Capacity', value: truck.capacityDisplay),
              if (truck.volume != null)
                _DetailRow(label: 'Volume', value: '${truck.volume} m³'),
              if (truck.lengthM != null)
                _DetailRow(label: 'Length', value: '${truck.lengthM} m'),
            ],
          ),
          const SizedBox(height: 16),

          // Current Location
          _DetailSection(
            title: 'Current Location',
            icon: Icons.location_on,
            children: [
              _DetailRow(
                label: 'City',
                value: truck.currentCity ?? 'Not set',
              ),
              _DetailRow(
                label: 'Region',
                value: truck.currentRegion ?? 'Not set',
              ),
              if (truck.currentLocationLat != null &&
                  truck.currentLocationLon != null)
                _DetailRow(
                  label: 'Coordinates',
                  value:
                      '${truck.currentLocationLat!.toStringAsFixed(4)}, ${truck.currentLocationLon!.toStringAsFixed(4)}',
                ),
              if (truck.locationUpdatedAt != null)
                _DetailRow(
                  label: 'Last Updated',
                  value: _formatDateTime(truck.locationUpdatedAt!),
                ),
            ],
          ),
          const SizedBox(height: 16),

          // GPS Information
          _DetailSection(
            title: 'GPS Tracking',
            icon: Icons.gps_fixed,
            children: [
              _DetailRow(
                label: 'GPS Device',
                value: truck.hasGps ? 'Connected' : 'Not Connected',
                valueColor: truck.hasGps ? AppColors.success : Colors.grey,
              ),
              if (truck.hasGps) ...[
                _DetailRow(label: 'IMEI', value: truck.imei ?? 'N/A'),
                if (truck.gpsProvider != null)
                  _DetailRow(label: 'Provider', value: truck.gpsProvider!),
                _DetailRow(
                  label: 'Status',
                  value: _getGpsStatusDisplay(truck.gpsStatus),
                  valueColor: truck.isGpsActive ? AppColors.success : Colors.amber,
                ),
                if (truck.gpsLastSeenAt != null)
                  _DetailRow(
                    label: 'Last Seen',
                    value: _formatDateTime(truck.gpsLastSeenAt!),
                  ),
              ],
            ],
          ),
          const SizedBox(height: 16),

          // Contact Information
          _DetailSection(
            title: 'Contact Information',
            icon: Icons.contact_phone,
            children: [
              _DetailRow(
                label: 'Owner',
                value: truck.ownerName ?? 'Not specified',
              ),
              _DetailRow(
                label: 'Contact Person',
                value: truck.contactName ?? 'Not specified',
              ),
              _DetailRow(
                label: 'Phone',
                value: truck.contactPhone ?? 'Not specified',
              ),
            ],
          ),
          const SizedBox(height: 16),

          // System Information
          _DetailSection(
            title: 'System Info',
            icon: Icons.info_outline,
            children: [
              _DetailRow(label: 'Truck ID', value: truck.id.substring(0, 8)),
              _DetailRow(
                label: 'Approval Status',
                value: _getApprovalStatusDisplay(truck.approvalStatus),
                valueColor: _getApprovalStatusColor(truck.approvalStatus),
              ),
              _DetailRow(
                label: 'Added On',
                value: _formatDate(truck.createdAt),
              ),
              _DetailRow(
                label: 'Last Updated',
                value: _formatDateTime(truck.updatedAt),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Action buttons
          if (truck.isApproved) ...[
            // Post truck button (only if available)
            if (truck.isAvailable)
              ElevatedButton.icon(
                onPressed: () =>
                    context.push('/carrier/postings/create?truckId=${truck.id}'),
                icon: const Icon(Icons.post_add),
                label: const Text('Post This Truck'),
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
              ),
            const SizedBox(height: 12),

            // Toggle availability button
            OutlinedButton.icon(
              onPressed: _isTogglingAvailability
                  ? null
                  : () => _toggleAvailability(truck),
              icon: Icon(
                truck.isAvailable ? Icons.pause_circle : Icons.play_circle,
              ),
              label: Text(
                truck.isAvailable ? 'Mark as Unavailable' : 'Mark as Available',
              ),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ],

          // Edit button
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => context.push('/carrier/trucks/${truck.id}/edit'),
            icon: const Icon(Icons.edit),
            label: const Text('Edit Truck'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),

          // Delete button
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: _isDeleting ? null : _deleteTruck,
            icon: _isDeleting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.delete_outline, color: AppColors.error),
            label: Text(
              _isDeleting ? 'Deleting...' : 'Delete Truck',
              style: const TextStyle(color: AppColors.error),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return DateFormat('MMM d, yyyy').format(date);
  }

  String _formatDateTime(DateTime date) {
    return DateFormat('MMM d, yyyy h:mm a').format(date);
  }

  String _getGpsStatusDisplay(GpsDeviceStatus? status) {
    switch (status) {
      case GpsDeviceStatus.active:
        return 'Active';
      case GpsDeviceStatus.inactive:
        return 'Inactive';
      case GpsDeviceStatus.signalLost:
        return 'Signal Lost';
      case GpsDeviceStatus.maintenance:
        return 'Maintenance';
      case null:
        return 'Unknown';
    }
  }

  String _getApprovalStatusDisplay(VerificationStatus status) {
    switch (status) {
      case VerificationStatus.pending:
        return 'Pending Review';
      case VerificationStatus.approved:
        return 'Approved';
      case VerificationStatus.rejected:
        return 'Rejected';
      case VerificationStatus.expired:
        return 'Expired';
    }
  }

  Color _getApprovalStatusColor(VerificationStatus status) {
    switch (status) {
      case VerificationStatus.pending:
        return Colors.amber;
      case VerificationStatus.approved:
        return AppColors.success;
      case VerificationStatus.rejected:
        return AppColors.error;
      case VerificationStatus.expired:
        return Colors.grey;
    }
  }
}

/// Truck header card with main info and status
class _TruckHeaderCard extends StatelessWidget {
  final Truck truck;
  final bool isTogglingAvailability;
  final VoidCallback onToggleAvailability;

  const _TruckHeaderCard({
    required this.truck,
    required this.isTogglingAvailability,
    required this.onToggleAvailability,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Truck icon and plate
            Row(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: _getStatusColor().withOpacity(0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    Icons.local_shipping,
                    size: 40,
                    color: _getStatusColor(),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        truck.licensePlate,
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        truck.truckTypeDisplay,
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
                _StatusBadge(
                  label: truck.statusDisplay,
                  color: _getStatusColor(),
                ),
              ],
            ),

            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 16),

            // Quick stats
            Row(
              children: [
                _QuickStat(
                  icon: Icons.scale,
                  label: 'Capacity',
                  value: truck.capacityDisplay,
                ),
                const SizedBox(width: 16),
                _QuickStat(
                  icon: truck.hasGps ? Icons.gps_fixed : Icons.gps_off,
                  label: 'GPS',
                  value: truck.hasGps
                      ? (truck.isGpsActive ? 'Active' : 'Offline')
                      : 'None',
                  valueColor: truck.hasGps && truck.isGpsActive
                      ? AppColors.success
                      : Colors.grey,
                ),
                const SizedBox(width: 16),
                _QuickStat(
                  icon: Icons.location_on,
                  label: 'Location',
                  value: truck.currentCity ?? 'N/A',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor() {
    if (!truck.isApproved) {
      if (truck.isPending) return Colors.amber;
      if (truck.isRejected) return AppColors.error;
      return Colors.grey;
    }
    return truck.isAvailable ? AppColors.success : Colors.blue;
  }
}

/// Status badge widget
class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
      ),
    );
  }
}

/// Quick stat widget
class _QuickStat extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _QuickStat({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 20, color: Colors.grey[600]),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: valueColor ?? AppColors.textPrimary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            label,
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

/// Rejection banner
class _RejectionBanner extends StatelessWidget {
  final String reason;

  const _RejectionBanner({required this.reason});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red[200]!),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error, color: Colors.red[700]),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Verification Rejected',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.red[700],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  reason,
                  style: TextStyle(color: Colors.red[700]),
                ),
                const SizedBox(height: 8),
                Text(
                  'Please update your truck information and resubmit.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.red[600],
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

/// Pending banner
class _PendingBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.amber[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.amber[200]!),
      ),
      child: Row(
        children: [
          Icon(Icons.hourglass_top, color: Colors.amber[700]),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Pending Verification',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.amber[800],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Your truck is being reviewed by our team. This usually takes 1-2 business days.',
                  style: TextStyle(color: Colors.amber[700]),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Detail section widget
class _DetailSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _DetailSection({
    required this.title,
    required this.icon,
    required this.children,
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
              children: [
                Icon(icon, size: 20, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// Detail row widget
class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _DetailRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(
                color: Colors.grey[600],
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: valueColor ?? AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
