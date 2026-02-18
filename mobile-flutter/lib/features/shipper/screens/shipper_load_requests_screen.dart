import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../app.dart';
import '../../../core/models/load.dart';
import '../../../core/services/load_service.dart';

/// Provider for fetching load requests for a specific load
final loadRequestsProvider =
    FutureProvider.autoDispose.family<List<LoadRequest>, String>((ref, loadId) async {
  final service = LoadService();
  final result = await service.getLoadRequests(loadId: loadId);
  return result.data ?? [];
});

/// Provider for fetching load details
final loadForRequestsProvider =
    FutureProvider.autoDispose.family<Load?, String>((ref, loadId) async {
  final service = LoadService();
  final result = await service.getLoadById(loadId);
  return result.success ? result.data : null;
});

class ShipperLoadRequestsScreen extends ConsumerStatefulWidget {
  final String loadId;

  const ShipperLoadRequestsScreen({super.key, required this.loadId});

  @override
  ConsumerState<ShipperLoadRequestsScreen> createState() =>
      _ShipperLoadRequestsScreenState();
}

class _ShipperLoadRequestsScreenState
    extends ConsumerState<ShipperLoadRequestsScreen> {
  bool _isProcessing = false;
  String? _processingRequestId;

  @override
  Widget build(BuildContext context) {
    final loadAsync = ref.watch(loadForRequestsProvider(widget.loadId));
    final requestsAsync = ref.watch(loadRequestsProvider(widget.loadId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Carrier Requests'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(loadRequestsProvider(widget.loadId));
              ref.invalidate(loadForRequestsProvider(widget.loadId));
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Load summary header
          loadAsync.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (load) {
              if (load == null) return const SizedBox.shrink();
              return _LoadSummaryHeader(load: load);
            },
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
                          ref.invalidate(loadRequestsProvider(widget.loadId)),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (requests) {
                if (requests.isEmpty) {
                  return _EmptyState();
                }

                // Sort: pending first, then by date
                final sortedRequests = [...requests]
                  ..sort((a, b) {
                    if (a.isPending && !b.isPending) return -1;
                    if (!a.isPending && b.isPending) return 1;
                    return b.createdAt.compareTo(a.createdAt);
                  });

                return RefreshIndicator(
                  onRefresh: () async =>
                      ref.invalidate(loadRequestsProvider(widget.loadId)),
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

  Future<void> _respondToRequest(String requestId, String action) async {
    setState(() {
      _isProcessing = true;
      _processingRequestId = requestId;
    });

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
                  ? 'Request approved! Trip created.'
                  : 'Request rejected',
            ),
            backgroundColor:
                action == 'APPROVE' ? AppColors.success : AppColors.warning,
          ),
        );
        ref.invalidate(loadRequestsProvider(widget.loadId));
        ref.invalidate(loadForRequestsProvider(widget.loadId));

        // If approved, go back (load is now assigned)
        if (action == 'APPROVE') {
          if (mounted) {
            context.pop();
          }
        }
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

class _LoadSummaryHeader extends StatelessWidget {
  final Load load;

  const _LoadSummaryHeader({required this.load});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary100,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.inventory_2,
              color: AppColors.primary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  load.route,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      load.weightDisplay,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 4,
                      height: 4,
                      decoration: const BoxDecoration(
                        color: AppColors.textSecondary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      load.truckTypeDisplay,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (load.totalFareEtb != null)
            Text(
              '${load.totalFareEtb!.toStringAsFixed(0)} ETB',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: AppColors.primary,
              ),
            ),
        ],
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  final LoadRequest request;
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
                        const Text(
                          'Truck Request',
                          style: TextStyle(
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

            // Truck details
            if (request.truck != null) ...[
              _DetailRow(
                icon: Icons.straighten,
                label: 'Capacity',
                value: request.truck!.capacityDisplay,
              ),
              const SizedBox(height: 8),
              if (request.truck!.currentCity != null)
                _DetailRow(
                  icon: Icons.location_on,
                  label: 'Location',
                  value: request.truck!.currentCity!,
                ),
              const SizedBox(height: 8),
            ],

            // Request notes
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
                      'Note from carrier',
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

            // Proposed rate
            if (request.proposedRate != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.primary100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.payments, size: 16, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Text(
                      'Proposed: ${request.proposedRate!.toStringAsFixed(0)} ETB',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Request time
            Row(
              children: [
                const Icon(Icons.access_time, size: 14, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  'Requested ${dateFormat.format(request.createdAt)}',
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                if (request.expiresAt != null) ...[
                  const SizedBox(width: 12),
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
              ],
            ),

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
                          : const Text('Approve'),
                    ),
                  ),
                ],
              ),
            ],

            // Response for non-pending
            if (!request.isPending && request.responseNotes != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: request.isApproved
                      ? AppColors.success.withValues(alpha: 0.1)
                      : AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      request.isApproved ? Icons.check_circle : Icons.cancel,
                      size: 16,
                      color: request.isApproved ? AppColors.success : AppColors.error,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        request.responseNotes!,
                        style: TextStyle(
                          color:
                              request.isApproved ? AppColors.success : AppColors.error,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Contact to negotiate (only for approved requests)
            if (request.isApproved) ...[
              const SizedBox(height: 12),
              _ContactToNegotiateBox(
                contactName: request.carrier?.name ?? 'Carrier',
                contactPhone: request.carrier?.phone,
                isCarrier: true,
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

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 13,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.w500,
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.inbox_outlined,
              size: 64,
              color: AppColors.textSecondary,
            ),
            SizedBox(height: 16),
            Text(
              'No Requests Yet',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'When carriers request this load, their requests will appear here.',
              style: TextStyle(
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

/// Contact to negotiate box - shown when request is approved
class _ContactToNegotiateBox extends StatelessWidget {
  final String contactName;
  final String? contactPhone;
  final bool isCarrier;

  const _ContactToNegotiateBox({
    required this.contactName,
    this.contactPhone,
    required this.isCarrier,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.handshake, size: 20, color: AppColors.success),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Contact to Negotiate',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: AppColors.success,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            isCarrier
                ? 'Contact the carrier to negotiate freight price and finalize pickup details.'
                : 'Contact the shipper to negotiate freight price and finalize delivery details.',
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey[700],
            ),
          ),
          const SizedBox(height: 12),
          // Contact info
          Row(
            children: [
              Icon(
                isCarrier ? Icons.local_shipping : Icons.business,
                size: 16,
                color: Colors.grey[600],
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  contactName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
          if (contactPhone != null && contactPhone!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                Icon(Icons.phone, size: 16, color: Colors.grey[600]),
                const SizedBox(width: 8),
                Text(
                  contactPhone!,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[700],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _makeCall(contactPhone!),
                    icon: const Icon(Icons.phone, size: 18),
                    label: const Text('Call'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _sendMessage(contactPhone!),
                    icon: const Icon(Icons.message, size: 18),
                    label: const Text('Message'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.accent,
                      side: const BorderSide(color: AppColors.accent),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ],
            ),
          ] else ...[
            const SizedBox(height: 8),
            Text(
              'No phone number available',
              style: TextStyle(
                fontSize: 12,
                color: Colors.grey[500],
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _makeCall(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _sendMessage(String phone) async {
    final uri = Uri.parse('sms:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }
}
