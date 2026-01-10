import 'package:flutter/material.dart';
import '../../../app.dart';

class ShipperLoadsScreen extends StatelessWidget {
  const ShipperLoadsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('My Loads'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Active'),
              Tab(text: 'Pending'),
              Tab(text: 'Completed'),
              Tab(text: 'All'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _ActiveLoadsTab(),
            _PendingLoadsTab(),
            _CompletedLoadsTab(),
            _AllLoadsTab(),
          ],
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () {
            // TODO: Post new load
          },
          icon: const Icon(Icons.add),
          label: const Text('Post Load'),
        ),
      ),
    );
  }
}

class _ActiveLoadsTab extends StatelessWidget {
  const _ActiveLoadsTab();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 3,
      itemBuilder: (context, index) {
        final statuses = ['In Transit', 'At Pickup', 'Loading'];
        final colors = [AppColors.primary, AppColors.warning, AppColors.secondary];
        final progress = [0.65, 0.15, 0.05];

        return _LoadCard(
          loadId: 'LOAD-${1001 + index}',
          route: index == 0
              ? 'Addis Ababa → Mekelle'
              : index == 1
                  ? 'Bahir Dar → Addis Ababa'
                  : 'Jimma → Hawassa',
          status: statuses[index],
          statusColor: colors[index],
          carrier: 'ABC Transport',
          truck: 'AA-${12345 + index * 11111}',
          progress: progress[index],
          showTracking: true,
        );
      },
    );
  }
}

class _PendingLoadsTab extends StatelessWidget {
  const _PendingLoadsTab();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 2,
      itemBuilder: (context, index) {
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'LOAD-${2001 + index}',
                      style: TextStyle(
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
                        color: AppColors.warning.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'Awaiting Bids',
                        style: TextStyle(
                          color: AppColors.warning,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  index == 0 ? 'Dire Dawa → Harar' : 'Gondar → Axum',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _InfoChip(Icons.calendar_today, 'Jan ${18 + index}'),
                    const SizedBox(width: 12),
                    _InfoChip(Icons.scale, '${5000 + index * 2000} kg'),
                    const SizedBox(width: 12),
                    _InfoChip(Icons.attach_money, '${35000 + index * 5000} ETB'),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text(
                      '${3 - index} carrier requests',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    OutlinedButton(
                      onPressed: () {},
                      child: const Text('View Requests'),
                    ),
                    const SizedBox(width: 8),
                    ElevatedButton(
                      onPressed: () {},
                      child: const Text('Edit'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CompletedLoadsTab extends StatelessWidget {
  const _CompletedLoadsTab();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: 5,
      itemBuilder: (context, index) {
        return _LoadCard(
          loadId: 'LOAD-${900 + index}',
          route: 'Addis Ababa → Various',
          status: 'Delivered',
          statusColor: AppColors.success,
          carrier: 'XYZ Logistics',
          truck: 'AA-${98765 - index * 1111}',
          progress: 1.0,
          showTracking: false,
          showRating: true,
        );
      },
    );
  }
}

class _AllLoadsTab extends StatelessWidget {
  const _AllLoadsTab();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text('All loads will appear here'),
    );
  }
}

class _LoadCard extends StatelessWidget {
  final String loadId;
  final String route;
  final String status;
  final Color statusColor;
  final String carrier;
  final String truck;
  final double progress;
  final bool showTracking;
  final bool showRating;

  const _LoadCard({
    required this.loadId,
    required this.route,
    required this.status,
    required this.statusColor,
    required this.carrier,
    required this.truck,
    required this.progress,
    this.showTracking = false,
    this.showRating = false,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  loadId,
                  style: TextStyle(
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
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    status,
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
              route,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  Icons.business,
                  size: 14,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 4),
                Text(
                  carrier,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(width: 16),
                Icon(
                  Icons.local_shipping,
                  size: 14,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 4),
                Text(
                  truck,
                  style: TextStyle(
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
                value: progress,
                backgroundColor: Colors.grey[200],
                valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                minHeight: 6,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                if (showTracking) ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.gps_fixed, size: 18),
                      label: const Text('Track'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.phone, size: 18),
                      label: const Text('Contact'),
                    ),
                  ),
                ],
                if (showRating) ...[
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.receipt, size: 18),
                      label: const Text('View POD'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.star, size: 18),
                      label: const Text('Rate'),
                    ),
                  ),
                ],
              ],
            ),
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
          style: TextStyle(
            color: AppColors.textSecondary,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}
