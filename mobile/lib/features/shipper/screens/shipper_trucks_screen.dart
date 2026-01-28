import 'package:flutter/material.dart';
import '../../../app.dart';

class ShipperTrucksScreen extends StatelessWidget {
  const ShipperTrucksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Find Trucks'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {
              _showFilterSheet(context);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search by location, type...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: AppColors.surface,
              ),
            ),
          ),

          // Active filters
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _FilterChip(label: 'Dry Van', isSelected: true),
                const SizedBox(width: 8),
                _FilterChip(label: 'Addis Ababa', isSelected: true),
                const SizedBox(width: 8),
                _FilterChip(label: '> 5000 kg', isSelected: false),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Results count
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '12 trucks available',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                TextButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.sort, size: 18),
                  label: const Text('Sort'),
                ),
              ],
            ),
          ),

          // Truck list
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: 8,
              itemBuilder: (context, index) {
                return _TruckCard(
                  plateNumber: 'AA-${10000 + index * 1234}',
                  type: index % 3 == 0
                      ? 'Dry Van'
                      : index % 3 == 1
                          ? 'Flatbed'
                          : 'Refrigerated',
                  capacity: '${8000 + index * 500} kg',
                  location: index % 2 == 0 ? 'Addis Ababa' : 'Bahir Dar',
                  carrier: 'Carrier ${index + 1}',
                  rating: 4.0 + (index % 10) * 0.1,
                  reviews: 15 + index * 3,
                  available: DateTime.now().add(Duration(days: index % 3)),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showFilterSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Filter Trucks',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Reset'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Text(
                  'Truck Type',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _FilterOptionChip(label: 'Dry Van', isSelected: true),
                    _FilterOptionChip(label: 'Flatbed', isSelected: false),
                    _FilterOptionChip(label: 'Refrigerated', isSelected: false),
                    _FilterOptionChip(label: 'Tanker', isSelected: false),
                    _FilterOptionChip(label: 'Container', isSelected: false),
                  ],
                ),
                const SizedBox(height: 20),
                const Text(
                  'Capacity (kg)',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                RangeSlider(
                  values: const RangeValues(2000, 15000),
                  min: 1000,
                  max: 30000,
                  divisions: 29,
                  labels: const RangeLabels('2,000', '15,000'),
                  onChanged: (values) {},
                ),
                const SizedBox(height: 20),
                const Text(
                  'Location',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                TextField(
                  decoration: InputDecoration(
                    hintText: 'Search location...',
                    prefixIcon: const Icon(Icons.location_on),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Availability',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {},
                        icon: const Icon(Icons.calendar_today),
                        label: const Text('From Date'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {},
                        icon: const Icon(Icons.calendar_today),
                        label: const Text('To Date'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Text(
                  'Carrier Rating',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    for (int i = 1; i <= 5; i++)
                      IconButton(
                        onPressed: () {},
                        icon: Icon(
                          i <= 4 ? Icons.star : Icons.star_border,
                          color: i <= 4 ? Colors.amber : Colors.grey,
                        ),
                      ),
                    const SizedBox(width: 8),
                    const Text('& up'),
                  ],
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Apply Filters'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;

  const _FilterChip({
    required this.label,
    required this.isSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.primary : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isSelected ? AppColors.primary : AppColors.border,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.white : AppColors.textPrimary,
              fontSize: 13,
            ),
          ),
          if (isSelected) ...[
            const SizedBox(width: 4),
            Icon(
              Icons.close,
              size: 16,
              color: Colors.white.withValues(alpha: 0.8),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterOptionChip extends StatelessWidget {
  final String label;
  final bool isSelected;

  const _FilterOptionChip({
    required this.label,
    required this.isSelected,
  });

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {},
      selectedColor: AppColors.primary.withValues(alpha: 0.2),
      checkmarkColor: AppColors.primary,
    );
  }
}

class _TruckCard extends StatelessWidget {
  final String plateNumber;
  final String type;
  final String capacity;
  final String location;
  final String carrier;
  final double rating;
  final int reviews;
  final DateTime available;

  const _TruckCard({
    required this.plateNumber,
    required this.type,
    required this.capacity,
    required this.location,
    required this.carrier,
    required this.rating,
    required this.reviews,
    required this.available,
  });

  @override
  Widget build(BuildContext context) {
    final isAvailableNow = available.day == DateTime.now().day;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.local_shipping,
                    color: AppColors.primary,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            plateNumber,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: isAvailableNow
                                  ? AppColors.success.withValues(alpha: 0.1)
                                  : AppColors.warning.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              isAvailableNow ? 'Available' : 'In ${available.day - DateTime.now().day}d',
                              style: TextStyle(
                                color: isAvailableNow
                                    ? AppColors.success
                                    : AppColors.warning,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$type • $capacity',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  Icons.location_on,
                  size: 16,
                  color: AppColors.textSecondary,
                ),
                const SizedBox(width: 4),
                Text(
                  location,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(width: 16),
                Icon(
                  Icons.business,
                  size: 16,
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
                const Spacer(),
                Icon(
                  Icons.star,
                  size: 16,
                  color: Colors.amber,
                ),
                const SizedBox(width: 2),
                Text(
                  '$rating ($reviews)',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {},
                    child: const Text('View Details'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {},
                    child: const Text('Request'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
