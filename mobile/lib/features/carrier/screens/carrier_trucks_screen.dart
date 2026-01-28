import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart';
import '../../../core/services/truck_service.dart';
import '../../../core/models/truck.dart';

/// Provider for carrier's trucks list
final trucksListProvider = FutureProvider.autoDispose<List<Truck>>((ref) async {
  final service = TruckService();
  final result = await service.getTrucks(limit: 100);
  return result.success ? result.data ?? [] : [];
});

/// Filter state
enum TruckFilter { all, available, onJob, pending }

final truckFilterProvider = StateProvider<TruckFilter>((ref) => TruckFilter.all);

class CarrierTrucksScreen extends ConsumerWidget {
  const CarrierTrucksScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final trucksAsync = ref.watch(trucksListProvider);
    final filter = ref.watch(truckFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Trucks'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () => _showFilterSheet(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(trucksListProvider);
        },
        child: trucksAsync.when(
          data: (trucks) {
            final filteredTrucks = _filterTrucks(trucks, filter);

            if (trucks.isEmpty) {
              return _EmptyState(
                onAddTruck: () => context.push('/carrier/trucks/add'),
              );
            }

            return Column(
              children: [
                // Stats bar
                _StatsBar(trucks: trucks),

                // Filter chips
                _FilterChips(
                  filter: filter,
                  onFilterChanged: (f) => ref.read(truckFilterProvider.notifier).state = f,
                  counts: _getTruckCounts(trucks),
                ),

                // Trucks list
                Expanded(
                  child: filteredTrucks.isEmpty
                      ? Center(
                          child: Text(
                            'No trucks match this filter',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: filteredTrucks.length,
                          itemBuilder: (context, index) {
                            return TruckCard(
                              truck: filteredTrucks[index],
                              onTap: () => context.push('/carrier/trucks/${filteredTrucks[index].id}'),
                              onPostTruck: () => context.push('/carrier/postings/create?truckId=${filteredTrucks[index].id}'),
                            );
                          },
                        ),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _ErrorState(
            message: error.toString(),
            onRetry: () => ref.invalidate(trucksListProvider),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/carrier/trucks/add'),
        icon: const Icon(Icons.add),
        label: const Text('Add Truck'),
      ),
    );
  }

  List<Truck> _filterTrucks(List<Truck> trucks, TruckFilter filter) {
    switch (filter) {
      case TruckFilter.all:
        return trucks;
      case TruckFilter.available:
        return trucks.where((t) => t.isApproved && t.isAvailable).toList();
      case TruckFilter.onJob:
        return trucks.where((t) => t.isApproved && !t.isAvailable).toList();
      case TruckFilter.pending:
        return trucks.where((t) => t.isPending).toList();
    }
  }

  Map<TruckFilter, int> _getTruckCounts(List<Truck> trucks) {
    return {
      TruckFilter.all: trucks.length,
      TruckFilter.available: trucks.where((t) => t.isApproved && t.isAvailable).length,
      TruckFilter.onJob: trucks.where((t) => t.isApproved && !t.isAvailable).length,
      TruckFilter.pending: trucks.where((t) => t.isPending).length,
    };
  }

  void _showFilterSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      builder: (context) => _FilterBottomSheet(
        currentFilter: ref.read(truckFilterProvider),
        onFilterSelected: (filter) {
          ref.read(truckFilterProvider.notifier).state = filter;
          Navigator.pop(context);
        },
      ),
    );
  }
}

class _StatsBar extends StatelessWidget {
  final List<Truck> trucks;

  const _StatsBar({required this.trucks});

  @override
  Widget build(BuildContext context) {
    final total = trucks.length;
    final available = trucks.where((t) => t.isApproved && t.isAvailable).length;
    final onJob = trucks.where((t) => t.isApproved && !t.isAvailable).length;
    final pending = trucks.where((t) => t.isPending).length;

    return Container(
      padding: const EdgeInsets.all(16),
      color: AppColors.primary.withValues(alpha: 0.05),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _StatItem(label: 'Total', value: total.toString(), color: AppColors.primary),
          _StatItem(label: 'Available', value: available.toString(), color: Colors.green),
          _StatItem(label: 'On Job', value: onJob.toString(), color: Colors.blue),
          _StatItem(label: 'Pending', value: pending.toString(), color: Colors.amber),
        ],
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }
}

class _FilterChips extends StatelessWidget {
  final TruckFilter filter;
  final Function(TruckFilter) onFilterChanged;
  final Map<TruckFilter, int> counts;

  const _FilterChips({
    required this.filter,
    required this.onFilterChanged,
    required this.counts,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _FilterChip(
            label: 'All (${counts[TruckFilter.all]})',
            isSelected: filter == TruckFilter.all,
            onTap: () => onFilterChanged(TruckFilter.all),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Available (${counts[TruckFilter.available]})',
            isSelected: filter == TruckFilter.available,
            onTap: () => onFilterChanged(TruckFilter.available),
            color: Colors.green,
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'On Job (${counts[TruckFilter.onJob]})',
            isSelected: filter == TruckFilter.onJob,
            onTap: () => onFilterChanged(TruckFilter.onJob),
            color: Colors.blue,
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Pending (${counts[TruckFilter.pending]})',
            isSelected: filter == TruckFilter.pending,
            onTap: () => onFilterChanged(TruckFilter.pending),
            color: Colors.amber,
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;
  final Color? color;

  const _FilterChip({
    required this.label,
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
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : chipColor,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class TruckCard extends StatelessWidget {
  final Truck truck;
  final VoidCallback onTap;
  final VoidCallback onPostTruck;

  const TruckCard({
    super.key,
    required this.truck,
    required this.onTap,
    required this.onPostTruck,
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
              Row(
                children: [
                  // Truck icon
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _getStatusColor().withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.local_shipping,
                      color: _getStatusColor(),
                      size: 32,
                    ),
                  ),
                  const SizedBox(width: 16),

                  // Truck info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          truck.licensePlate,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${truck.truckTypeDisplay} • ${truck.capacityDisplay}',
                          style: TextStyle(
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Status badge
                  _StatusBadge(
                    label: truck.statusDisplay,
                    color: _getStatusColor(),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Truck details row
              Row(
                children: [
                  _TruckInfo(
                    icon: truck.hasGps ? Icons.gps_fixed : Icons.gps_off,
                    label: truck.hasGps
                        ? (truck.isGpsActive ? 'GPS Active' : 'GPS Offline')
                        : 'No GPS',
                    color: truck.hasGps && truck.isGpsActive
                        ? Colors.green
                        : Colors.grey,
                  ),
                  const SizedBox(width: 16),
                  if (truck.currentCity != null)
                    _TruckInfo(
                      icon: Icons.location_on,
                      label: truck.currentCity!,
                      color: Colors.grey[600]!,
                    ),
                ],
              ),

              // Actions row (only for approved trucks)
              if (truck.isApproved) ...[
                const SizedBox(height: 16),
                if (truck.isAvailable)
                  // Available truck - show Post Truck button
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: onPostTruck,
                          icon: const Icon(Icons.post_add, size: 18),
                          label: const Text('Post Truck'),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton(
                        onPressed: onTap,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
                        ),
                        child: const Text('Details'),
                      ),
                    ],
                  )
                else
                  // On Job truck - show View Trip button
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.blue.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.info_outline, color: Colors.blue[700], size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'This truck is assigned to an active delivery. Check Trips to track progress.',
                                style: TextStyle(color: Colors.blue[700], fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () => GoRouter.of(context).push('/carrier/trips'),
                              icon: const Icon(Icons.route, size: 18),
                              label: const Text('View Trips'),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                backgroundColor: Colors.blue,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          OutlinedButton(
                            onPressed: onTap,
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
                            ),
                            child: const Text('Details'),
                          ),
                        ],
                      ),
                    ],
                  ),
              ],

              // Show rejection reason if rejected
              if (truck.isRejected && truck.rejectionReason != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: Colors.red[700], size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          truck.rejectionReason!,
                          style: TextStyle(color: Colors.red[700], fontSize: 13),
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
    if (!truck.isApproved) {
      if (truck.isPending) return Colors.amber;
      if (truck.isRejected) return Colors.red;
      return Colors.grey;
    }
    return truck.isAvailable ? Colors.green : Colors.blue;
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
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
}

class _TruckInfo extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _TruckInfo({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(color: color, fontSize: 14),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onAddTruck;

  const _EmptyState({required this.onAddTruck});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.local_shipping_outlined,
              size: 80,
              color: Colors.grey[400],
            ),
            const SizedBox(height: 24),
            Text(
              'No Trucks Yet',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Add your first truck to start posting on the loadboard and accepting loads.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 16,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: onAddTruck,
              icon: const Icon(Icons.add),
              label: const Text('Add Your First Truck'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

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
            Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.red[400],
            ),
            const SizedBox(height: 16),
            Text(
              'Failed to load trucks',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
              ),
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

class _FilterBottomSheet extends StatelessWidget {
  final TruckFilter currentFilter;
  final Function(TruckFilter) onFilterSelected;

  const _FilterBottomSheet({
    required this.currentFilter,
    required this.onFilterSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Filter Trucks',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 24),
          ...TruckFilter.values.map((filter) => ListTile(
            leading: Icon(
              currentFilter == filter
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: currentFilter == filter ? AppColors.primary : null,
            ),
            title: Text(_getFilterLabel(filter)),
            onTap: () => onFilterSelected(filter),
          )),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  String _getFilterLabel(TruckFilter filter) {
    switch (filter) {
      case TruckFilter.all:
        return 'All Trucks';
      case TruckFilter.available:
        return 'Available for Work';
      case TruckFilter.onJob:
        return 'Currently On Job';
      case TruckFilter.pending:
        return 'Pending Approval';
    }
  }
}
