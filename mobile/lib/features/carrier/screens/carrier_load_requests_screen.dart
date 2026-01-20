import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/load.dart';
import '../../../core/models/truck.dart';
import '../../../core/services/load_service.dart';

/// Provider for fetching carrier's outgoing load requests
final carrierLoadRequestsProvider =
    FutureProvider.autoDispose<List<LoadRequest>>((ref) async {
  final service = LoadService();
  final result = await service.getLoadRequests();
  return result.data ?? [];
});

/// Filter state
enum RequestFilter { all, pending, approved, rejected }

final requestFilterProvider =
    StateProvider<RequestFilter>((ref) => RequestFilter.all);

class CarrierLoadRequestsScreen extends ConsumerWidget {
  const CarrierLoadRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestsAsync = ref.watch(carrierLoadRequestsProvider);
    final filter = ref.watch(requestFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Load Requests'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(carrierLoadRequestsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter tabs
          _FilterSection(
            filter: filter,
            onFilterChanged: (f) =>
                ref.read(requestFilterProvider.notifier).state = f,
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
                    Icon(Icons.error_outline,
                        size: 48, color: AppColors.textSecondary),
                    const SizedBox(height: 16),
                    Text(
                      'Failed to load requests',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 8),
                    ElevatedButton(
                      onPressed: () =>
                          ref.invalidate(carrierLoadRequestsProvider),
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
                      ref.invalidate(carrierLoadRequestsProvider),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: sortedRequests.length,
                    itemBuilder: (context, index) {
                      return _RequestCard(
                        request: sortedRequests[index],
                        onTap: () {
                          if (sortedRequests[index].load != null) {
                            context.push(
                                '/carrier/loadboard/${sortedRequests[index].loadId}');
                          }
                        },
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

  List<LoadRequest> _filterRequests(
      List<LoadRequest> requests, RequestFilter filter) {
    switch (filter) {
      case RequestFilter.all:
        return requests;
      case RequestFilter.pending:
        return requests.where((r) => r.isPending).toList();
      case RequestFilter.approved:
        return requests.where((r) => r.isApproved).toList();
      case RequestFilter.rejected:
        return requests.where((r) => r.isRejected || r.isExpired).toList();
    }
  }
}

class _FilterSection extends StatelessWidget {
  final RequestFilter filter;
  final Function(RequestFilter) onFilterChanged;
  final AsyncValue<List<LoadRequest>> requestsAsync;

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
              count: requests.length,
              isSelected: filter == RequestFilter.all,
              onTap: () => onFilterChanged(RequestFilter.all),
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Pending',
              count: requests.where((r) => r.isPending).length,
              isSelected: filter == RequestFilter.pending,
              onTap: () => onFilterChanged(RequestFilter.pending),
              color: AppColors.warning,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Approved',
              count: requests.where((r) => r.isApproved).length,
              isSelected: filter == RequestFilter.approved,
              onTap: () => onFilterChanged(RequestFilter.approved),
              color: AppColors.success,
            ),
            const SizedBox(width: 8),
            _FilterChip(
              label: 'Rejected',
              count: requests.where((r) => r.isRejected || r.isExpired).length,
              isSelected: filter == RequestFilter.rejected,
              onTap: () => onFilterChanged(RequestFilter.rejected),
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
          color: isSelected ? chipColor : chipColor.withOpacity(0.1),
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
                    ? Colors.white.withOpacity(0.25)
                    : chipColor.withOpacity(0.15),
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
  final LoadRequest request;
  final VoidCallback onTap;

  const _RequestCard({
    required this.request,
    required this.onTap,
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
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (request.load != null) ...[
                          Text(
                            request.load!.route,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            truckTypeDisplayName(request.load!.truckType),
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ] else
                          Text(
                            'Load #${request.loadId.substring(0, 8).toUpperCase()}',
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

              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 12),

              // Request details
              Row(
                children: [
                  // Truck used
                  if (request.truck != null)
                    Expanded(
                      child: Row(
                        children: [
                          Icon(Icons.local_shipping,
                              size: 16, color: AppColors.textSecondary),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              request.truck!.plateNumber,
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 13,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(width: 16),
                  // Proposed rate
                  if (request.proposedRate != null)
                    Row(
                      children: [
                        Icon(Icons.payments,
                            size: 16, color: AppColors.textSecondary),
                        const SizedBox(width: 6),
                        Text(
                          '${request.proposedRate!.toStringAsFixed(0)} ETB',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                ],
              ),

              const SizedBox(height: 12),

              // Time info
              Row(
                children: [
                  Icon(Icons.access_time,
                      size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    'Requested ${dateFormat.format(request.createdAt)}',
                    style: TextStyle(
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
                    color: _getStatusColor().withOpacity(0.1),
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

              // Expiration warning for pending
              if (request.isPending && request.expiresAt != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.timer,
                        size: 18,
                        color: AppColors.warning,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Expires ${dateFormat.format(request.expiresAt!)}',
                        style: TextStyle(
                          color: AppColors.warning,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
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
          'Request approved! Trip has been created.';
    }
    if (request.isRejected) {
      return request.responseNotes ?? 'Request was rejected by shipper.';
    }
    if (request.isExpired) {
      return 'Request expired without response.';
    }
    return 'Waiting for shipper response...';
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
  final RequestFilter filter;

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
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: TextStyle(
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            if (filter == RequestFilter.all) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: () => context.go('/carrier/loadboard'),
                icon: const Icon(Icons.search),
                label: const Text('Browse Loads'),
              ),
            ],
          ],
        ),
      ),
    );
  }

  (String, String, IconData) _getEmptyStateInfo() {
    switch (filter) {
      case RequestFilter.all:
        return (
          'No Requests Yet',
          'Request loads from the loadboard to see them here.',
          Icons.inbox_outlined,
        );
      case RequestFilter.pending:
        return (
          'No Pending Requests',
          'All your requests have been processed.',
          Icons.hourglass_empty,
        );
      case RequestFilter.approved:
        return (
          'No Approved Requests',
          'Approved requests will appear here.',
          Icons.check_circle_outline,
        );
      case RequestFilter.rejected:
        return (
          'No Rejected Requests',
          'Rejected or expired requests will appear here.',
          Icons.cancel_outlined,
        );
    }
  }
}
