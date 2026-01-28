import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/services/truck_service.dart';

/// Provider for fetching shipper's outgoing truck requests
final shipperTruckRequestsProvider =
    FutureProvider.autoDispose<List<TruckRequest>>((ref) async {
  final service = TruckService();
  final result = await service.getTruckRequests();
  return result.data ?? [];
});

/// Filter state
enum TruckRequestFilter { all, pending, approved, rejected }

final truckRequestFilterProvider =
    StateProvider<TruckRequestFilter>((ref) => TruckRequestFilter.all);

class ShipperTruckRequestsScreen extends ConsumerStatefulWidget {
  const ShipperTruckRequestsScreen({super.key});

  @override
  ConsumerState<ShipperTruckRequestsScreen> createState() =>
      _ShipperTruckRequestsScreenState();
}

class _ShipperTruckRequestsScreenState
    extends ConsumerState<ShipperTruckRequestsScreen> {
  String? _cancellingRequestId;

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(shipperTruckRequestsProvider);
    final filter = ref.watch(truckRequestFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Truck Bookings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(shipperTruckRequestsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter tabs
          _FilterSection(
            filter: filter,
            onFilterChanged: (f) =>
                ref.read(truckRequestFilterProvider.notifier).state = f,
            requestsAsync: requestsAsync,
          ),

          // Requests list
          Expanded(
            child: requestsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 48, color: AppColors.textSecondary),
                    const SizedBox(height: 16),
                    const Text(
                      'Failed to load bookings',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: () =>
                          ref.invalidate(shipperTruckRequestsProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (requests) {
                final filteredRequests = _filterRequests(requests, filter);

                if (filteredRequests.isEmpty) {
                  return _EmptyState(filter: filter);
                }

                // Sort by date (newest first)
                final sortedRequests = [...filteredRequests]
                  ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

                return RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(shipperTruckRequestsProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: sortedRequests.length,
                    itemBuilder: (context, index) {
                      final request = sortedRequests[index];
                      return _RequestCard(
                        request: request,
                        isCancelling: _cancellingRequestId == request.id,
                        onTap: () {
                          context.push('/shipper/trucks/${request.truckId}');
                        },
                        onCancel: request.isPending
                            ? () => _confirmCancel(request)
                            : null,
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmCancel(TruckRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Booking?'),
        content: Text(
          'Are you sure you want to cancel your booking request for '
          '${request.truck?.licensePlate ?? "this truck"}?\n\n'
          'You can request again later if needed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Cancel Booking'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await _cancelRequest(request.id);
    }
  }

  Future<void> _cancelRequest(String requestId) async {
    setState(() => _cancellingRequestId = requestId);

    try {
      final service = TruckService();
      final result = await service.cancelTruckRequest(requestId: requestId);

      if (!mounted) return;

      if (result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Booking cancelled'),
            backgroundColor: AppColors.success,
          ),
        );
        ref.invalidate(shipperTruckRequestsProvider);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error ?? 'Failed to cancel booking'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _cancellingRequestId = null);
      }
    }
  }

  List<TruckRequest> _filterRequests(
      List<TruckRequest> requests, TruckRequestFilter filter) {
    switch (filter) {
      case TruckRequestFilter.all:
        return requests;
      case TruckRequestFilter.pending:
        return requests.where((r) => r.isPending).toList();
      case TruckRequestFilter.approved:
        return requests.where((r) => r.isApproved).toList();
      case TruckRequestFilter.rejected:
        return requests
            .where((r) => r.isRejected || r.isExpired || r.isCancelled)
            .toList();
    }
  }
}

class _FilterSection extends StatelessWidget {
  final TruckRequestFilter filter;
  final Function(TruckRequestFilter) onFilterChanged;
  final AsyncValue<List<TruckRequest>> requestsAsync;

  const _FilterSection({
    required this.filter,
    required this.onFilterChanged,
    required this.requestsAsync,
  });

  @override
  Widget build(BuildContext context) {
    final requests = requestsAsync.valueOrNull ?? [];

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _FilterChip(
              label: 'All',
              count: requests.length,
              isSelected: filter == TruckRequestFilter.all,
              onTap: () => onFilterChanged(TruckRequestFilter.all),
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Pending',
              count: requests.where((r) => r.isPending).length,
              isSelected: filter == TruckRequestFilter.pending,
              onTap: () => onFilterChanged(TruckRequestFilter.pending),
              color: AppColors.warning,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Approved',
              count: requests.where((r) => r.isApproved).length,
              isSelected: filter == TruckRequestFilter.approved,
              onTap: () => onFilterChanged(TruckRequestFilter.approved),
              color: AppColors.success,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Rejected',
              count: requests.where((r) => r.isRejected || r.isExpired).length,
              isSelected: filter == TruckRequestFilter.rejected,
              onTap: () => onFilterChanged(TruckRequestFilter.rejected),
              color: AppColors.error,
            ),
          ],
        ),
      ),
    );
  }
}

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

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? chipColor : chipColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
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
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.25)
                    : chipColor.withValues(alpha: 0.15),
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
    );
  }
}

class _RequestCard extends StatelessWidget {
  final TruckRequest request;
  final VoidCallback onTap;
  final VoidCallback? onCancel;
  final bool isCancelling;

  const _RequestCard({
    required this.request,
    required this.onTap,
    this.onCancel,
    this.isCancelling = false,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, HH:mm');

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
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _getStatusColor().withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      Icons.local_shipping,
                      color: _getStatusColor(),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (request.truck != null) ...[
                          Text(
                            request.truck!.licensePlate,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            request.truck!.truckTypeDisplay,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ] else
                          Text(
                            'Truck #${request.truckId.substring(0, 8).toUpperCase()}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                      ],
                    ),
                  ),
                  _StatusBadge(status: request.status),
                ],
              ),

              const SizedBox(height: 16),

              // Load info
              if (request.load != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.slate50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'For Load',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        request.load!.route,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        request.load!.weightDisplay,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
              ],

              // Notes
              if (request.notes != null && request.notes!.isNotEmpty) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.notes, size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        request.notes!,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],

              // Time info
              Row(
                children: [
                  const Icon(Icons.access_time,
                      size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    'Requested ${dateFormat.format(request.createdAt)}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),

              // Response info for non-pending
              if (!request.isPending) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _getStatusColor().withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _getStatusIcon(),
                        size: 18,
                        color: _getStatusColor(),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _getStatusMessage(),
                          style: TextStyle(
                            color: _getStatusColor(),
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      if (request.respondedAt != null)
                        Text(
                          dateFormat.format(request.respondedAt!),
                          style: TextStyle(
                            color: _getStatusColor(),
                            fontSize: 11,
                          ),
                        ),
                    ],
                  ),
                ),
              ],

              // Expiration warning and cancel button for pending
              if (request.isPending) ...[
                const SizedBox(height: 12),
                if (request.expiresAt != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.warning.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.timer,
                          size: 18,
                          color: AppColors.warning,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Expires ${dateFormat.format(request.expiresAt!)}',
                          style: const TextStyle(
                            color: AppColors.warning,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                // Cancel button
                if (onCancel != null) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: isCancelling ? null : onCancel,
                      icon: isCancelling
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.error,
                              ),
                            )
                          : const Icon(Icons.cancel_outlined, size: 18),
                      label: Text(isCancelling ? 'Cancelling...' : 'Cancel Booking'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _getStatusColor() {
    if (request.isApproved) return AppColors.success;
    if (request.isRejected) return AppColors.error;
    if (request.isExpired) return AppColors.textSecondary;
    return AppColors.warning;
  }

  IconData _getStatusIcon() {
    if (request.isApproved) return Icons.check_circle;
    if (request.isRejected) return Icons.cancel;
    if (request.isExpired) return Icons.timer_off;
    return Icons.hourglass_empty;
  }

  String _getStatusMessage() {
    if (request.isApproved) {
      return request.responseNotes ??
          'Booking approved! Trip has been created.';
    }
    if (request.isRejected) {
      return request.responseNotes ?? 'Booking was rejected by carrier.';
    }
    if (request.isExpired) {
      return 'Booking request expired without response.';
    }
    return 'Waiting for carrier response...';
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;

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
      case 'PENDING':
        return ('Pending', AppColors.warning);
      case 'APPROVED':
        return ('Approved', AppColors.success);
      case 'REJECTED':
        return ('Rejected', AppColors.error);
      case 'EXPIRED':
        return ('Expired', AppColors.textSecondary);
      default:
        return (status, AppColors.primary);
    }
  }
}

class _EmptyState extends StatelessWidget {
  final TruckRequestFilter filter;

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
            Icon(icon, size: 64, color: AppColors.textSecondary),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: const TextStyle(
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            if (filter == TruckRequestFilter.all) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => context.go('/shipper/trucks'),
                icon: const Icon(Icons.search),
                label: const Text('Find Trucks'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  (String, String, IconData) _getEmptyStateInfo() {
    switch (filter) {
      case TruckRequestFilter.all:
        return (
          'No Bookings Yet',
          'Book trucks from the truckboard to see them here.',
          Icons.inbox_outlined,
        );
      case TruckRequestFilter.pending:
        return (
          'No Pending Bookings',
          'All your bookings have been processed.',
          Icons.hourglass_empty,
        );
      case TruckRequestFilter.approved:
        return (
          'No Approved Bookings',
          'Approved bookings will appear here.',
          Icons.check_circle_outline,
        );
      case TruckRequestFilter.rejected:
        return (
          'No Rejected Bookings',
          'Rejected or expired bookings will appear here.',
          Icons.cancel_outlined,
        );
    }
  }
}
