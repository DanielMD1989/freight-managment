import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app.dart';
import '../../../core/models/load.dart';
import '../../../core/services/load_service.dart';

/// Provider for fetching shipper's loads
final shipperLoadsProvider =
    FutureProvider.autoDispose<List<Load>>((ref) async {
  final service = LoadService();
  final result = await service.searchLoads(myLoads: true, limit: 100);
  return result.data?.loads ?? [];
});

/// Provider for fetching load requests for shipper's loads
final shipperLoadRequestsProvider =
    FutureProvider.autoDispose<List<LoadRequest>>((ref) async {
  final service = LoadService();
  final result = await service.getLoadRequests(status: 'PENDING');
  return result.data ?? [];
});

class ShipperLoadsScreen extends ConsumerStatefulWidget {
  const ShipperLoadsScreen({super.key});

  @override
  ConsumerState<ShipperLoadsScreen> createState() => _ShipperLoadsScreenState();
}

class _ShipperLoadsScreenState extends ConsumerState<ShipperLoadsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loadsAsync = ref.watch(shipperLoadsProvider);
    final requestsAsync = ref.watch(shipperLoadRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Loads'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Active'),
            Tab(text: 'Posted'),
            Tab(text: 'Completed'),
            Tab(text: 'All'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.invalidate(shipperLoadsProvider);
              ref.invalidate(shipperLoadRequestsProvider);
            },
          ),
        ],
      ),
      body: loadsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline,
                  size: 48, color: AppColors.textSecondary),
              const SizedBox(height: 16),
              const Text(
                'Failed to load your loads',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () => ref.invalidate(shipperLoadsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (loads) {
          // Group loads by status category
          final activeLoads = loads
              .where((l) =>
                  l.status == LoadStatus.assigned ||
                  l.status == LoadStatus.pickupPending ||
                  l.status == LoadStatus.inTransit ||
                  l.status == LoadStatus.delivered)
              .toList();

          final postedLoads = loads
              .where((l) =>
                  l.status == LoadStatus.posted ||
                  l.status == LoadStatus.searching ||
                  l.status == LoadStatus.offered)
              .toList();

          final completedLoads = loads
              .where((l) =>
                  l.status == LoadStatus.completed ||
                  l.status == LoadStatus.cancelled)
              .toList();

          // Get requests count per load
          final requestsPerLoad = <String, int>{};
          requestsAsync.whenData((requests) {
            for (final req in requests) {
              requestsPerLoad[req.loadId] =
                  (requestsPerLoad[req.loadId] ?? 0) + 1;
            }
          });

          return TabBarView(
            controller: _tabController,
            children: [
              _ActiveLoadsTab(
                loads: activeLoads,
                onRefresh: () => ref.invalidate(shipperLoadsProvider),
              ),
              _PostedLoadsTab(
                loads: postedLoads,
                requestsPerLoad: requestsPerLoad,
                onRefresh: () {
                  ref.invalidate(shipperLoadsProvider);
                  ref.invalidate(shipperLoadRequestsProvider);
                },
              ),
              _CompletedLoadsTab(
                loads: completedLoads,
                onRefresh: () => ref.invalidate(shipperLoadsProvider),
              ),
              _AllLoadsTab(
                loads: loads,
                onRefresh: () => ref.invalidate(shipperLoadsProvider),
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/shipper/loads/post'),
        icon: const Icon(Icons.add),
        label: const Text('Post Load'),
      ),
    );
  }
}

class _ActiveLoadsTab extends StatelessWidget {
  final List<Load> loads;
  final VoidCallback onRefresh;

  const _ActiveLoadsTab({
    required this.loads,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (loads.isEmpty) {
      return const _EmptyState(
        icon: Icons.local_shipping_outlined,
        title: 'No active loads',
        subtitle: 'Loads being transported will appear here',
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: loads.length,
        itemBuilder: (context, index) {
          final load = loads[index];
          return _ActiveLoadCard(load: load);
        },
      ),
    );
  }
}

class _ActiveLoadCard extends StatelessWidget {
  final Load load;

  const _ActiveLoadCard({required this.load});

  Color _getStatusColor() {
    switch (load.status) {
      case LoadStatus.inTransit:
        return AppColors.primary;
      case LoadStatus.pickupPending:
        return AppColors.warning;
      case LoadStatus.assigned:
        return AppColors.secondary;
      case LoadStatus.delivered:
        return AppColors.success;
      default:
        return AppColors.textSecondary;
    }
  }

  double _getProgress() {
    switch (load.status) {
      case LoadStatus.assigned:
        return 0.1;
      case LoadStatus.pickupPending:
        return 0.25;
      case LoadStatus.inTransit:
        return 0.6;
      case LoadStatus.delivered:
        return 0.9;
      default:
        return 0.0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => context.push('/shipper/loads/${load.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'LOAD-${load.id.substring(0, 8).toUpperCase()}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      load.statusDisplay,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                load.route,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              if (load.assignedTruck != null) ...[
                Row(
                  children: [
                    const Icon(
                      Icons.business,
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        load.assignedTruck!.ownerName ?? 'Unknown Carrier',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 16),
                    const Icon(
                      Icons.local_shipping,
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      load.assignedTruck!.licensePlate,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: _getProgress(),
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => context.push('/shipper/loads/${load.id}'),
                      icon: const Icon(Icons.info_outline, size: 18),
                      label: const Text('Details'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        // TODO: Implement contact carrier
                      },
                      icon: const Icon(Icons.phone, size: 18),
                      label: const Text('Contact'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PostedLoadsTab extends StatelessWidget {
  final List<Load> loads;
  final Map<String, int> requestsPerLoad;
  final VoidCallback onRefresh;

  const _PostedLoadsTab({
    required this.loads,
    required this.requestsPerLoad,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (loads.isEmpty) {
      return _EmptyState(
        icon: Icons.post_add_outlined,
        title: 'No posted loads',
        subtitle: 'Post a load to find carriers',
        action: ElevatedButton.icon(
          onPressed: () => context.push('/shipper/loads/post'),
          icon: const Icon(Icons.add),
          label: const Text('Post Load'),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: loads.length,
        itemBuilder: (context, index) {
          final load = loads[index];
          final requestCount = requestsPerLoad[load.id] ?? 0;
          return _PostedLoadCard(
            load: load,
            requestCount: requestCount,
          );
        },
      ),
    );
  }
}

class _PostedLoadCard extends StatelessWidget {
  final Load load;
  final int requestCount;

  const _PostedLoadCard({
    required this.load,
    required this.requestCount,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d');

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => context.push('/shipper/loads/${load.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'LOAD-${load.id.substring(0, 8).toUpperCase()}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: load.status == LoadStatus.offered
                          ? AppColors.success.withValues(alpha: 0.1)
                          : AppColors.warning.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      load.status == LoadStatus.offered
                          ? 'Has Offers'
                          : 'Awaiting Bids',
                      style: TextStyle(
                        color: load.status == LoadStatus.offered
                            ? AppColors.success
                            : AppColors.warning,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                load.route,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _InfoChip(Icons.calendar_today, dateFormat.format(load.pickupDate)),
                  const SizedBox(width: 12),
                  _InfoChip(Icons.scale, load.weightDisplay),
                  const SizedBox(width: 12),
                  if (load.totalFareEtb != null)
                    _InfoChip(Icons.attach_money,
                        '${load.totalFareEtb!.toStringAsFixed(0)} ETB'),
                ],
              ),
              const SizedBox(height: 12),
              // Request count indicator
              if (requestCount > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      const Icon(Icons.people, size: 16, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        '$requestCount carrier request${requestCount > 1 ? 's' : ''}',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                )
              else
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: Text(
                    'No requests yet',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              // Action buttons - matching web app parity
              Row(
                children: [
                  // Find Trucks button - PARITY with web app
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => context.push(
                        '/shipper/trucks?origin=${Uri.encodeComponent(load.pickupCity ?? '')}&destination=${Uri.encodeComponent(load.deliveryCity ?? '')}&loadId=${load.id}',
                      ),
                      icon: const Icon(Icons.search, size: 18),
                      label: const Text('Find Trucks'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // View Requests button (if has requests)
                  if (requestCount > 0) ...[
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () =>
                            context.push('/shipper/loads/${load.id}/requests'),
                        child: Text('Requests ($requestCount)'),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  // View Details button
                  OutlinedButton(
                    onPressed: () => context.push('/shipper/loads/${load.id}'),
                    child: const Text('View'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompletedLoadsTab extends StatelessWidget {
  final List<Load> loads;
  final VoidCallback onRefresh;

  const _CompletedLoadsTab({
    required this.loads,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (loads.isEmpty) {
      return const _EmptyState(
        icon: Icons.check_circle_outline,
        title: 'No completed loads',
        subtitle: 'Completed deliveries will appear here',
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: loads.length,
        itemBuilder: (context, index) {
          final load = loads[index];
          return _CompletedLoadCard(load: load);
        },
      ),
    );
  }
}

class _CompletedLoadCard extends StatelessWidget {
  final Load load;

  const _CompletedLoadCard({required this.load});

  @override
  Widget build(BuildContext context) {
    final isCancelled = load.status == LoadStatus.cancelled;
    final statusColor = isCancelled ? AppColors.error : AppColors.success;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => context.push('/shipper/loads/${load.id}'),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'LOAD-${load.id.substring(0, 8).toUpperCase()}',
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isCancelled ? 'Cancelled' : 'Completed',
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                load.route,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              if (load.assignedTruck != null)
                Row(
                  children: [
                    const Icon(
                      Icons.business,
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        load.assignedTruck!.ownerName ?? 'Unknown Carrier',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Icon(
                      Icons.local_shipping,
                      size: 14,
                      color: AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      load.assignedTruck!.licensePlate,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: 1.0,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (!isCancelled && load.podSubmitted) ...[
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          // TODO: View POD
                        },
                        icon: const Icon(Icons.receipt, size: 18),
                        label: const Text('View POD'),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => context.push('/shipper/loads/${load.id}'),
                      icon: const Icon(Icons.info_outline, size: 18),
                      label: const Text('Details'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AllLoadsTab extends StatelessWidget {
  final List<Load> loads;
  final VoidCallback onRefresh;

  const _AllLoadsTab({
    required this.loads,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    if (loads.isEmpty) {
      return _EmptyState(
        icon: Icons.inbox_outlined,
        title: 'No loads yet',
        subtitle: 'Post your first load to get started',
        action: ElevatedButton.icon(
          onPressed: () => context.push('/shipper/loads/post'),
          icon: const Icon(Icons.add),
          label: const Text('Post Load'),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: loads.length,
        itemBuilder: (context, index) {
          final load = loads[index];
          return _LoadSummaryCard(load: load);
        },
      ),
    );
  }
}

class _LoadSummaryCard extends StatelessWidget {
  final Load load;

  const _LoadSummaryCard({required this.load});

  Color _getStatusColor() {
    switch (load.status) {
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

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor();
    final dateFormat = DateFormat('MMM d, yyyy');

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        onTap: () => context.push('/shipper/loads/${load.id}'),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        title: Text(
          load.route,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.calendar_today,
                    size: 12, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  dateFormat.format(load.pickupDate),
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(width: 12),
                const Icon(Icons.scale, size: 12, color: AppColors.textSecondary),
                const SizedBox(width: 4),
                Text(
                  load.weightDisplay,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ],
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            load.statusDisplay,
            style: TextStyle(
              color: statusColor,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? action;

  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
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
            if (action != null) ...[
              const SizedBox(height: 24),
              action!,
            ],
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip(this.icon, this.label);

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: AppColors.textSecondary),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
