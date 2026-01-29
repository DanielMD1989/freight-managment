import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/load.dart';
import '../../../core/models/truck.dart';
import '../../../core/services/load_service.dart';
import '../../../core/services/truck_service.dart';

/// Provider for search parameters
final loadSearchParamsProvider = StateProvider<LoadSearchParams>((ref) {
  return LoadSearchParams();
});

/// Provider for search results
final loadSearchResultsProvider =
    FutureProvider.autoDispose<LoadSearchResult>((ref) async {
  final params = ref.watch(loadSearchParamsProvider);
  final service = LoadService();
  final result = await service.searchLoads(
    page: params.page,
    limit: 20,
    status: 'POSTED',
    pickupCity: params.pickupCity,
    deliveryCity: params.deliveryCity,
    truckType: params.truckType,
    fullPartial: params.fullPartial,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  );
  return result.success
      ? result.data!
      : LoadSearchResult(loads: [], page: 1, limit: 20, total: 0, pages: 0);
});

/// Provider for carrier's approved trucks (for requesting loads)
final carrierApprovedTrucksProvider =
    FutureProvider.autoDispose<List<Truck>>((ref) async {
  final service = TruckService();
  final result = await service.getTrucks(approvalStatus: 'APPROVED');
  return result.success ? result.data ?? [] : [];
});

/// Provider for tracking sent requests
final sentRequestsProvider = StateProvider<Set<String>>((ref) => {});

/// Search parameters class
class LoadSearchParams {
  final int page;
  final String? pickupCity;
  final String? deliveryCity;
  final String? truckType;
  final String? fullPartial;
  final String sortBy;
  final String sortOrder;

  LoadSearchParams({
    this.page = 1,
    this.pickupCity,
    this.deliveryCity,
    this.truckType,
    this.fullPartial,
    this.sortBy = 'postedAt',
    this.sortOrder = 'desc',
  });

  LoadSearchParams copyWith({
    int? page,
    String? pickupCity,
    String? deliveryCity,
    String? truckType,
    String? fullPartial,
    String? sortBy,
    String? sortOrder,
  }) {
    return LoadSearchParams(
      page: page ?? this.page,
      pickupCity: pickupCity ?? this.pickupCity,
      deliveryCity: deliveryCity ?? this.deliveryCity,
      truckType: truckType ?? this.truckType,
      fullPartial: fullPartial ?? this.fullPartial,
      sortBy: sortBy ?? this.sortBy,
      sortOrder: sortOrder ?? this.sortOrder,
    );
  }

  LoadSearchParams clearFilters() {
    return LoadSearchParams(
      page: 1,
      sortBy: sortBy,
      sortOrder: sortOrder,
    );
  }
}

/// Carrier Loadboard Screen - Search Loads
class CarrierLoadboardScreen extends ConsumerStatefulWidget {
  const CarrierLoadboardScreen({super.key});

  @override
  ConsumerState<CarrierLoadboardScreen> createState() =>
      _CarrierLoadboardScreenState();
}

class _CarrierLoadboardScreenState
    extends ConsumerState<CarrierLoadboardScreen> {
  bool _showFilters = false;
  final _pickupController = TextEditingController();
  final _deliveryController = TextEditingController();

  @override
  void dispose() {
    _pickupController.dispose();
    _deliveryController.dispose();
    super.dispose();
  }

  void _applyFilters() {
    final params = ref.read(loadSearchParamsProvider);
    ref.read(loadSearchParamsProvider.notifier).state = params.copyWith(
      page: 1,
      pickupCity: _pickupController.text.trim().isNotEmpty
          ? _pickupController.text.trim()
          : null,
      deliveryCity: _deliveryController.text.trim().isNotEmpty
          ? _deliveryController.text.trim()
          : null,
    );
    setState(() => _showFilters = false);
  }

  void _clearFilters() {
    _pickupController.clear();
    _deliveryController.clear();
    ref.read(loadSearchParamsProvider.notifier).state =
        ref.read(loadSearchParamsProvider).clearFilters();
    setState(() => _showFilters = false);
  }

  @override
  Widget build(BuildContext context) {
    final resultsAsync = ref.watch(loadSearchResultsProvider);
    final params = ref.watch(loadSearchParamsProvider);
    final sentRequests = ref.watch(sentRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Find Loads'),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: _hasActiveFilters(params),
              child: Icon(_showFilters ? Icons.filter_list_off : Icons.filter_list),
            ),
            onPressed: () => setState(() => _showFilters = !_showFilters),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(loadSearchResultsProvider),
          ),
        ],
      ),
      body: SafeArea(
        top: false, // AppBar handles top safe area
        child: Column(
          children: [
            // Filters panel
            if (_showFilters) _FiltersPanel(
            pickupController: _pickupController,
            deliveryController: _deliveryController,
            params: params,
            onApply: _applyFilters,
            onClear: _clearFilters,
            onTruckTypeChanged: (type) {
              ref.read(loadSearchParamsProvider.notifier).state =
                  params.copyWith(page: 1, truckType: type);
            },
            onFullPartialChanged: (fp) {
              ref.read(loadSearchParamsProvider.notifier).state =
                  params.copyWith(page: 1, fullPartial: fp);
            },
          ),

          // Active filters chips
          if (_hasActiveFilters(params) && !_showFilters)
            _ActiveFiltersBar(
              params: params,
              onClear: _clearFilters,
            ),

          // Results
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(loadSearchResultsProvider),
              child: resultsAsync.when(
                data: (result) {
                  if (result.loads.isEmpty) {
                    return _EmptyState(hasFilters: _hasActiveFilters(params));
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: result.loads.length + 1,
                    itemBuilder: (context, index) {
                      if (index == result.loads.length) {
                        // Pagination info
                        return _PaginationInfo(
                          result: result,
                          onLoadMore: result.hasMore
                              ? () {
                                  ref.read(loadSearchParamsProvider.notifier).state =
                                      params.copyWith(page: params.page + 1);
                                }
                              : null,
                        );
                      }

                      final load = result.loads[index];
                      final isRequested = sentRequests.contains(load.id);

                      return _LoadCard(
                        load: load,
                        isRequested: isRequested,
                        onTap: () => context.push('/carrier/loadboard/${load.id}'),
                        onRequest: () => _showRequestModal(load),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => _ErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(loadSearchResultsProvider),
                ),
              ),
            ),
          ),
          ],
        ),
      ),
    );
  }

  bool _hasActiveFilters(LoadSearchParams params) {
    return params.pickupCity != null ||
        params.deliveryCity != null ||
        params.truckType != null ||
        params.fullPartial != null;
  }

  Future<void> _showRequestModal(Load load) async {
    final trucksAsync = ref.read(carrierApprovedTrucksProvider);
    final trucks = trucksAsync.valueOrNull ?? [];

    if (trucks.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You need at least one approved truck to request loads'),
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
    final service = LoadService();
    final result = await service.requestLoad(
      loadId: loadId,
      truckId: data['truckId'],
      notes: data['notes'],
      expiresInHours: data['expiresInHours'] ?? 24,
    );

    if (!mounted) return;

    if (result.success) {
      ref.read(sentRequestsProvider.notifier).update((state) => {...state, loadId});
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Request sent to shipper!'),
          backgroundColor: AppColors.success,
        ),
      );
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

/// Filters panel
class _FiltersPanel extends StatelessWidget {
  final TextEditingController pickupController;
  final TextEditingController deliveryController;
  final LoadSearchParams params;
  final VoidCallback onApply;
  final VoidCallback onClear;
  final Function(String?) onTruckTypeChanged;
  final Function(String?) onFullPartialChanged;

  const _FiltersPanel({
    required this.pickupController,
    required this.deliveryController,
    required this.params,
    required this.onApply,
    required this.onClear,
    required this.onTruckTypeChanged,
    required this.onFullPartialChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Route search
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: pickupController,
                  decoration: const InputDecoration(
                    labelText: 'Pickup City',
                    prefixIcon: Icon(Icons.location_on, size: 20),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: deliveryController,
                  decoration: const InputDecoration(
                    labelText: 'Delivery City',
                    prefixIcon: Icon(Icons.flag, size: 20),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Truck type and full/partial
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: params.truckType,
                  decoration: const InputDecoration(
                    labelText: 'Truck Type',
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('Any')),
                    DropdownMenuItem(value: 'FLATBED', child: Text('Flatbed')),
                    DropdownMenuItem(value: 'REFRIGERATED', child: Text('Refrigerated')),
                    DropdownMenuItem(value: 'TANKER', child: Text('Tanker')),
                    DropdownMenuItem(value: 'CONTAINER', child: Text('Container')),
                    DropdownMenuItem(value: 'DRY_VAN', child: Text('Dry Van')),
                    DropdownMenuItem(value: 'BOX_TRUCK', child: Text('Box Truck')),
                  ],
                  onChanged: onTruckTypeChanged,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: params.fullPartial,
                  decoration: const InputDecoration(
                    labelText: 'Load Type',
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('Any')),
                    DropdownMenuItem(value: 'FULL', child: Text('Full Load')),
                    DropdownMenuItem(value: 'PARTIAL', child: Text('Partial')),
                  ],
                  onChanged: onFullPartialChanged,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onClear,
                  child: const Text('Clear'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: onApply,
                  child: const Text('Search'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Active filters bar
class _ActiveFiltersBar extends StatelessWidget {
  final LoadSearchParams params;
  final VoidCallback onClear;

  const _ActiveFiltersBar({
    required this.params,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            if (params.pickupCity != null)
              _FilterChip(label: 'From: ${params.pickupCity}'),
            if (params.deliveryCity != null)
              _FilterChip(label: 'To: ${params.deliveryCity}'),
            if (params.truckType != null)
              _FilterChip(label: params.truckType!),
            if (params.fullPartial != null)
              _FilterChip(label: params.fullPartial!),
            const SizedBox(width: 8),
            TextButton.icon(
              onPressed: onClear,
              icon: const Icon(Icons.clear, size: 16),
              label: const Text('Clear'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.error,
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;

  const _FilterChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      constraints: const BoxConstraints(minHeight: 36), // Better touch target
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primary100,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          color: AppColors.primary700,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

/// Load card
class _LoadCard extends StatelessWidget {
  final Load load;
  final bool isRequested;
  final VoidCallback onTap;
  final VoidCallback onRequest;

  const _LoadCard({
    required this.load,
    required this.isRequested,
    required this.onTap,
    required this.onRequest,
  });

  @override
  Widget build(BuildContext context) {
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
              // Header with age and truck type
              Row(
                children: [
                  _AgeIndicator(postedAt: load.postedAt ?? load.createdAt),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.slate100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      load.truckType.toString().split('.').last,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[700],
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (load.fullPartial == LoadType.partial)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.accent100,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'Partial',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.accent,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),

              // Route
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.radio_button_checked,
                                size: 14, color: AppColors.primary),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                load.pickupCity ?? 'N/A',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          margin: const EdgeInsets.only(left: 6, top: 2, bottom: 2),
                          width: 1,
                          height: 16,
                          color: AppColors.slate300,
                        ),
                        Row(
                          children: [
                            const Icon(Icons.location_on, size: 14, color: AppColors.accent),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                load.deliveryCity ?? 'N/A',
                                style: const TextStyle(fontWeight: FontWeight.w600),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      if (load.tripKm != null || load.estimatedTripKm != null)
                        Text(
                          '${(load.tripKm ?? load.estimatedTripKm)!.toStringAsFixed(0)} km',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      Text(
                        DateFormat('MMM d').format(load.pickupDate),
                        style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Details row
              Row(
                children: [
                  _DetailChip(icon: Icons.scale, label: load.weightDisplay),
                  const SizedBox(width: 8),
                  if (load.cargoDescription.isNotEmpty)
                    Expanded(
                      child: Text(
                        load.cargoDescription,
                        style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),

              // Shipper info with verified badge (read-only display)
              if (load.shipperName != null && load.shipperName!.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.slate100,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.business, size: 14, color: Colors.grey[600]),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          load.shipperName!,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (load.shipperIsVerified) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.verified, size: 12, color: AppColors.primary),
                              SizedBox(width: 3),
                              Text(
                                'Verified',
                                style: TextStyle(
                                  fontSize: 10,
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
              if (load.shipperName != null && load.shipperName!.isNotEmpty)
                const SizedBox(height: 10),

              // Service fee display (read-only)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.receipt_long, size: 14, color: AppColors.primary.withValues(alpha: 0.8)),
                    const SizedBox(width: 6),
                    Text(
                      'Service Fee: ${load.serviceFeeEtb != null ? '${load.serviceFeeEtb!.toStringAsFixed(0)} ETB' : 'Calculated on booking'}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary.withValues(alpha: 0.9),
                      ),
                    ),
                    if (load.tripKm != null || load.estimatedTripKm != null) ...[
                      const Spacer(),
                      Text(
                        '${(load.tripKm ?? load.estimatedTripKm)!.toStringAsFixed(0)} km',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Action button
              SizedBox(
                width: double.infinity,
                child: isRequested
                    ? OutlinedButton.icon(
                        onPressed: null,
                        icon: const Icon(Icons.check, size: 18),
                        label: const Text('REQUEST SENT'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.success,
                          side: const BorderSide(color: AppColors.success),
                        ),
                      )
                    : ElevatedButton.icon(
                        onPressed: onRequest,
                        icon: const Icon(Icons.send, size: 18),
                        label: const Text('Request Load'),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Age indicator
class _AgeIndicator extends StatelessWidget {
  final DateTime postedAt;

  const _AgeIndicator({required this.postedAt});

  @override
  Widget build(BuildContext context) {
    final diff = DateTime.now().difference(postedAt);
    final (label, color) = _getAgeInfo(diff);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }

  (String, Color) _getAgeInfo(Duration diff) {
    if (diff.inMinutes < 30) {
      return ('${diff.inMinutes}m', AppColors.success);
    } else if (diff.inMinutes < 60) {
      return ('${diff.inMinutes}m', Colors.amber);
    } else if (diff.inHours < 24) {
      return ('${diff.inHours}h', Colors.orange);
    } else {
      return ('${diff.inDays}d', Colors.grey);
    }
  }
}

/// Detail chip
class _DetailChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _DetailChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.slate100,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.grey[600]),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(fontSize: 12, color: Colors.grey[700]),
          ),
        ],
      ),
    );
  }
}

/// Pagination info
class _PaginationInfo extends StatelessWidget {
  final LoadSearchResult result;
  final VoidCallback? onLoadMore;

  const _PaginationInfo({required this.result, this.onLoadMore});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Text(
            'Showing ${result.loads.length} of ${result.total} loads',
            style: TextStyle(color: Colors.grey[600], fontSize: 13),
          ),
          if (onLoadMore != null) ...[
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onLoadMore,
              child: const Text('Load More'),
            ),
          ],
        ],
      ),
    );
  }
}

/// Empty state
class _EmptyState extends StatelessWidget {
  final bool hasFilters;

  const _EmptyState({required this.hasFilters});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              hasFilters ? Icons.search_off : Icons.inventory_2_outlined,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              hasFilters ? 'No Loads Found' : 'No Available Loads',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              hasFilters
                  ? 'Try adjusting your search filters'
                  : 'Check back later for new load postings',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      ),
    );
  }
}

/// Error state
class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[400]),
            const SizedBox(height: 16),
            const Text('Failed to load results',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(message,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey[600])),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
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
                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
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
              initialValue: _selectedTruckId,
              decoration: const InputDecoration(
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
