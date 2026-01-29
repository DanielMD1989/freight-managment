import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart';
import '../../../core/models/truck.dart';
import '../../../core/models/load.dart';
import '../../../core/services/truck_service.dart';
import '../../../core/services/load_service.dart';

/// Provider for truck search parameters (WEB PARITY: matches SearchTrucksTab filters)
final truckSearchParamsProvider = StateProvider<TruckSearchParams>((ref) {
  return TruckSearchParams();
});

/// Provider for truck POSTING search results (WEB PARITY: returns full posting data)
final truckPostingSearchResultsProvider =
    FutureProvider.autoDispose<TruckPostingSearchResult>((ref) async {
  final params = ref.watch(truckSearchParamsProvider);
  final service = TruckService();
  // Use searchTruckPostings() for FULL posting data with direction
  final result = await service.searchTruckPostings(
    page: params.page,
    limit: 20,
    origin: params.availableCity,      // WEB PARITY: origin filter
    destination: params.destination,    // WEB PARITY: destination filter
    truckType: params.truckType,
    fullPartial: params.fullPartial,    // WEB PARITY: full/partial filter
    minLength: params.minLength,        // WEB PARITY: length filter
    maxWeight: params.maxWeight,        // WEB PARITY: weight filter
    availableFrom: params.availableFrom, // WEB PARITY: availability filter
    ageHours: params.ageHours,          // WEB PARITY: age filter
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  );
  return result.success
      ? result.data!
      : TruckPostingSearchResult(postings: [], page: 1, limit: 20, total: 0, pages: 0);
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

/// Search parameters class (WEB PARITY: matches SearchTrucksTab.tsx filters)
class TruckSearchParams {
  final int page;
  final String? availableCity;  // Origin city
  final String? destination;    // WEB PARITY: destination city filter
  final String? truckType;
  final String? fullPartial;    // WEB PARITY: FULL, PARTIAL, BOTH
  final double? minCapacity;
  final double? minLength;      // WEB PARITY: minimum length (m)
  final double? maxWeight;      // WEB PARITY: maximum weight (kg)
  final DateTime? availableFrom; // WEB PARITY: availability date
  final int? ageHours;          // WEB PARITY: max posting age
  final String sortBy;
  final String sortOrder;

  TruckSearchParams({
    this.page = 1,
    this.availableCity,
    this.destination,
    this.truckType,
    this.fullPartial,
    this.minCapacity,
    this.minLength,
    this.maxWeight,
    this.availableFrom,
    this.ageHours,
    this.sortBy = 'createdAt',
    this.sortOrder = 'desc',
  });

  TruckSearchParams copyWith({
    int? page,
    String? availableCity,
    String? destination,
    String? truckType,
    String? fullPartial,
    double? minCapacity,
    double? minLength,
    double? maxWeight,
    DateTime? availableFrom,
    int? ageHours,
    String? sortBy,
    String? sortOrder,
  }) {
    return TruckSearchParams(
      page: page ?? this.page,
      availableCity: availableCity ?? this.availableCity,
      destination: destination ?? this.destination,
      truckType: truckType ?? this.truckType,
      fullPartial: fullPartial ?? this.fullPartial,
      minCapacity: minCapacity ?? this.minCapacity,
      minLength: minLength ?? this.minLength,
      maxWeight: maxWeight ?? this.maxWeight,
      availableFrom: availableFrom ?? this.availableFrom,
      ageHours: ageHours ?? this.ageHours,
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
  /// Optional origin city to pre-fill filter (from Find Trucks button)
  final String? origin;

  /// Optional destination city (for context)
  final String? destination;

  /// Optional load ID (for booking trucks for specific load)
  final String? loadId;

  const ShipperTruckboardScreen({
    super.key,
    this.origin,
    this.destination,
    this.loadId,
  });

  @override
  ConsumerState<ShipperTruckboardScreen> createState() =>
      _ShipperTruckboardScreenState();
}

class _ShipperTruckboardScreenState
    extends ConsumerState<ShipperTruckboardScreen> {
  bool _showFilters = false;
  final _cityController = TextEditingController();
  final _destinationController = TextEditingController();  // WEB PARITY
  final _minCapacityController = TextEditingController();
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    // Pre-fill city filter from query parameters
    if (widget.origin != null && widget.origin!.isNotEmpty) {
      _cityController.text = widget.origin!;
    }
    // Pre-fill destination from query params (WEB PARITY)
    if (widget.destination != null && widget.destination!.isNotEmpty) {
      _destinationController.text = widget.destination!;
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Apply initial filter from query params (only once)
    if (!_initialized && (widget.origin != null || widget.destination != null)) {
      _initialized = true;
      // Use post-frame callback to avoid modifying provider during build
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ref.read(truckSearchParamsProvider.notifier).state = TruckSearchParams(
            availableCity: widget.origin?.isNotEmpty == true ? widget.origin : null,
            destination: widget.destination?.isNotEmpty == true ? widget.destination : null,
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _cityController.dispose();
    _destinationController.dispose();
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
      destination: _destinationController.text.trim().isNotEmpty
          ? _destinationController.text.trim()
          : null,
      minCapacity: _minCapacityController.text.isNotEmpty
          ? double.tryParse(_minCapacityController.text)
          : null,
    );
    setState(() => _showFilters = false);
  }

  void _clearFilters() {
    _cityController.clear();
    _destinationController.clear();
    _minCapacityController.clear();
    ref.read(truckSearchParamsProvider.notifier).state =
        ref.read(truckSearchParamsProvider).clearFilters();
    setState(() => _showFilters = false);
  }

  @override
  Widget build(BuildContext context) {
    // WEB PARITY: Use posting search results with full direction data
    final resultsAsync = ref.watch(truckPostingSearchResultsProvider);
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
            onPressed: () => ref.invalidate(truckPostingSearchResultsProvider),
          ),
        ],
      ),
      body: SafeArea(
        top: false, // AppBar handles top safe area
        child: Column(
          children: [
            // Load context banner (when navigating from Find Trucks on a specific load)
            if (widget.origin != null || widget.destination != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                border: Border(
                  bottom: BorderSide(color: AppColors.primary.withValues(alpha: 0.2)),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_shipping, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Finding trucks for: ${widget.origin ?? ''} → ${widget.destination ?? ''}',
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      _cityController.clear();
                      ref.read(truckSearchParamsProvider.notifier).state =
                          TruckSearchParams();
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      minimumSize: Size.zero,
                    ),
                    child: const Text('Clear'),
                  ),
                ],
              ),
            ),
          // Filters panel (WEB PARITY: includes destination and full/partial)
          if (_showFilters)
            _FiltersPanel(
              cityController: _cityController,
              destinationController: _destinationController,
              minCapacityController: _minCapacityController,
              params: params,
              onApply: _applyFilters,
              onClear: _clearFilters,
              onTruckTypeChanged: (type) {
                ref.read(truckSearchParamsProvider.notifier).state =
                    params.copyWith(page: 1, truckType: type);
              },
              onFullPartialChanged: (fp) {
                ref.read(truckSearchParamsProvider.notifier).state =
                    params.copyWith(page: 1, fullPartial: fp);
              },
            ),

          // Active filters chips
          if (_hasActiveFilters(params) && !_showFilters)
            _ActiveFiltersBar(
              params: params,
              onClear: _clearFilters,
            ),

          // Results (WEB PARITY: displays postings with direction)
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(truckPostingSearchResultsProvider),
              child: resultsAsync.when(
                data: (result) {
                  if (result.postings.isEmpty) {
                    return _EmptyState(hasFilters: _hasActiveFilters(params));
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: result.postings.length + 1,
                    itemBuilder: (context, index) {
                      if (index == result.postings.length) {
                        // Pagination info
                        return _PostingPaginationInfo(
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

                      final posting = result.postings[index];
                      final isRequested = sentRequests.contains(posting.truckId);

                      // WEB PARITY: Use posting card with direction display
                      return _TruckPostingCard(
                        posting: posting,
                        isRequested: isRequested,
                        onTap: () =>
                            context.push('/shipper/trucks/${posting.truckId}'),
                        onBook: () => _showPostingBookingModal(posting),
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => _ErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(truckPostingSearchResultsProvider),
                ),
              ),
            ),
          ),
          ],
        ),
      ),
    );
  }

  bool _hasActiveFilters(TruckSearchParams params) {
    return params.availableCity != null ||
        params.destination != null ||
        params.truckType != null ||
        params.fullPartial != null ||
        params.minCapacity != null ||
        params.minLength != null ||
        params.maxWeight != null ||
        params.availableFrom != null ||
        params.ageHours != null;
  }

  /// WEB PARITY: Booking modal for truck postings
  /// SINGLE SOURCE OF TRUTH: Uses widget.loadId if provided (from Find Trucks button)
  Future<void> _showPostingBookingModal(TruckPosting posting) async {
    List<Load> loads = [];
    String? preSelectedLoadId = widget.loadId;

    // SINGLE SOURCE OF TRUTH: If loadId was passed via Find Trucks, fetch that specific load
    if (widget.loadId != null && widget.loadId!.isNotEmpty) {
      final loadService = LoadService();
      final loadResult = await loadService.getLoadById(widget.loadId!);
      if (loadResult.success && loadResult.data != null) {
        loads = [loadResult.data!];
        preSelectedLoadId = loadResult.data!.id;
      }
    }

    // Fallback: If no loadId provided or fetch failed, get all posted loads
    if (loads.isEmpty) {
      final loadsAsync = ref.read(shipperPostedLoadsProvider);
      loads = loadsAsync.valueOrNull ?? [];

      // If still empty, try fetching directly
      if (loads.isEmpty) {
        final loadService = LoadService();
        final result = await loadService.searchLoads(status: 'POSTED', myLoads: true);
        loads = result.success ? result.data?.loads ?? [] : [];
      }
    }

    if (!mounted) return;

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
      builder: (context) => _BookTruckPostingModal(
        posting: posting,
        loads: loads,
        preSelectedLoadId: preSelectedLoadId,  // Pass pre-selected load
      ),
    );

    if (result != null && mounted) {
      await _submitBooking(posting.truckId, result);
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

/// Filters panel (WEB PARITY: matches SearchTrucksTab.tsx filters)
class _FiltersPanel extends StatelessWidget {
  final TextEditingController cityController;
  final TextEditingController destinationController;
  final TextEditingController minCapacityController;
  final TruckSearchParams params;
  final VoidCallback onApply;
  final VoidCallback onClear;
  final Function(String?) onTruckTypeChanged;
  final Function(String?) onFullPartialChanged;

  const _FiltersPanel({
    required this.cityController,
    required this.destinationController,
    required this.minCapacityController,
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
          // WEB PARITY: Origin and Destination cities
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: cityController,
                  decoration: const InputDecoration(
                    labelText: 'Origin City',
                    hintText: 'From...',
                    prefixIcon: Icon(Icons.my_location, size: 20),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: destinationController,
                  decoration: const InputDecoration(
                    labelText: 'Destination',
                    hintText: 'To...',
                    prefixIcon: Icon(Icons.location_on, size: 20),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // WEB PARITY: Truck type and Full/Partial
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: params.truckType,
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
                child: DropdownButtonFormField<String>(
                  initialValue: params.fullPartial,
                  decoration: const InputDecoration(
                    labelText: 'Full/Partial',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                  items: const [
                    DropdownMenuItem(value: null, child: Text('Any')),
                    DropdownMenuItem(value: 'FULL', child: Text('Full Load')),
                    DropdownMenuItem(value: 'PARTIAL', child: Text('Partial')),
                    DropdownMenuItem(value: 'BOTH', child: Text('Both')),
                  ],
                  onChanged: onFullPartialChanged,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Capacity filter
          TextField(
            controller: minCapacityController,
            decoration: const InputDecoration(
              labelText: 'Min Capacity (kg)',
              hintText: 'e.g., 5000',
              prefixIcon: Icon(Icons.scale, size: 20),
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            ),
            keyboardType: TextInputType.number,
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

/// Active filters bar (WEB PARITY: shows all active filters)
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
              _FilterChip(label: 'From: ${params.availableCity}'),
            if (params.destination != null)
              _FilterChip(label: 'To: ${params.destination}'),
            if (params.truckType != null)
              _FilterChip(label: params.truckType!),
            if (params.fullPartial != null)
              _FilterChip(label: params.fullPartial!),
            if (params.minCapacity != null)
              _FilterChip(label: '>${params.minCapacity!.toStringAsFixed(0)}kg'),
            if (params.minLength != null)
              _FilterChip(label: '>${params.minLength!.toStringAsFixed(1)}m'),
            if (params.maxWeight != null)
              _FilterChip(label: '<${(params.maxWeight! / 1000).toStringAsFixed(1)}t'),
            if (params.ageHours != null)
              _FilterChip(label: '<${params.ageHours}h old'),
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

/// Spec chip for displaying truck specifications
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

/// WEB PARITY: Truck POSTING card with direction display (Origin → Destination)
class _TruckPostingCard extends StatelessWidget {
  final TruckPosting posting;
  final bool isRequested;
  final VoidCallback onTap;
  final VoidCallback onBook;

  const _TruckPostingCard({
    required this.posting,
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
              // WEB PARITY: Header row with Age, Truck Type, F/P indicator
              Row(
                children: [
                  // Age badge (WEB PARITY: matches "Age" column)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.grey[200],
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      posting.ageDisplay,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[700],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Truck type badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.primary100,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.local_shipping, size: 14, color: AppColors.primary),
                        const SizedBox(width: 4),
                        Text(
                          posting.truckTypeDisplay,
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
                  // WEB PARITY: Full/Partial indicator
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      posting.fullPartialDisplay,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.accent,
                      ),
                    ),
                  ),
                  const Spacer(),
                  // WEB PARITY: Availability indicator
                  Text(
                    'Avail: ${posting.availabilityDisplay}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.success,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // WEB PARITY: Direction display (Origin → Destination)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.slate100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    // Origin
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'FROM',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey[500],
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            posting.originCityName ?? 'Unknown',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    // Arrow indicator
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Icon(
                        Icons.arrow_forward,
                        color: AppColors.primary,
                        size: 20,
                      ),
                    ),
                    // Destination
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'TO',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey[500],
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            posting.destinationCityName ?? 'Any',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // WEB PARITY: Company and specs row
              Row(
                children: [
                  Icon(Icons.business, size: 14, color: Colors.grey[500]),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Row(
                      children: [
                        Flexible(
                          child: Text(
                            posting.companyDisplay,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (posting.carrierIsVerified == true) ...[
                          const SizedBox(width: 4),
                          const Icon(Icons.verified, size: 14, color: AppColors.primary),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Specs chips (WEB PARITY: matches Length, Weight columns)
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  _SpecChip(icon: Icons.scale, label: posting.capacityDisplay),
                  if (posting.lengthDisplay != null)
                    _SpecChip(icon: Icons.straighten, label: posting.lengthDisplay!),
                  if (posting.weightDisplay != null)
                    _SpecChip(icon: Icons.fitness_center, label: posting.weightDisplay!),
                ],
              ),
              const SizedBox(height: 10),

              // Service fee info (read-only display)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppColors.accent.withValues(alpha: 0.2)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, size: 14, color: AppColors.accent.withValues(alpha: 0.8)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Service fee calculated on booking (Distance × Rate)',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.accent.withValues(alpha: 0.9),
                        ),
                      ),
                    ),
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

/// WEB PARITY: Pagination info for posting results
class _PostingPaginationInfo extends StatelessWidget {
  final TruckPostingSearchResult result;
  final VoidCallback? onLoadMore;

  const _PostingPaginationInfo({required this.result, this.onLoadMore});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Text(
            'Showing ${result.postings.length} of ${result.total} truck postings',
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
              initialValue: _selectedLoadId,
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

/// WEB PARITY: Book truck posting modal with direction display
/// SINGLE SOURCE OF TRUTH: Uses preSelectedLoadId if provided (from Find Trucks)
class _BookTruckPostingModal extends StatefulWidget {
  final TruckPosting posting;
  final List<Load> loads;
  final String? preSelectedLoadId;  // From Find Trucks button navigation

  const _BookTruckPostingModal({
    required this.posting,
    required this.loads,
    this.preSelectedLoadId,
  });

  @override
  State<_BookTruckPostingModal> createState() => _BookTruckPostingModalState();
}

class _BookTruckPostingModalState extends State<_BookTruckPostingModal> {
  String? _selectedLoadId;
  final _notesController = TextEditingController();
  int _expiresInHours = 24;

  @override
  void initState() {
    super.initState();
    // SINGLE SOURCE OF TRUTH: Use pre-selected loadId if provided
    if (widget.preSelectedLoadId != null) {
      _selectedLoadId = widget.preSelectedLoadId;
    } else if (widget.loads.isNotEmpty) {
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

            // WEB PARITY: Truck posting summary with direction
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.slate100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: AppColors.primary100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.local_shipping, color: AppColors.primary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.posting.truckTypeDisplay,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              widget.posting.capacityDisplay,
                              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                            ),
                          ],
                        ),
                      ),
                      // F/P indicator
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.accent.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          widget.posting.fullPartialDisplay,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.accent,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Direction indicator
                  Row(
                    children: [
                      Icon(Icons.my_location, size: 16, color: Colors.grey[600]),
                      const SizedBox(width: 4),
                      Text(
                        widget.posting.originCityName ?? 'Unknown',
                        style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.arrow_forward, size: 14, color: AppColors.primary),
                      const SizedBox(width: 8),
                      const Icon(Icons.location_on, size: 16, color: AppColors.accent),
                      const SizedBox(width: 4),
                      Text(
                        widget.posting.destinationCityName ?? 'Any',
                        style: TextStyle(fontSize: 13, color: Colors.grey[700]),
                      ),
                    ],
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
              initialValue: _selectedLoadId,
              decoration: const InputDecoration(
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
              onSelectionChanged: (set) => setState(() => _expiresInHours = set.first),
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
