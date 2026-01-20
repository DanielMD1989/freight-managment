import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/load.dart';
import '../../../core/models/truck.dart';
import '../../../core/services/load_service.dart';

/// Provider for fetching a single load by ID
final shipperLoadDetailsProvider =
    FutureProvider.autoDispose.family<Load?, String>((ref, loadId) async {
  final service = LoadService();
  final result = await service.getLoadById(loadId);
  return result.success ? result.data : null;
});

/// Provider for fetching load requests for a specific load
final loadRequestsForLoadProvider =
    FutureProvider.autoDispose.family<List<LoadRequest>, String>((ref, loadId) async {
  final service = LoadService();
  final result = await service.getLoadRequests(loadId: loadId);
  return result.data ?? [];
});

class ShipperLoadDetailsScreen extends ConsumerStatefulWidget {
  final String loadId;

  const ShipperLoadDetailsScreen({super.key, required this.loadId});

  @override
  ConsumerState<ShipperLoadDetailsScreen> createState() =>
      _ShipperLoadDetailsScreenState();
}

class _ShipperLoadDetailsScreenState
    extends ConsumerState<ShipperLoadDetailsScreen> {
  bool _isProcessing = false;

  @override
  Widget build(BuildContext context) {
    final loadAsync = ref.watch(shipperLoadDetailsProvider(widget.loadId));
    final requestsAsync = ref.watch(loadRequestsForLoadProvider(widget.loadId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Load Details'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(shipperLoadDetailsProvider(widget.loadId));
              ref.invalidate(loadRequestsForLoadProvider(widget.loadId));
            },
          ),
        ],
      ),
      body: loadAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline,
                  size: 48, color: AppColors.textSecondary),
              const SizedBox(height: 16),
              Text(
                'Failed to load details',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () => ref
                    .invalidate(shipperLoadDetailsProvider(widget.loadId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (load) {
          if (load == null) {
            return const Center(child: Text('Load not found'));
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildStatusCard(load),
                const SizedBox(height: 16),
                _buildRouteCard(load),
                const SizedBox(height: 16),
                _buildScheduleCard(load),
                const SizedBox(height: 16),
                _buildCargoCard(load),
                const SizedBox(height: 16),
                _buildPricingCard(load),
                if (load.assignedTruck != null) ...[
                  const SizedBox(height: 16),
                  _buildAssignedTruckCard(load.assignedTruck!),
                ],
                if (load.isActive) ...[
                  const SizedBox(height: 16),
                  _buildRequestsSection(requestsAsync),
                ],
                if (load.specialInstructions != null ||
                    load.safetyNotes != null) ...[
                  const SizedBox(height: 16),
                  _buildNotesCard(load),
                ],
                const SizedBox(height: 80), // Space for bottom action button
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: loadAsync.maybeWhen(
        data: (load) {
          if (load == null) return null;
          return _buildBottomActions(load);
        },
        orElse: () => null,
      ),
    );
  }

  Widget _buildStatusCard(Load load) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _getStatusColor(load.status).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _getStatusIcon(load.status),
                color: _getStatusColor(load.status),
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'LOAD-${load.id.substring(0, 8).toUpperCase()}',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    load.statusDisplay,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: _getStatusColor(load.status),
                    ),
                  ),
                ],
              ),
            ),
            if (load.postedAt != null)
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'Posted',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    DateFormat('MMM d').format(load.postedAt!),
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildRouteCard(Load load) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.route, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Route',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                if (load.distanceDisplay != 'N/A')
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      load.distanceDisplay,
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: AppColors.success,
                        shape: BoxShape.circle,
                      ),
                    ),
                    Container(
                      width: 2,
                      height: 40,
                      color: AppColors.border,
                    ),
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Pickup',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        load.pickupCity ?? 'N/A',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                      if (load.pickupAddress != null)
                        Text(
                          load.pickupAddress!,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      const SizedBox(height: 20),
                      Text(
                        'Delivery',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      Text(
                        load.deliveryCity ?? 'N/A',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                      if (load.deliveryAddress != null)
                        Text(
                          load.deliveryAddress!,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScheduleCard(Load load) {
    final dateFormat = DateFormat('EEE, MMM d, yyyy');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.calendar_today, size: 20),
                SizedBox(width: 8),
                Text(
                  'Schedule',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Pickup Date',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        dateFormat.format(load.pickupDate),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (load.pickupDockHours != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Hours: ${load.pickupDockHours}',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Delivery Date',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        dateFormat.format(load.deliveryDate),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (load.deliveryDockHours != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Hours: ${load.deliveryDockHours}',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCargoCard(Load load) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.inventory_2, size: 20),
                SizedBox(width: 8),
                Text(
                  'Cargo Details',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              load.cargoDescription,
              style: const TextStyle(fontSize: 15),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildInfoChip(Icons.local_shipping, load.truckTypeDisplay),
                _buildInfoChip(Icons.scale, load.weightDisplay),
                _buildInfoChip(
                  Icons.view_in_ar,
                  load.fullPartial == LoadType.full ? 'Full Load' : 'Partial',
                ),
                if (load.volume != null)
                  _buildInfoChip(Icons.square_foot, '${load.volume} m³'),
              ],
            ),
            if (load.isFragile || load.requiresRefrigeration) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  if (load.isFragile)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.warning.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.warning_amber,
                              size: 14, color: AppColors.warning),
                          const SizedBox(width: 4),
                          Text(
                            'Fragile',
                            style: TextStyle(
                              color: AppColors.warning,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (load.isFragile && load.requiresRefrigeration)
                    const SizedBox(width: 8),
                  if (load.requiresRefrigeration)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.info.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.ac_unit, size: 14, color: AppColors.info),
                          const SizedBox(width: 4),
                          Text(
                            'Refrigerated',
                            style: TextStyle(
                              color: AppColors.info,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
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

  Widget _buildPricingCard(Load load) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.payments, size: 20),
                SizedBox(width: 8),
                Text(
                  'Pricing',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (load.totalFareEtb != null) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Fare'),
                  Text(
                    '${load.totalFareEtb!.toStringAsFixed(0)} ETB',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
            ],
            if (load.baseFareEtb != null) ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Base Fare',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  Text('${load.baseFareEtb!.toStringAsFixed(0)} ETB'),
                ],
              ),
            ],
            if (load.perKmEtb != null) ...[
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Per Km Rate',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  Text('${load.perKmEtb!.toStringAsFixed(2)} ETB/km'),
                ],
              ),
            ],
            if (load.totalFareEtb == null &&
                load.baseFareEtb == null &&
                load.perKmEtb == null)
              Text(
                'Price to be negotiated',
                style: TextStyle(color: AppColors.textSecondary),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAssignedTruckCard(Truck truck) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.local_shipping, size: 20),
                SizedBox(width: 8),
                Text(
                  'Assigned Truck',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.local_shipping,
                    color: AppColors.primary,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        truck.licensePlate,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        truck.truckTypeDisplay,
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (truck.ownerName != null || truck.contactPhone != null) ...[
              const Divider(height: 24),
              Row(
                children: const [
                  Icon(Icons.person, size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Carrier',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              if (truck.ownerName != null)
                Text(
                  truck.ownerName!,
                  style: const TextStyle(fontSize: 15),
                ),
              if (truck.contactPhone != null) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.phone,
                        size: 14, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      truck.contactPhone!,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRequestsSection(AsyncValue<List<LoadRequest>> requestsAsync) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.people, size: 20),
                SizedBox(width: 8),
                Text(
                  'Carrier Requests',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            requestsAsync.when(
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(),
                ),
              ),
              error: (_, __) => Text(
                'Failed to load requests',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              data: (requests) {
                final pendingRequests =
                    requests.where((r) => r.isPending).toList();

                if (pendingRequests.isEmpty) {
                  return Text(
                    'No pending requests',
                    style: TextStyle(color: AppColors.textSecondary),
                  );
                }

                return Column(
                  children: pendingRequests.map((request) {
                    return _buildRequestItem(request);
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestItem(LoadRequest request) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.slate50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (request.truck != null) ...[
                Text(
                  request.truck!.licensePlate,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(width: 8),
                Text(
                  request.truck!.truckTypeDisplay,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
              ] else
                Text(
                  'Truck ${request.truckId.substring(0, 8)}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.warning.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Pending',
                  style: TextStyle(
                    color: AppColors.warning,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (request.notes != null && request.notes!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              request.notes!,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
              ),
            ),
          ],
          if (request.proposedRate != null) ...[
            const SizedBox(height: 8),
            Text(
              'Proposed: ${request.proposedRate!.toStringAsFixed(0)} ETB',
              style: TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _isProcessing
                      ? null
                      : () => _respondToRequest(request.id, 'REJECT'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.error,
                    side: const BorderSide(color: AppColors.error),
                  ),
                  child: const Text('Reject'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: _isProcessing
                      ? null
                      : () => _respondToRequest(request.id, 'APPROVE'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.success,
                  ),
                  child: const Text('Approve'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNotesCard(Load load) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: const [
                Icon(Icons.notes, size: 20),
                SizedBox(width: 8),
                Text(
                  'Notes & Instructions',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (load.specialInstructions != null) ...[
              Text(
                'Special Instructions',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 4),
              Text(load.specialInstructions!),
              const SizedBox(height: 12),
            ],
            if (load.safetyNotes != null) ...[
              Text(
                'Safety Notes',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 4),
              Text(load.safetyNotes!),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildBottomActions(Load load) {
    if (load.status == LoadStatus.completed ||
        load.status == LoadStatus.cancelled) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(
          top: BorderSide(color: AppColors.border),
        ),
      ),
      child: SafeArea(
        child: Row(
          children: [
            if (load.isActive) ...[
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _editLoad(load),
                  child: const Text('Edit'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => _cancelLoad(load),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.error,
                  ),
                  child: const Text('Cancel'),
                ),
              ),
            ] else if (load.isAssigned) ...[
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    // TODO: Contact carrier
                  },
                  icon: const Icon(Icons.phone),
                  label: const Text('Contact Carrier'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.slate100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(LoadStatus status) {
    switch (status) {
      case LoadStatus.posted:
      case LoadStatus.searching:
        return AppColors.warning;
      case LoadStatus.offered:
        return AppColors.info;
      case LoadStatus.assigned:
      case LoadStatus.pickupPending:
        return AppColors.secondary;
      case LoadStatus.inTransit:
        return AppColors.primary;
      case LoadStatus.delivered:
      case LoadStatus.completed:
        return AppColors.success;
      case LoadStatus.cancelled:
      case LoadStatus.expired:
        return AppColors.error;
      default:
        return AppColors.textSecondary;
    }
  }

  IconData _getStatusIcon(LoadStatus status) {
    switch (status) {
      case LoadStatus.posted:
      case LoadStatus.searching:
        return Icons.search;
      case LoadStatus.offered:
        return Icons.local_offer;
      case LoadStatus.assigned:
        return Icons.assignment_turned_in;
      case LoadStatus.pickupPending:
        return Icons.location_on;
      case LoadStatus.inTransit:
        return Icons.local_shipping;
      case LoadStatus.delivered:
        return Icons.inventory;
      case LoadStatus.completed:
        return Icons.check_circle;
      case LoadStatus.cancelled:
      case LoadStatus.expired:
        return Icons.cancel;
      default:
        return Icons.description;
    }
  }

  Future<void> _respondToRequest(String requestId, String action) async {
    setState(() => _isProcessing = true);

    try {
      final service = LoadService();
      final result = await service.respondToRequest(
        requestId: requestId,
        action: action,
      );

      if (!mounted) return;

      if (result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              action == 'APPROVE'
                  ? 'Request approved successfully'
                  : 'Request rejected',
            ),
            backgroundColor:
                action == 'APPROVE' ? AppColors.success : AppColors.error,
          ),
        );
        ref.invalidate(shipperLoadDetailsProvider(widget.loadId));
        ref.invalidate(loadRequestsForLoadProvider(widget.loadId));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error ?? 'Failed to respond'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  void _editLoad(Load load) {
    // TODO: Navigate to edit load screen
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Edit load coming soon')),
    );
  }

  void _cancelLoad(Load load) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Load'),
        content: const Text(
          'Are you sure you want to cancel this load? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('No, Keep It'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await _performCancelLoad(load.id);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );
  }

  Future<void> _performCancelLoad(String loadId) async {
    setState(() => _isProcessing = true);

    try {
      final service = LoadService();
      final result = await service.updateLoad(id: loadId, status: 'CANCELLED');

      if (!mounted) return;

      if (result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Load cancelled'),
            backgroundColor: AppColors.success,
          ),
        );
        ref.invalidate(shipperLoadDetailsProvider(widget.loadId));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error ?? 'Failed to cancel load'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }
}
