import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app.dart';
import '../../../core/models/truck.dart';
import '../../../core/models/load.dart';
import '../../../core/services/truck_service.dart';
import '../../../core/services/load_service.dart';

/// Provider for truck details
final shipperTruckDetailsProvider =
    FutureProvider.autoDispose.family<Truck?, String>((ref, truckId) async {
  final service = TruckService();
  final result = await service.getTruckById(truckId);
  return result.success ? result.data : null;
});

/// Provider for shipper's posted loads
final shipperLoadsForBookingProvider =
    FutureProvider.autoDispose<List<Load>>((ref) async {
  final service = LoadService();
  final result = await service.searchLoads(
    status: 'POSTED',
    myLoads: true,
  );
  return result.success ? result.data?.loads ?? [] : [];
});

/// Shipper Truck Details Screen
class ShipperTruckDetailsScreen extends ConsumerStatefulWidget {
  final String truckId;

  const ShipperTruckDetailsScreen({super.key, required this.truckId});

  @override
  ConsumerState<ShipperTruckDetailsScreen> createState() =>
      _ShipperTruckDetailsScreenState();
}

class _ShipperTruckDetailsScreenState
    extends ConsumerState<ShipperTruckDetailsScreen> {
  bool _isBooking = false;

  @override
  Widget build(BuildContext context) {
    final truckAsync = ref.watch(shipperTruckDetailsProvider(widget.truckId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Truck Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () =>
                ref.invalidate(shipperTruckDetailsProvider(widget.truckId)),
          ),
        ],
      ),
      body: truckAsync.when(
        data: (truck) {
          if (truck == null) {
            return _buildNotFound();
          }
          return _buildContent(truck);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _buildError(error.toString()),
      ),
    );
  }

  Widget _buildNotFound() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'Truck Not Found',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.grey[700],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'This truck may have been removed or is no longer available.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.pop(),
              child: const Text('Go Back'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red[400]),
            const SizedBox(height: 16),
            const Text(
              'Failed to load details',
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
              onPressed: () =>
                  ref.invalidate(shipperTruckDetailsProvider(widget.truckId)),
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(Truck truck) {
    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(shipperTruckDetailsProvider(widget.truckId)),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header card with truck icon and availability
                  _TruckHeader(truck: truck),
                  const SizedBox(height: 16),

                  // Specifications card
                  _SpecificationsCard(truck: truck),
                  const SizedBox(height: 16),

                  // Location card
                  if (truck.currentCity != null || truck.currentRegion != null)
                    _LocationCard(truck: truck),
                  if (truck.currentCity != null || truck.currentRegion != null)
                    const SizedBox(height: 16),

                  // Contact card
                  if (truck.contactName != null || truck.contactPhone != null)
                    _ContactCard(truck: truck),
                  if (truck.contactName != null || truck.contactPhone != null)
                    const SizedBox(height: 16),

                  // Carrier/Owner card
                  if (truck.ownerName != null) _OwnerCard(truck: truck),
                  if (truck.ownerName != null) const SizedBox(height: 16),

                  const SizedBox(height: 80), // Space for bottom button
                ],
              ),
            ),
          ),
        ),

        // Bottom action bar
        if (truck.isAvailable) _buildActionBar(truck),
      ],
    );
  }

  Widget _buildActionBar(Truck truck) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            // Capacity info
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  truck.capacityDisplay,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
                Text(
                  truck.truckTypeDisplay,
                  style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                ),
              ],
            ),
            const Spacer(),
            SizedBox(
              width: 180,
              child: ElevatedButton.icon(
                onPressed: _isBooking ? null : () => _showBookingModal(truck),
                icon: _isBooking
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.bookmark_add, size: 18),
                label: Text(_isBooking ? 'Booking...' : 'Book Truck'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showBookingModal(Truck truck) async {
    // Show loading indicator while fetching loads
    setState(() => _isBooking = true);

    // Refresh the loads provider and wait for the result
    ref.invalidate(shipperLoadsForBookingProvider);

    // Wait a moment for the provider to start fetching
    await Future.delayed(const Duration(milliseconds: 100));

    // Get the loads - use a direct API call for reliability
    final service = LoadService();
    final result = await service.searchLoads(
      status: 'POSTED',
      myLoads: true,
    );

    setState(() => _isBooking = false);

    final List<Load> loads = result.success ? result.data?.loads ?? [] : [];

    if (loads.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.success
            ? 'You need at least one posted load to book a truck'
            : 'Failed to load your loads: ${result.error}'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    if (!mounted) return;

    final modalResult = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _BookTruckModal(
        truck: truck,
        loads: loads,
      ),
    );

    if (modalResult != null && mounted) {
      await _submitBooking(truck.id, modalResult);
    }
  }

  Future<void> _submitBooking(String truckId, Map<String, dynamic> data) async {
    setState(() => _isBooking = true);

    final service = TruckService();
    final result = await service.requestTruck(
      truckId: truckId,
      loadId: data['loadId'],
      notes: data['notes'],
      expiresInHours: data['expiresInHours'] ?? 24,
    );

    if (!mounted) return;

    setState(() => _isBooking = false);

    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Booking request sent to carrier!'),
          backgroundColor: AppColors.success,
        ),
      );
      context.pop();
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

/// Truck header
class _TruckHeader extends StatelessWidget {
  final Truck truck;

  const _TruckHeader({required this.truck});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.primary100,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.local_shipping,
                size: 40,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    truck.licensePlate,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    truck.truckTypeDisplay,
                    style: TextStyle(
                      fontSize: 15,
                      color: Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: truck.isAvailable
                          ? AppColors.success.withValues(alpha: 0.1)
                          : AppColors.error.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          truck.isAvailable
                              ? Icons.check_circle
                              : Icons.cancel,
                          size: 14,
                          color: truck.isAvailable
                              ? AppColors.success
                              : AppColors.error,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          truck.isAvailable ? 'Available' : 'Not Available',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: truck.isAvailable
                                ? AppColors.success
                                : AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Specifications card
class _SpecificationsCard extends StatelessWidget {
  final Truck truck;

  const _SpecificationsCard({required this.truck});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Specifications',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _SpecItem(
                  icon: Icons.scale,
                  label: 'Capacity',
                  value: truck.capacityDisplay,
                ),
                const SizedBox(width: 16),
                if (truck.volume != null)
                  _SpecItem(
                    icon: Icons.straighten,
                    label: 'Volume',
                    value: '${truck.volume!.toStringAsFixed(0)} m³',
                  ),
              ],
            ),
            if (truck.lengthM != null) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  _SpecItem(
                    icon: Icons.straighten,
                    label: 'Length',
                    value: '${truck.lengthM!.toStringAsFixed(1)} m',
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

class _SpecItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _SpecItem({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.slate100,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 20, color: AppColors.textSecondary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Location card
class _LocationCard extends StatelessWidget {
  final Truck truck;

  const _LocationCard({required this.truck});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Current Location',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.accent100,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.location_on,
                      size: 20, color: AppColors.accent),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (truck.currentCity != null)
                        Text(
                          truck.currentCity!,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      if (truck.currentRegion != null)
                        Text(
                          truck.currentRegion!,
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey[600],
                          ),
                        ),
                    ],
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

/// Contact card
class _ContactCard extends StatelessWidget {
  final Truck truck;

  const _ContactCard({required this.truck});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Contact',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            if (truck.contactName != null)
              Row(
                children: [
                  const Icon(Icons.person, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    truck.contactName!,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            if (truck.contactPhone != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.phone, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    truck.contactPhone!,
                    style: const TextStyle(fontSize: 14),
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

/// Owner card
class _OwnerCard extends StatelessWidget {
  final Truck truck;

  const _OwnerCard({required this.truck});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Carrier/Owner',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.slate100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.business, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    truck.ownerName!,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
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
