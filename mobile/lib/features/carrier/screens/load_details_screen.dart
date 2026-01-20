import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/load.dart';
import '../../../core/models/truck.dart';
import '../../../core/services/load_service.dart';
import '../../../core/services/truck_service.dart';

/// Provider for load details
final loadDetailsProvider =
    FutureProvider.autoDispose.family<Load?, String>((ref, loadId) async {
  final service = LoadService();
  final result = await service.getLoadById(loadId);
  return result.success ? result.data : null;
});

/// Provider for carrier's approved trucks
final loadRequestTrucksProvider =
    FutureProvider.autoDispose<List<Truck>>((ref) async {
  final service = TruckService();
  final result = await service.getTrucks(approvalStatus: 'APPROVED');
  return result.success ? result.data ?? [] : [];
});

/// Load Details Screen - Full load information for carriers
class LoadDetailsScreen extends ConsumerStatefulWidget {
  final String loadId;

  const LoadDetailsScreen({super.key, required this.loadId});

  @override
  ConsumerState<LoadDetailsScreen> createState() => _LoadDetailsScreenState();
}

class _LoadDetailsScreenState extends ConsumerState<LoadDetailsScreen> {
  bool _isRequesting = false;

  @override
  Widget build(BuildContext context) {
    final loadAsync = ref.watch(loadDetailsProvider(widget.loadId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Load Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(loadDetailsProvider(widget.loadId)),
          ),
        ],
      ),
      body: loadAsync.when(
        data: (load) {
          if (load == null) {
            return _buildNotFound();
          }
          return _buildContent(load);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _buildError(error.toString()),
      ),
    );
  }

  Widget _buildNotFound() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Load Not Found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'This load may have been removed or is no longer available.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.pop(),
              child: const Text('Go Back'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[400]),
            const SizedBox(height: 16),
            const Text(
              'Failed to load details',
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
              onPressed: () =>
                  ref.invalidate(loadDetailsProvider(widget.loadId)),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(Load load) {
    final canRequest = load.status == LoadStatus.posted;

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(loadDetailsProvider(widget.loadId)),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status and age
                  _StatusHeader(load: load),
                  const SizedBox(height: 16),

                  // Route card
                  _RouteCard(load: load),
                  const SizedBox(height: 16),

                  // Schedule card
                  _ScheduleCard(load: load),
                  const SizedBox(height: 16),

                  // Cargo details card
                  _CargoCard(load: load),
                  const SizedBox(height: 16),

                  // Requirements card
                  if (load.isFragile ||
                      load.requiresRefrigeration ||
                      load.safetyNotes != null ||
                      load.specialInstructions != null)
                    _RequirementsCard(load: load),
                  if (load.isFragile ||
                      load.requiresRefrigeration ||
                      load.safetyNotes != null ||
                      load.specialInstructions != null)
                    const SizedBox(height: 16),

                  // Shipper contact (if not anonymous)
                  if (!load.isAnonymous &&
                      (load.shipperContactName != null ||
                          load.shipperContactPhone != null))
                    _ContactCard(load: load),
                  if (!load.isAnonymous &&
                      (load.shipperContactName != null ||
                          load.shipperContactPhone != null))
                    const SizedBox(height: 16),

                  const SizedBox(height: 80), // Space for bottom button
                ],
              ),
            ),
          ),
        ),

        // Bottom action bar
        if (canRequest) _buildActionBar(load),
      ],
    );
  }

  Widget _buildActionBar(Load load) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Distance info
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (load.tripKm != null || load.estimatedTripKm != null)
                  Text(
                    '${(load.tripKm ?? load.estimatedTripKm)!.toStringAsFixed(0)} km',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                Text(
                  load.weightDisplay,
                  style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                ),
              ],
            ),
            const Spacer(),
            SizedBox(
              width: 180,
              child: ElevatedButton.icon(
                onPressed: _isRequesting ? null : () => _showRequestModal(load),
                icon: _isRequesting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send, size: 18),
                label: Text(_isRequesting ? 'Sending...' : 'Request Load'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showRequestModal(Load load) async {
    final trucksAsync = ref.read(loadRequestTrucksProvider);
    final trucks = trucksAsync.valueOrNull ?? [];

    if (trucks.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content:
              Text('You need at least one approved truck to request loads'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _RequestLoadModal(
        load: load,
        trucks: trucks,
      ),
    );

    if (result != null && mounted) {
      await _submitRequest(load.id, result);
    }
  }

  Future<void> _submitRequest(String loadId, Map<String, dynamic> data) async {
    setState(() => _isRequesting = true);

    final service = LoadService();
    final result = await service.requestLoad(
      loadId: loadId,
      truckId: data['truckId'],
      notes: data['notes'],
      expiresInHours: data['expiresInHours'] ?? 24,
    );

    if (!mounted) return;

    setState(() => _isRequesting = false);

    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Request sent to shipper!'),
          backgroundColor: AppColors.success,
        ),
      );
      context.pop();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.error ?? 'Failed to send request'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }
}

/// Status header
class _StatusHeader extends StatelessWidget {
  final Load load;

  const _StatusHeader({required this.load});

  @override
  Widget build(BuildContext context) {
    final ageText = _getAgeText(load.postedAt ?? load.createdAt);

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: _getStatusColor(load.status).withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _getStatusIcon(load.status),
                size: 16,
                color: _getStatusColor(load.status),
              ),
              const SizedBox(width: 6),
              Text(
                load.statusDisplay,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _getStatusColor(load.status),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Icon(Icons.access_time, size: 14, color: Colors.grey[500]),
        const SizedBox(width: 4),
        Text(
          'Posted $ageText',
          style: TextStyle(fontSize: 13, color: Colors.grey[600]),
        ),
        const Spacer(),
        if (load.fullPartial == LoadType.partial)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.accent100,
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text(
              'Partial Load',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.accent700,
              ),
            ),
          ),
      ],
    );
  }

  String _getAgeText(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    } else {
      return '${diff.inDays}d ago';
    }
  }

  Color _getStatusColor(LoadStatus status) {
    switch (status) {
      case LoadStatus.posted:
        return AppColors.success;
      case LoadStatus.assigned:
      case LoadStatus.pickupPending:
      case LoadStatus.inTransit:
        return AppColors.primary;
      case LoadStatus.delivered:
      case LoadStatus.completed:
        return AppColors.success;
      case LoadStatus.exception:
        return AppColors.error;
      case LoadStatus.cancelled:
      case LoadStatus.expired:
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon(LoadStatus status) {
    switch (status) {
      case LoadStatus.posted:
        return Icons.check_circle;
      case LoadStatus.assigned:
        return Icons.assignment;
      case LoadStatus.pickupPending:
        return Icons.schedule;
      case LoadStatus.inTransit:
        return Icons.local_shipping;
      case LoadStatus.delivered:
        return Icons.inventory;
      case LoadStatus.completed:
        return Icons.done_all;
      default:
        return Icons.info;
    }
  }
}

/// Route card
class _RouteCard extends StatelessWidget {
  final Load load;

  const _RouteCard({required this.load});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Route',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),

            // Pickup location
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.primary100,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.radio_button_checked,
                    size: 16,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Pickup',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      Text(
                        load.pickupCity ?? 'N/A',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (load.pickupAddress != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          load.pickupAddress!,
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                      if (load.pickupDockHours != null) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(Icons.access_time,
                                size: 14, color: Colors.grey[500]),
                            const SizedBox(width: 4),
                            Text(
                              'Dock: ${load.pickupDockHours}',
                              style: TextStyle(
                                  fontSize: 12, color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            // Connector line
            Padding(
              padding: const EdgeInsets.only(left: 15),
              child: Container(
                width: 2,
                height: 24,
                color: AppColors.slate300,
              ),
            ),

            // Delivery location
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.accent100,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.location_on,
                    size: 16,
                    color: AppColors.accent,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Delivery',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      Text(
                        load.deliveryCity ?? 'N/A',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (load.deliveryAddress != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          load.deliveryAddress!,
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                      if (load.deliveryDockHours != null) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(Icons.access_time,
                                size: 14, color: Colors.grey[500]),
                            const SizedBox(width: 4),
                            Text(
                              'Dock: ${load.deliveryDockHours}',
                              style: TextStyle(
                                  fontSize: 12, color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            // Distance
            if (load.tripKm != null || load.estimatedTripKm != null) ...[
              const SizedBox(height: 16),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.slate100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.route, size: 18, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Text(
                      'Total Distance: ${(load.tripKm ?? load.estimatedTripKm)!.toStringAsFixed(0)} km',
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
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
}

/// Schedule card
class _ScheduleCard extends StatelessWidget {
  final Load load;

  const _ScheduleCard({required this.load});

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('EEE, MMM d, yyyy');
    final timeFormat = DateFormat('h:mm a');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Schedule',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _ScheduleItem(
                    label: 'Pickup Date',
                    date: dateFormat.format(load.pickupDate),
                    time: timeFormat.format(load.pickupDate),
                    color: AppColors.primary,
                  ),
                ),
                Container(
                  height: 60,
                  width: 1,
                  color: AppColors.border,
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                ),
                Expanded(
                  child: _ScheduleItem(
                    label: 'Delivery Date',
                    date: dateFormat.format(load.deliveryDate),
                    time: timeFormat.format(load.deliveryDate),
                    color: AppColors.accent,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ScheduleItem extends StatelessWidget {
  final String label;
  final String date;
  final String time;
  final Color color;

  const _ScheduleItem({
    required this.label,
    required this.date,
    required this.time,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          date,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: color,
          ),
        ),
        Text(
          time,
          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
        ),
      ],
    );
  }
}

/// Cargo card
class _CargoCard extends StatelessWidget {
  final Load load;

  const _CargoCard({required this.load});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Cargo Details',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),

            // Cargo description
            Text(
              load.cargoDescription.isNotEmpty
                  ? load.cargoDescription
                  : 'No description provided',
              style: TextStyle(
                fontSize: 14,
                color: load.cargoDescription.isNotEmpty
                    ? AppColors.textPrimary
                    : Colors.grey[500],
              ),
            ),
            const SizedBox(height: 16),

            // Details grid
            Row(
              children: [
                _DetailItem(
                  icon: Icons.local_shipping,
                  label: 'Truck Type',
                  value: load.truckType.toString().split('.').last,
                ),
                const SizedBox(width: 16),
                _DetailItem(
                  icon: Icons.scale,
                  label: 'Weight',
                  value: load.weightDisplay,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _DetailItem(
                  icon: Icons.view_in_ar,
                  label: 'Load Type',
                  value: load.fullPartial == LoadType.full
                      ? 'Full Load'
                      : 'Partial',
                ),
                if (load.volume != null) ...[
                  const SizedBox(width: 16),
                  _DetailItem(
                    icon: Icons.straighten,
                    label: 'Volume',
                    value: '${load.volume!.toStringAsFixed(1)} m³',
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.slate100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 18, color: AppColors.textSecondary),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
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
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Requirements card
class _RequirementsCard extends StatelessWidget {
  final Load load;

  const _RequirementsCard({required this.load});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Special Requirements',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),

            // Flags
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (load.isFragile)
                  _RequirementChip(
                    icon: Icons.warning_amber,
                    label: 'Fragile',
                    color: AppColors.warning,
                  ),
                if (load.requiresRefrigeration)
                  _RequirementChip(
                    icon: Icons.ac_unit,
                    label: 'Refrigerated',
                    color: AppColors.info,
                  ),
              ],
            ),

            // Safety notes
            if (load.safetyNotes != null && load.safetyNotes!.isNotEmpty) ...[
              const SizedBox(height: 12),
              _NoteSection(
                icon: Icons.health_and_safety,
                title: 'Safety Notes',
                content: load.safetyNotes!,
                color: AppColors.warning,
              ),
            ],

            // Special instructions
            if (load.specialInstructions != null &&
                load.specialInstructions!.isNotEmpty) ...[
              const SizedBox(height: 12),
              _NoteSection(
                icon: Icons.info_outline,
                title: 'Special Instructions',
                content: load.specialInstructions!,
                color: AppColors.primary,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RequirementChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _RequirementChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _NoteSection extends StatelessWidget {
  final IconData icon;
  final String title;
  final String content;
  final Color color;

  const _NoteSection({
    required this.icon,
    required this.title,
    required this.content,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            content,
            style: const TextStyle(fontSize: 13),
          ),
        ],
      ),
    );
  }
}

/// Contact card
class _ContactCard extends StatelessWidget {
  final Load load;

  const _ContactCard({required this.load});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Shipper Contact',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            if (load.shipperContactName != null)
              Row(
                children: [
                  const Icon(Icons.person, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    load.shipperContactName!,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            if (load.shipperContactPhone != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.phone, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    load.shipperContactPhone!,
                    style: const TextStyle(fontSize: 14),
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

/// Request load modal
class _RequestLoadModal extends StatefulWidget {
  final Load load;
  final List<Truck> trucks;

  const _RequestLoadModal({required this.load, required this.trucks});

  @override
  State<_RequestLoadModal> createState() => _RequestLoadModalState();
}

class _RequestLoadModalState extends State<_RequestLoadModal> {
  String? _selectedTruckId;
  final _notesController = TextEditingController();
  int _expiresInHours = 24;

  @override
  void initState() {
    super.initState();
    if (widget.trucks.isNotEmpty) {
      _selectedTruckId = widget.trucks.first.id;
    }
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'Request Load',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Load summary
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.slate100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${widget.load.pickupCity} → ${widget.load.deliveryCity}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${widget.load.weightDisplay} • ${widget.load.truckType.toString().split('.').last}',
                          style:
                              TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                  if (widget.load.tripKm != null)
                    Text(
                      '${widget.load.tripKm!.toStringAsFixed(0)} km',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Truck selection
            const Text(
              'Select Truck *',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _selectedTruckId,
              decoration: const InputDecoration(
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
              items: widget.trucks.map((truck) {
                return DropdownMenuItem(
                  value: truck.id,
                  child: Text(
                    '${truck.licensePlate} - ${truck.truckTypeDisplay} (${truck.capacityDisplay})',
                  ),
                );
              }).toList(),
              onChanged: (value) => setState(() => _selectedTruckId = value),
            ),
            const SizedBox(height: 16),

            // Request expires
            const Text(
              'Request Expires In',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 6, label: Text('6h')),
                ButtonSegment(value: 12, label: Text('12h')),
                ButtonSegment(value: 24, label: Text('24h')),
                ButtonSegment(value: 48, label: Text('48h')),
              ],
              selected: {_expiresInHours},
              onSelectionChanged: (set) =>
                  setState(() => _expiresInHours = set.first),
            ),
            const SizedBox(height: 16),

            // Notes
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(
                labelText: 'Notes (optional)',
                hintText: 'Add any notes for the shipper...',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 24),

            // Submit button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _selectedTruckId == null
                    ? null
                    : () {
                        Navigator.pop(context, {
                          'truckId': _selectedTruckId,
                          'notes': _notesController.text.trim(),
                          'expiresInHours': _expiresInHours,
                        });
                      },
                child: const Text('Send Request'),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
