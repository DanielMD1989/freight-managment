import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/services/truck_service.dart';

/// Provider for fetching carrier's incoming truck requests
final carrierIncomingTruckRequestsProvider =
    FutureProvider.autoDispose<List<TruckRequest>>((ref) async {
  final service = TruckService();
  final result = await service.getTruckRequests();
  return result.data ?? [];
});

/// Filter state
enum IncomingRequestFilter { all, pending, approved, rejected }

final incomingRequestFilterProvider =
    StateProvider<IncomingRequestFilter>((ref) => IncomingRequestFilter.pending);

class CarrierTruckRequestsScreen extends ConsumerStatefulWidget {
  const CarrierTruckRequestsScreen({super.key});

  @override
  ConsumerState<CarrierTruckRequestsScreen> createState() =>
      _CarrierTruckRequestsScreenState();
}

class _CarrierTruckRequestsScreenState
    extends ConsumerState<CarrierTruckRequestsScreen> {
  bool _isProcessing = false;
  String? _processingRequestId;

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(carrierIncomingTruckRequestsProvider);
    final filter = ref.watch(incomingRequestFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Booking Requests'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.invalidate(carrierIncomingTruckRequestsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter tabs
          _FilterSection(
            filter: filter,
            onFilterChanged: (f) =>
                ref.read(incomingRequestFilterProvider.notifier).state = f,
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
                      'Failed to load requests',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: () =>
                          ref.invalidate(carrierIncomingTruckRequestsProvider),
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

                // Sort: pending first, then by date
                final sortedRequests = [...filteredRequests]
                  ..sort((a, b) {
                    if (a.isPending && !b.isPending) return -1;
                    if (!a.isPending && b.isPending) return 1;
                    return b.createdAt.compareTo(a.createdAt);
                  });

                return RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(carrierIncomingTruckRequestsProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: sortedRequests.length,
                    itemBuilder: (context, index) {
                      return _RequestCard(
                        request: sortedRequests[index],
                        isProcessing: _isProcessing &&
                            _processingRequestId == sortedRequests[index].id,
                        onApprove: () =>
                            _respondToRequest(sortedRequests[index].id, 'APPROVE'),
                        onReject: () =>
                            _respondToRequest(sortedRequests[index].id, 'REJECT'),
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

  List<TruckRequest> _filterRequests(
      List<TruckRequest> requests, IncomingRequestFilter filter) {
    switch (filter) {
      case IncomingRequestFilter.all:
        return requests;
      case IncomingRequestFilter.pending:
        return requests.where((r) => r.isPending).toList();
      case IncomingRequestFilter.approved:
        return requests.where((r) => r.isApproved).toList();
      case IncomingRequestFilter.rejected:
        return requests.where((r) => r.isRejected || r.isExpired).toList();
    }
  }

  Future<void> _respondToRequest(String requestId, String action) async {
    setState(() {
      _isProcessing = true;
      _processingRequestId = requestId;
    });

    try {
      final service = TruckService();
      final result = await service.respondToTruckRequest(
        requestId: requestId,
        action: action,
      );

      if (!mounted) return;

      if (result.success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              action == 'APPROVE'
                  ? 'Booking approved! Trip created.'
                  : 'Booking rejected',
            ),
            backgroundColor:
                action == 'APPROVE' ? AppColors.success : AppColors.warning,
          ),
        );
        ref.invalidate(carrierIncomingTruckRequestsProvider);
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
        setState(() {
          _isProcessing = false;
          _processingRequestId = null;
        });
      }
    }
  }
}

class _FilterSection extends StatelessWidget {
  final IncomingRequestFilter filter;
  final Function(IncomingRequestFilter) onFilterChanged;
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
              label: 'Pending',
              count: requests.where((r) => r.isPending).length,
              isSelected: filter == IncomingRequestFilter.pending,
              onTap: () => onFilterChanged(IncomingRequestFilter.pending),
              color: AppColors.warning,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'All',
              count: requests.length,
              isSelected: filter == IncomingRequestFilter.all,
              onTap: () => onFilterChanged(IncomingRequestFilter.all),
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Approved',
              count: requests.where((r) => r.isApproved).length,
              isSelected: filter == IncomingRequestFilter.approved,
              onTap: () => onFilterChanged(IncomingRequestFilter.approved),
              color: AppColors.success,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Rejected',
              count: requests.where((r) => r.isRejected || r.isExpired).length,
              isSelected: filter == IncomingRequestFilter.rejected,
              onTap: () => onFilterChanged(IncomingRequestFilter.rejected),
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
  final bool isProcessing;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  const _RequestCard({
    required this.request,
    required this.isProcessing,
    required this.onApprove,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, HH:mm');

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with truck info
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

            // Load info (what the shipper wants to transport)
            if (request.load != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primary100),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.inventory_2,
                            size: 16, color: AppColors.primary),
                        SizedBox(width: 8),
                        Text(
                          'Load to Transport',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      request.load!.route,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.scale,
                            size: 14, color: AppColors.textSecondary),
                        const SizedBox(width: 4),
                        Text(
                          request.load!.weightDisplay,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                        if (request.load!.truckType != null) ...[
                          const SizedBox(width: 12),
                          const Icon(Icons.local_shipping,
                              size: 14, color: AppColors.textSecondary),
                          const SizedBox(width: 4),
                          Text(
                            request.load!.truckType!,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Shipper notes
            if (request.notes != null && request.notes!.isNotEmpty) ...[
              Container(
                width: double.infinity,
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
                      'Note from shipper',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      request.notes!,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Request time and expiration
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
            if (request.isPending && request.expiresAt != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.timer, size: 14, color: AppColors.warning),
                    const SizedBox(width: 4),
                    Text(
                      'Expires ${dateFormat.format(request.expiresAt!)}',
                      style: const TextStyle(
                        color: AppColors.warning,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Action buttons (only for pending requests)
            if (request.isPending) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: isProcessing ? null : onReject,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: isProcessing
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.error,
                              ),
                            )
                          : const Text('Reject'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: isProcessing ? null : onApprove,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.success,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: isProcessing
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Accept'),
                    ),
                  ),
                ],
              ),
            ],

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
          ],
        ),
      ),
    );
  }

  Color _getStatusColor() {
    if (request.isPending) return AppColors.warning;
    if (request.isApproved) return AppColors.success;
    if (request.isRejected) return AppColors.error;
    if (request.isExpired) return AppColors.textSecondary;
    return AppColors.primary;
  }

  IconData _getStatusIcon() {
    if (request.isApproved) return Icons.check_circle;
    if (request.isRejected) return Icons.cancel;
    if (request.isExpired) return Icons.timer_off;
    return Icons.hourglass_empty;
  }

  String _getStatusMessage() {
    if (request.isApproved) {
      return request.responseNotes ?? 'You accepted this booking. Trip created.';
    }
    if (request.isRejected) {
      return request.responseNotes ?? 'You rejected this booking.';
    }
    if (request.isExpired) {
      return 'This booking request expired.';
    }
    return 'Waiting for your response...';
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
        return ('Accepted', AppColors.success);
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
  final IncomingRequestFilter filter;

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
          ],
        ),
      ),
    );
  }

  (String, String, IconData) _getEmptyStateInfo() {
    switch (filter) {
      case IncomingRequestFilter.all:
        return (
          'No Booking Requests',
          'When shippers request your trucks, they will appear here.',
          Icons.inbox_outlined,
        );
      case IncomingRequestFilter.pending:
        return (
          'No Pending Requests',
          'All booking requests have been processed.',
          Icons.hourglass_empty,
        );
      case IncomingRequestFilter.approved:
        return (
          'No Accepted Bookings',
          'Accepted bookings will appear here.',
          Icons.check_circle_outline,
        );
      case IncomingRequestFilter.rejected:
        return (
          'No Rejected Bookings',
          'Rejected or expired bookings will appear here.',
          Icons.cancel_outlined,
        );
    }
  }
}
