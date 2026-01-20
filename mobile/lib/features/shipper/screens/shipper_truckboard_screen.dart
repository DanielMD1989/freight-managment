import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart';
import '../../../core/models/truck.dart';
import '../../../core/models/load.dart';
import '../../../core/services/truck_service.dart';
import '../../../core/services/load_service.dart';

/// Provider for truck search parameters
final truckSearchParamsProvider = StateProvider<TruckSearchParams>((ref) {
  return TruckSearchParams();
});

/// Provider for truck search results
final truckSearchResultsProvider =
    FutureProvider.autoDispose<TruckSearchResult>((ref) async {
  final params = ref.watch(truckSearchParamsProvider);
  final service = TruckService();
  final result = await service.searchTrucks(
    page: params.page,
    limit: 20,
    availableCity: params.availableCity,
    truckType: params.truckType,
    minCapacity: params.minCapacity,
    isAvailable: true,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  );
  return result.success
      ? result.data!
      : TruckSearchResult(trucks: [], page: 1, limit: 20, total: 0, pages: 0);
});

/// Provider for shipper's posted loads (for booking trucks)
final shipperPostedLoadsProvider =
    FutureProvider.autoDispose<List<Load>>((ref) async {
  final service = LoadService();
  final result = await service.searchLoads(
    status: 'POSTED',
    myLoads: true,
  );
  return result.success ? result.data?.loads ?? [] : [];
});

/// Provider for tracking sent requests
final sentTruckRequestsProvider = StateProvider<Set<String>>((ref) => {});

/// Search parameters class
class TruckSearchParams {
  final int page;
  final String? availableCity;
  final String? truckType;
  final double? minCapacity;
  final String sortBy;
  final String sortOrder;

  TruckSearchParams({
    this.page = 1,
    this.availableCity,
    this.truckType,
    this.minCapacity,
    this.sortBy = 'createdAt',
    this.sortOrder = 'desc',
  });

  TruckSearchParams copyWith({
    int? page,
    String? availableCity,
    String? truckType,
    double? minCapacity,
    String? sortBy,
    String? sortOrder,
  }) {
    return TruckSearchParams(
      page: page ?? this.page,
      availableCity: availableCity ?? this.availableCity,
      truckType: truckType ?? this.truckType,
      minCapacity: minCapacity ?? this.minCapacity,
      sortBy: sortBy ?? this.sortBy,
      sortOrder: sortOrder ?? this.sortOrder,
    );
  }

  TruckSearchParams clearFilters() {
    return TruckSearchParams(
      page: 1,
      sortBy: sortBy,
      sortOrder: sortOrder,
    );
  }
}

/// Shipper Truckboard Screen - Search available trucks
class ShipperTruckboardScreen extends ConsumerStatefulWidget {
  const ShipperTruckboardScreen({super.key});

  @override
  ConsumerState<ShipperTruckboardScreen> createState() =>
      _ShipperTruckboardScreenState();
}

class _ShipperTruckboardScreenState
    extends ConsumerState<ShipperTruckboardScreen> {
  bool _showFilters = false;
  final _cityController = TextEditingController();
  final _minCapacityController = TextEditingController();

  @override
  void dispose() {
    _cityController.dispose();
    _minCapacityController.dispose();
    super.dispose();
  }

  void _applyFilters() {
    final params = ref.read(truckSearchParamsProvider);
    ref.read(truckSearchParamsProvider.notifier).state = params.copyWith(
      page: 1,
      availableCity: _cityController.text.trim().isNotEmpty
          ? _cityController.text.trim()
          : null,
      minCapacity: _minCapacityController.text.isNotEmpty
          ? double.tryParse(_minCapacityController.text)
          : null,
    );
    setState(() => _showFilters = false);
  }

  void _clearFilters() {
    _cityController.clear();
    _minCapacityController.clear();
    ref.read(truckSearchParamsProvider.notifier).state =
        ref.read(truckSearchParamsProvider).clearFilters();
    setState(() => _showFilters = false);
  }

  @override
  Widget build(BuildContext context) {
    final resultsAsync = ref.watch(truckSearchResultsProvider);
    final params = ref.watch(truckSearchParamsProvider);
    final sentRequests = ref.watch(sentTruckRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Find Trucks'),
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
            onPressed: () => ref.invalidate(truckSearchResultsProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // Filters panel
          if (_showFilters)
            _FiltersPanel(
              cityController: _cityController,
              minCapacityController: _minCapacityController,
              params: params,
              onApply: _applyFilters,
              onClear: _clearFilters,
              onTruckTypeChanged: (type) {
                ref.read(truckSearchParamsProvider.notifier).state =
                    params.copyWith(page: 1, truckType: type);
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
              onRefresh: () async => ref.invalidate(truckSearchResultsProvider),
              child: resultsAsync.when(
                data: (result) {
                  if (result.trucks.isEmpty) {
                    return _EmptyState(hasFilters: _hasActiveFilters(params));
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: result.trucks.length + 1,
                    itemBuilder: (context, index) {
                      if (index == result.trucks.length) {
                        // Pagination info
                        return _PaginationInfo(
                          result: result,
                          onLoadMore: result.hasMore
                              ? () {
                                  ref
                                      .read(truckSearchParamsProvider.notifier)
                                      .state =
                                      params.copyWith(page: params.page + 1);
                                }
                              : null,
                        );
                      }

                      final truck = result.trucks[index];
                      final isRequested = sentRequests.contains(truck.id);

                      return _TruckCard(
                        truck: truck,
                        isRequested: isRequested,
                        onTap: () =>
                            context.push('/shipper/trucks/${truck.id}'),
                        onBook: () => _showBookingModal(truck),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => _ErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(truckSearchResultsProvider),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool _hasActiveFilters(TruckSearchParams params) {
    return params.availableCity != null ||
        params.truckType != null ||
        params.minCapacity != null;
  }

  Future<void> _showBookingModal(Truck truck) async {
    final loadsAsync = ref.read(shipperPostedLoadsProvider);
    final loads = loadsAsync.valueOrNull ?? [];

    if (loads.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You need at least one posted load to book a truck'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _BookTruckModal(
        truck: truck,
        loads: loads,
      ),
    );

    if (result != null && mounted) {
      await _submitBooking(truck.id, result);
    }
  }

  Future<void> _submitBooking(String truckId, Map<String, dynamic> data) async {
    final service = TruckService();
    final result = await service.requestTruck(
      truckId: truckId,
      loadId: data['loadId'],
      notes: data['notes'],
      expiresInHours: data['expiresInHours'] ?? 24,
    );

    if (!mounted) return;

    if (result.success) {
      ref
          .read(sentTruckRequestsProvider.notifier)
          .update((state) => {...state, truckId});
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Booking request sent to carrier!'),
          backgroundColor: AppColors.success,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.error ?? 'Failed to send booking request'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }
}

/// Filters panel
class _FiltersPanel extends StatelessWidget {
  final TextEditingController cityController;
  final TextEditingController minCapacityController;
  final TruckSearchParams params;
  final VoidCallback onApply;
  final VoidCallback onClear;
  final Function(String?) onTruckTypeChanged;

  const _FiltersPanel({
    required this.cityController,
    required this.minCapacityController,
    required this.params,
    required this.onApply,
    required this.onClear,
    required this.onTruckTypeChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Location search
          TextField(
            controller: cityController,
            decoration: const InputDecoration(
              labelText: 'Available In City',
              hintText: 'e.g., Addis Ababa',
              prefixIcon: Icon(Icons.location_on, size: 20),
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
          ),
          const SizedBox(height: 12),

          // Truck type and capacity
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: params.truckType,
                  decoration: const InputDecoration(
                    labelText: 'Truck Type',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('Any')),
                    DropdownMenuItem(value: 'FLATBED', child: Text('Flatbed')),
                    DropdownMenuItem(
                        value: 'REFRIGERATED', child: Text('Refrigerated')),
                    DropdownMenuItem(value: 'TANKER', child: Text('Tanker')),
                    DropdownMenuItem(
                        value: 'CONTAINER', child: Text('Container')),
                    DropdownMenuItem(value: 'DRY_VAN', child: Text('Dry Van')),
                    DropdownMenuItem(
                        value: 'BOX_TRUCK', child: Text('Box Truck')),
                  ],
                  onChanged: onTruckTypeChanged,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: minCapacityController,
                  decoration: const InputDecoration(
                    labelText: 'Min Capacity (kg)',
                    hintText: 'e.g., 5000',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  keyboardType: TextInputType.number,
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
  final TruckSearchParams params;
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
            if (params.availableCity != null)
              _FilterChip(label: 'City: ${params.availableCity}'),
            if (params.truckType != null)
              _FilterChip(label: params.truckType!),
            if (params.minCapacity != null)
              _FilterChip(label: '>${params.minCapacity!.toStringAsFixed(0)}kg'),
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.primary100,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          color: AppColors.primary700,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

/// Truck card
class _TruckCard extends StatelessWidget {
  final Truck truck;
  final bool isRequested;
  final VoidCallback onTap;
  final VoidCallback onBook;

  const _TruckCard({
    required this.truck,
    required this.isRequested,
    required this.onTap,
    required this.onBook,
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
              // Header with truck type and availability
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.primary100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.local_shipping,
                            size: 14, color: AppColors.primary),
                        const SizedBox(width: 4),
                        Text(
                          truck.truckTypeDisplay,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (truck.isAvailable)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.success.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle,
                              size: 12, color: AppColors.success),
                          SizedBox(width: 4),
                          Text(
                            'Available',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppColors.success,
                            ),
                          ),
                        ],
                      ),
                    ),
                  const Spacer(),
                  Text(
                    truck.licensePlate,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Carrier and location
              Row(
                children: [
                  if (truck.ownerName != null) ...[
                    Icon(Icons.business, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        truck.ownerName!,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
              if (truck.currentCity != null) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(Icons.location_on, size: 14, color: AppColors.accent),
                    const SizedBox(width: 4),
                    Text(
                      truck.currentCity!,
                      style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 12),

              // Specs row
              Row(
                children: [
                  _SpecChip(
                    icon: Icons.scale,
                    label: truck.capacityDisplay,
                  ),
                  const SizedBox(width: 8),
                  if (truck.volume != null)
                    _SpecChip(
                      icon: Icons.straighten,
                      label: '${truck.volume!.toStringAsFixed(0)} m³',
                    ),
                ],
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
                        onPressed: onBook,
                        icon: const Icon(Icons.bookmark_add, size: 18),
                        label: const Text('Book Truck'),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Spec chip
class _SpecChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _SpecChip({required this.icon, required this.label});

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
  final TruckSearchResult result;
  final VoidCallback? onLoadMore;

  const _PaginationInfo({required this.result, this.onLoadMore});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Text(
            'Showing ${result.trucks.length} of ${result.total} trucks',
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
              hasFilters ? Icons.search_off : Icons.local_shipping_outlined,
              size: 64,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 16),
            Text(
              hasFilters ? 'No Trucks Found' : 'No Available Trucks',
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
                  : 'Check back later for available trucks',
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
            const Text('Failed to load trucks',
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

/// Book truck modal
class _BookTruckModal extends StatefulWidget {
  final Truck truck;
  final List<Load> loads;

  const _BookTruckModal({required this.truck, required this.loads});

  @override
  State<_BookTruckModal> createState() => _BookTruckModalState();
}

class _BookTruckModalState extends State<_BookTruckModal> {
  String? _selectedLoadId;
  final _notesController = TextEditingController();
  int _expiresInHours = 24;

  @override
  void initState() {
    super.initState();
    if (widget.loads.isNotEmpty) {
      _selectedLoadId = widget.loads.first.id;
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
                  'Book Truck',
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

            // Truck summary
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.slate100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.local_shipping,
                        color: AppColors.primary),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.truck.truckTypeDisplay,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${widget.truck.licensePlate} • ${widget.truck.capacityDisplay}',
                          style:
                              TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Load selection
            const Text(
              'Select Load *',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _selectedLoadId,
              decoration: const InputDecoration(
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
              items: widget.loads.map((load) {
                return DropdownMenuItem(
                  value: load.id,
                  child: Text(
                    '${load.pickupCity} → ${load.deliveryCity} (${load.weightDisplay})',
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              }).toList(),
              onChanged: (value) => setState(() => _selectedLoadId = value),
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
                hintText: 'Add any notes for the carrier...',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 24),

            // Submit button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _selectedLoadId == null
                    ? null
                    : () {
                        Navigator.pop(context, {
                          'loadId': _selectedLoadId,
                          'notes': _notesController.text.trim(),
                          'expiresInHours': _expiresInHours,
                        });
                      },
                child: const Text('Send Booking Request'),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
