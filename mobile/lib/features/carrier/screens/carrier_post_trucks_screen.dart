import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/truck.dart';
import '../../../core/services/truck_service.dart';

/// Provider for Ethiopian locations
final ethiopianLocationsProvider =
    FutureProvider.autoDispose<List<EthiopianLocation>>((ref) async {
  final service = TruckService();
  final result = await service.getEthiopianLocations();
  return result.success ? result.data ?? [] : [];
});

/// Provider for approved trucks (can be posted)
final approvedTrucksForPostingProvider =
    FutureProvider.autoDispose<List<Truck>>((ref) async {
  final service = TruckService();
  final result = await service.getTrucks(approvalStatus: 'APPROVED');
  return result.success ? result.data ?? [] : [];
});

/// Provider for posting status filter
final postingStatusFilterProvider = StateProvider<String>((ref) => 'ACTIVE');

/// Provider for truck postings
final myTruckPostingsProvider =
    FutureProvider.autoDispose<TruckPostingsResult>((ref) async {
  final status = ref.watch(postingStatusFilterProvider);
  final service = TruckService();
  final result = await service.getMyTruckPostings(status: status);
  return result.success
      ? result.data!
      : TruckPostingsResult(postings: [], total: 0);
});

/// Provider for all active postings (for one-active-post validation)
/// Per RULE_ONE_ACTIVE_POST_PER_TRUCK: Each truck can only have one active posting
final allActivePostingsProvider =
    FutureProvider.autoDispose<List<TruckPosting>>((ref) async {
  final service = TruckService();
  final result = await service.getMyTruckPostings(status: 'ACTIVE');
  return result.success ? result.data!.postings : [];
});

/// Carrier Post Trucks Screen
class CarrierPostTrucksScreen extends ConsumerStatefulWidget {
  const CarrierPostTrucksScreen({super.key});

  @override
  ConsumerState<CarrierPostTrucksScreen> createState() =>
      _CarrierPostTrucksScreenState();
}

class _CarrierPostTrucksScreenState
    extends ConsumerState<CarrierPostTrucksScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        final statuses = ['ACTIVE', 'UNPOSTED', 'EXPIRED'];
        ref.read(postingStatusFilterProvider.notifier).state =
            statuses[_tabController.index];
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final postingsAsync = ref.watch(myTruckPostingsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Post Trucks'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'POSTED'),
            Tab(text: 'UNPOSTED'),
            Tab(text: 'EXPIRED'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(myTruckPostingsProvider),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(myTruckPostingsProvider),
        child: postingsAsync.when(
          data: (result) {
            if (result.postings.isEmpty) {
              return _EmptyState(
                status: ref.watch(postingStatusFilterProvider),
                onPostNew: () => _showPostTruckModal(context),
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: result.postings.length,
              itemBuilder: (context, index) {
                final posting = result.postings[index];
                return _TruckPostingCard(
                  posting: posting,
                  onViewMatches: () => _showMatchingLoads(posting),
                  onEdit: () => _showEditPostingModal(posting),
                  onDelete: () => _confirmDelete(posting),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _ErrorState(
            message: error.toString(),
            onRetry: () => ref.invalidate(myTruckPostingsProvider),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showPostTruckModal(context),
        icon: const Icon(Icons.add),
        label: const Text('Post Truck'),
      ),
    );
  }

  Future<void> _showPostTruckModal(BuildContext context) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => const _PostTruckModal(),
    );

    if (result == true) {
      ref.invalidate(myTruckPostingsProvider);
    }
  }

  Future<void> _showMatchingLoads(TruckPosting posting) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => _MatchingLoadsSheet(postingId: posting.id),
    );
  }

  Future<void> _showEditPostingModal(TruckPosting posting) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _EditPostingModal(posting: posting),
    );

    if (result == true) {
      ref.invalidate(myTruckPostingsProvider);
    }
  }

  Future<void> _confirmDelete(TruckPosting posting) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Posting?'),
        content: Text(
          'Are you sure you want to delete the posting for ${posting.truck?.licensePlate ?? 'this truck'}?',
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

    if (confirmed == true && mounted) {
      final service = TruckService();
      final result = await service.deleteTruckPosting(posting.id);

      if (result.success) {
        ref.invalidate(myTruckPostingsProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Posting deleted'),
            backgroundColor: AppColors.success,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.error ?? 'Failed to delete posting'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
}

/// Truck posting card
class _TruckPostingCard extends StatelessWidget {
  final TruckPosting posting;
  final VoidCallback onViewMatches;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _TruckPostingCard({
    required this.posting,
    required this.onViewMatches,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final truck = posting.truck;

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
                    color: AppColors.primary100,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.local_shipping,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        truck?.licensePlate ?? 'Unknown Truck',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        '${truck?.truckTypeDisplay ?? 'N/A'} - ${truck?.capacityDisplay ?? 'N/A'}',
                        style: TextStyle(
                          color: Colors.grey[600],
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                _StatusBadge(status: posting.status),
              ],
            ),
            const SizedBox(height: 16),

            // Route
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.radio_button_checked,
                              size: 14, color: AppColors.primary),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              posting.originCityName ?? 'Any Origin',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        margin:
                            const EdgeInsets.only(left: 6, top: 2, bottom: 2),
                        width: 1,
                        height: 16,
                        color: AppColors.slate300,
                      ),
                      Row(
                        children: [
                          Icon(Icons.location_on,
                              size: 14, color: AppColors.accent),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              posting.destinationCityName ?? 'Any Destination',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Availability dates
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.slate100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today, size: 16, color: Colors.grey),
                  const SizedBox(width: 8),
                  Text(
                    'Available: ${DateFormat('MMM d').format(posting.availableFrom)}',
                    style: const TextStyle(fontSize: 13),
                  ),
                  if (posting.availableTo != null) ...[
                    const Text(' - ', style: TextStyle(fontSize: 13)),
                    Text(
                      DateFormat('MMM d').format(posting.availableTo!),
                      style: const TextStyle(fontSize: 13),
                    ),
                  ],
                  const Spacer(),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: posting.fullPartial == 'FULL'
                          ? AppColors.primary100
                          : AppColors.accent100,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      posting.fullPartial ?? 'FULL',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: posting.fullPartial == 'FULL'
                            ? AppColors.primary
                            : AppColors.accent,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onViewMatches,
                    icon: const Icon(Icons.local_shipping_outlined, size: 18),
                    label: const Text('View Matches'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined),
                  tooltip: 'Edit',
                ),
                IconButton(
                  onPressed: onDelete,
                  icon: const Icon(Icons.delete_outline),
                  color: AppColors.error,
                  tooltip: 'Delete',
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Status badge
class _StatusBadge extends StatelessWidget {
  final String status;

  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (status.toUpperCase()) {
      case 'ACTIVE':
      case 'POSTED':
        color = AppColors.success;
        break;
      case 'EXPIRED':
        color = AppColors.error;
        break;
      default:
        color = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }
}

/// Post truck modal
class _PostTruckModal extends ConsumerStatefulWidget {
  const _PostTruckModal();

  @override
  ConsumerState<_PostTruckModal> createState() => _PostTruckModalState();
}

class _PostTruckModalState extends ConsumerState<_PostTruckModal> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedTruckId;
  String? _selectedOriginCityId;
  String? _selectedDestinationCityId;
  DateTime _availableFrom = DateTime.now();
  DateTime? _availableTo;
  String _fullPartial = 'FULL';
  final _contactNameController = TextEditingController();
  final _contactPhoneController = TextEditingController();
  final _notesController = TextEditingController();
  bool _isSubmitting = false;

  /// Track if selected truck already has an active posting
  /// Per RULE_ONE_ACTIVE_POST_PER_TRUCK
  bool _truckHasActivePosting = false;
  String? _existingPostingInfo;

  @override
  void dispose() {
    _contactNameController.dispose();
    _contactPhoneController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  /// Check if truck has an active posting (RULE_ONE_ACTIVE_POST_PER_TRUCK)
  void _checkTruckActivePosting(String? truckId) {
    if (truckId == null) {
      setState(() {
        _truckHasActivePosting = false;
        _existingPostingInfo = null;
      });
      return;
    }

    final activePostings = ref.read(allActivePostingsProvider).valueOrNull ?? [];
    final existingPosting = activePostings
        .where((p) => p.truckId == truckId)
        .firstOrNull;

    setState(() {
      _truckHasActivePosting = existingPosting != null;
      if (existingPosting != null) {
        _existingPostingInfo =
            '${existingPosting.originCityName ?? "Unknown"} → ${existingPosting.destinationCityName ?? "Any"} '
            '(${DateFormat("MMM d").format(existingPosting.availableFrom)})';
      } else {
        _existingPostingInfo = null;
      }
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedTruckId == null || _selectedOriginCityId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a truck and origin city'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    // RULE_ONE_ACTIVE_POST_PER_TRUCK: Block if truck has active posting
    if (_truckHasActivePosting) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'This truck already has an active posting. '
            'Please expire or delete the existing posting first.',
          ),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final service = TruckService();
    final result = await service.createTruckPosting(
      truckId: _selectedTruckId!,
      originCityId: _selectedOriginCityId!,
      destinationCityId: _selectedDestinationCityId,
      availableFrom: _availableFrom,
      availableTo: _availableTo,
      fullPartial: _fullPartial,
      contactName: _contactNameController.text.trim(),
      contactPhone: _contactPhoneController.text.trim(),
      notes: _notesController.text.trim().isNotEmpty
          ? _notesController.text.trim()
          : null,
    );

    setState(() => _isSubmitting = false);

    if (!mounted) return;

    if (result.success) {
      Navigator.pop(context, true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Truck posted successfully!'),
          backgroundColor: AppColors.success,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.error ?? 'Failed to post truck'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final trucksAsync = ref.watch(approvedTrucksForPostingProvider);
    final locationsAsync = ref.watch(ethiopianLocationsProvider);
    final screenHeight = MediaQuery.of(context).size.height;
    final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;

    return SizedBox(
      height: screenHeight * 0.85,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text('Post Truck'),
          actions: [
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close),
            ),
          ],
        ),
        body: SingleChildScrollView(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: keyboardHeight + 16,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Truck selection
                const Text(
                        'Select Truck *',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      trucksAsync.when(
                        data: (trucks) {
                          final activePostings =
                              ref.watch(allActivePostingsProvider).valueOrNull ?? [];
                          final trucksWithActivePosting = activePostings
                              .map((p) => p.truckId)
                              .toSet();

                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              DropdownButtonFormField<String>(
                                value: _selectedTruckId,
                                isExpanded: true,
                                decoration: InputDecoration(
                                  hintText: 'Select an approved truck',
                                  errorText: _truckHasActivePosting
                                      ? 'This truck already has an active posting'
                                      : null,
                                ),
                                items: trucks.map((truck) {
                                  final hasActivePosting =
                                      trucksWithActivePosting.contains(truck.id);
                                  return DropdownMenuItem(
                                    value: truck.id,
                                    child: Text(
                                      '${truck.licensePlate} - ${truck.truckTypeDisplay}${hasActivePosting ? ' (POSTED)' : ''}',
                                      style: TextStyle(
                                        color: hasActivePosting
                                            ? AppColors.warning
                                            : null,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  );
                                }).toList(),
                                onChanged: (value) {
                                  setState(() => _selectedTruckId = value);
                                  _checkTruckActivePosting(value);
                                },
                                validator: (value) =>
                                    value == null ? 'Required' : null,
                              ),
                              // Warning for trucks with active posting
                              if (_truckHasActivePosting &&
                                  _existingPostingInfo != null) ...[
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AppColors.warning.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: AppColors.warning.withOpacity(0.3),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.warning_amber_rounded,
                                        color: AppColors.warning,
                                        size: 20,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            const Text(
                                              'One Active Post Per Truck',
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                fontSize: 12,
                                                color: AppColors.warning,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              'Existing: $_existingPostingInfo',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color:
                                                    AppColors.warning.withOpacity(0.8),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          );
                        },
                        loading: () => const LinearProgressIndicator(),
                        error: (_, __) => const Text('Failed to load trucks'),
                      ),
                      const SizedBox(height: 16),

                      // Origin city
                      const Text(
                        'Origin City *',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      locationsAsync.when(
                        data: (locations) => DropdownButtonFormField<String>(
                          value: _selectedOriginCityId,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            hintText: 'Where is the truck available?',
                          ),
                          items: locations.map((loc) {
                            return DropdownMenuItem(
                              value: loc.id,
                              child: Text(
                                '${loc.name}, ${loc.region}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          }).toList(),
                          onChanged: (value) =>
                              setState(() => _selectedOriginCityId = value),
                          validator: (value) =>
                              value == null ? 'Required' : null,
                        ),
                        loading: () => const LinearProgressIndicator(),
                        error: (_, __) =>
                            const Text('Failed to load locations'),
                      ),
                      const SizedBox(height: 16),

                      // Destination city (optional)
                      const Text(
                        'Destination City (optional)',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      locationsAsync.when(
                        data: (locations) => DropdownButtonFormField<String>(
                          value: _selectedDestinationCityId,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            hintText: 'Preferred destination',
                          ),
                          items: [
                            const DropdownMenuItem(
                              value: null,
                              child: Text('Any destination'),
                            ),
                            ...locations.map((loc) {
                              return DropdownMenuItem(
                                value: loc.id,
                                child: Text(
                                  '${loc.name}, ${loc.region}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              );
                            }),
                          ],
                          onChanged: (value) =>
                              setState(() => _selectedDestinationCityId = value),
                        ),
                        loading: () => const LinearProgressIndicator(),
                        error: (_, __) =>
                            const Text('Failed to load locations'),
                      ),
                      const SizedBox(height: 16),

                      // Available from date
                      const Text(
                        'Available From *',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () async {
                          final date = await showDatePicker(
                            context: context,
                            initialDate: _availableFrom,
                            firstDate: DateTime.now(),
                            lastDate:
                                DateTime.now().add(const Duration(days: 90)),
                          );
                          if (date != null) {
                            setState(() => _availableFrom = date);
                          }
                        },
                        child: InputDecorator(
                          decoration: const InputDecoration(),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today, size: 20),
                              const SizedBox(width: 12),
                              Text(DateFormat('MMM d, yyyy')
                                  .format(_availableFrom)),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Available to date (optional)
                      const Text(
                        'Available Until (optional)',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () async {
                          final date = await showDatePicker(
                            context: context,
                            initialDate: _availableTo ?? _availableFrom,
                            firstDate: _availableFrom,
                            lastDate:
                                DateTime.now().add(const Duration(days: 90)),
                          );
                          setState(() => _availableTo = date);
                        },
                        child: InputDecorator(
                          decoration: const InputDecoration(),
                          child: Row(
                            children: [
                              const Icon(Icons.calendar_today, size: 20),
                              const SizedBox(width: 12),
                              Text(_availableTo != null
                                  ? DateFormat('MMM d, yyyy')
                                      .format(_availableTo!)
                                  : 'No end date'),
                              const Spacer(),
                              if (_availableTo != null)
                                IconButton(
                                  onPressed: () =>
                                      setState(() => _availableTo = null),
                                  icon: const Icon(Icons.clear, size: 20),
                                ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Full/Partial
                      const Text(
                        'Load Type',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'FULL', label: Text('Full')),
                          ButtonSegment(
                              value: 'PARTIAL', label: Text('Partial')),
                        ],
                        selected: {_fullPartial},
                        onSelectionChanged: (set) =>
                            setState(() => _fullPartial = set.first),
                      ),
                      const SizedBox(height: 16),

                      // Contact name
                      const Text(
                        'Contact Name *',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _contactNameController,
                        decoration: const InputDecoration(
                          hintText: 'Enter contact name (min 2 characters)',
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Required';
                          }
                          if (value.length < 2) {
                            return 'Name must be at least 2 characters';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      // Contact phone
                      const Text(
                        'Contact Phone *',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _contactPhoneController,
                        decoration: const InputDecoration(
                          hintText: '0912345678 or +251912345678',
                          helperText: 'Ethiopian format: 09XXXXXXXX',
                        ),
                        keyboardType: TextInputType.phone,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Required';
                          }
                          // Clean phone number (remove spaces/dashes)
                          final cleaned = value.replaceAll(RegExp(r'[\s\-]'), '');
                          // Ethiopian phone pattern
                          final pattern = RegExp(r'^(\+251|0)?9\d{8}$');
                          if (!pattern.hasMatch(cleaned)) {
                            return 'Invalid Ethiopian phone format';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      // Notes
                      const Text(
                        'Notes (optional)',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      TextFormField(
                        controller: _notesController,
                        decoration: const InputDecoration(
                          hintText: 'Any additional information...',
                        ),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 24),

                      // Submit button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: _isSubmitting ? null : _submit,
                          child: _isSubmitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Post Truck'),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
            ),
          );
        }
      }

/// Edit posting modal
class _EditPostingModal extends ConsumerStatefulWidget {
  final TruckPosting posting;

  const _EditPostingModal({required this.posting});

  @override
  ConsumerState<_EditPostingModal> createState() => _EditPostingModalState();
}

class _EditPostingModalState extends ConsumerState<_EditPostingModal> {
  late DateTime _availableFrom;
  DateTime? _availableTo;
  late String _fullPartial;
  final _notesController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _availableFrom = widget.posting.availableFrom;
    _availableTo = widget.posting.availableTo;
    _fullPartial = widget.posting.fullPartial ?? 'FULL';
    _notesController.text = widget.posting.notes ?? '';
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);

    final service = TruckService();
    final result = await service.updateTruckPosting(
      postingId: widget.posting.id,
      availableFrom: _availableFrom,
      availableTo: _availableTo,
      fullPartial: _fullPartial,
      notes: _notesController.text.trim().isNotEmpty
          ? _notesController.text.trim()
          : null,
    );

    setState(() => _isSubmitting = false);

    if (!mounted) return;

    if (result.success) {
      Navigator.pop(context, true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Posting updated'),
          backgroundColor: AppColors.success,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.error ?? 'Failed to update posting'),
          backgroundColor: AppColors.error,
        ),
      );
    }
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
                  'Edit Posting',
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

            // Truck info (read-only)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.slate100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.local_shipping, color: AppColors.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.posting.truck?.licensePlate ?? 'Unknown',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          '${widget.posting.originCityName ?? "N/A"} → ${widget.posting.destinationCityName ?? "Any"}',
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

            // Available dates
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'From',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () async {
                          final date = await showDatePicker(
                            context: context,
                            initialDate: _availableFrom,
                            firstDate: DateTime.now(),
                            lastDate:
                                DateTime.now().add(const Duration(days: 90)),
                          );
                          if (date != null) {
                            setState(() => _availableFrom = date);
                          }
                        },
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                          ),
                          child: Text(
                              DateFormat('MMM d').format(_availableFrom)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Until',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () async {
                          final date = await showDatePicker(
                            context: context,
                            initialDate: _availableTo ?? _availableFrom,
                            firstDate: _availableFrom,
                            lastDate:
                                DateTime.now().add(const Duration(days: 90)),
                          );
                          setState(() => _availableTo = date);
                        },
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 12, vertical: 8),
                          ),
                          child: Text(_availableTo != null
                              ? DateFormat('MMM d').format(_availableTo!)
                              : 'No end'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Full/Partial
            const Text(
              'Load Type',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'FULL', label: Text('Full')),
                ButtonSegment(value: 'PARTIAL', label: Text('Partial')),
              ],
              selected: {_fullPartial},
              onSelectionChanged: (set) =>
                  setState(() => _fullPartial = set.first),
            ),
            const SizedBox(height: 16),

            // Notes
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(
                labelText: 'Notes',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 24),

            // Submit button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Save Changes'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Matching loads sheet
class _MatchingLoadsSheet extends ConsumerWidget {
  final String postingId;

  const _MatchingLoadsSheet({required this.postingId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Header
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Text(
                      'Matching Loads',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              // Content
              Expanded(
                child: FutureBuilder<List<MatchingLoad>>(
                  future: _fetchMatches(postingId),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }

                    if (snapshot.hasError) {
                      return Center(
                        child: Text('Error: ${snapshot.error}'),
                      );
                    }

                    final matches = snapshot.data ?? [];
                    if (matches.isEmpty) {
                      return const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.search_off,
                                size: 64, color: Colors.grey),
                            SizedBox(height: 16),
                            Text(
                              'No matching loads found',
                              style: TextStyle(
                                fontSize: 16,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      );
                    }

                    return ListView.builder(
                      controller: scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: matches.length,
                      itemBuilder: (context, index) {
                        final load = matches[index];
                        return _MatchingLoadCard(load: load);
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<List<MatchingLoad>> _fetchMatches(String postingId) async {
    final service = TruckService();
    final result = await service.getMatchingLoadsForPosting(postingId);
    return result.success ? result.data ?? [] : [];
  }
}

/// Matching load card
class _MatchingLoadCard extends StatelessWidget {
  final MatchingLoad load;

  const _MatchingLoadCard({required this.load});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Route
            Row(
              children: [
                Expanded(
                  child: Text(
                    load.route,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
                if (load.matchScore != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.success.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${load.matchScore}%',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: AppColors.success,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),

            // Details
            Wrap(
              spacing: 12,
              children: [
                _DetailChip(icon: Icons.scale, label: load.weightDisplay),
                if (load.truckType != null)
                  _DetailChip(icon: Icons.local_shipping, label: load.truckType!),
                if (load.pickupDate != null)
                  _DetailChip(
                    icon: Icons.calendar_today,
                    label: DateFormat('MMM d').format(load.pickupDate!),
                  ),
              ],
            ),

            if (load.distanceToOrigin != null ||
                load.distanceAfterDelivery != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  if (load.distanceToOrigin != null)
                    Text(
                      'DH-O: ${load.distanceToOrigin!.toStringAsFixed(0)} km',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                  if (load.distanceToOrigin != null &&
                      load.distanceAfterDelivery != null)
                    const Text(' | '),
                  if (load.distanceAfterDelivery != null)
                    Text(
                      'DH-D: ${load.distanceAfterDelivery!.toStringAsFixed(0)} km',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
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

/// Empty state
class _EmptyState extends StatelessWidget {
  final String status;
  final VoidCallback onPostNew;

  const _EmptyState({required this.status, required this.onPostNew});

  @override
  Widget build(BuildContext context) {
    String message;
    IconData icon;

    switch (status.toUpperCase()) {
      case 'ACTIVE':
      case 'POSTED':
        message = 'No posted trucks yet.\nPost a truck to find matching loads!';
        icon = Icons.local_shipping_outlined;
        break;
      case 'EXPIRED':
        message = 'No expired postings.';
        icon = Icons.history;
        break;
      default:
        message = 'No unposted trucks.';
        icon = Icons.inbox_outlined;
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 80, color: Colors.grey[300]),
            const SizedBox(height: 24),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
              ),
            ),
            if (status == 'ACTIVE') ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onPostNew,
                icon: const Icon(Icons.add),
                label: const Text('Post Your First Truck'),
              ),
            ],
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
            const Text(
              'Failed to load postings',
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
